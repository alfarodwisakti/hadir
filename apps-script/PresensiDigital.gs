// Google Apps Script backend untuk Presensi Digital 8.G
// 1. Buat spreadsheet baru atau gunakan spreadsheet yang sama.
// 2. Pastikan sheet bernama: Admin, Siswa, Presensi
// 3. Deploy sebagai Web App: "Anyone" dengan akses ke aplikasi
// 4. Salin URL hasil deploy ke pengaturan aplikasi web di Settings
//
// Catatan: ganti SPREADSHEET_ID di bawah dengan ID spreadsheet Anda.

const SPREADSHEET_ID = "PASTE_SPREADSHEET_ID_HERE";
const SHEET_ADMIN = "Admin";
const SHEET_PENGUNJUNG = "Pengunjung";
const SHEET_SISWA = "Pengunjung";
const LEGACY_SISWA = "Siswa";
const SHEET_PRESENSI = "Presensi";
const JAM_BATAS_TERLAMBAT = "07:15";

const SHEET_HEADERS = {
  [SHEET_ADMIN]: ["username", "password", "nama", "role"],
  [SHEET_PENGUNJUNG]: ["nomorQr", "barcode", "nama", "kelas"],
  [SHEET_PRESENSI]: ["tanggal", "jam", "nomorQr", "nama", "kelas", "status", "metode", "keterangan"]
};

function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function ensureSheetStructure() {
  const ss = getSpreadsheet();
  const names = [SHEET_ADMIN, SHEET_PENGUNJUNG, SHEET_PRESENSI];

  names.forEach((name) => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
    }

    const headers = SHEET_HEADERS[name] || [];
    const firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0] || [];
    const needsHeader = headers.some((header, idx) => asText(firstRow[idx]) !== header);

    if (needsHeader) {
      if (sheet.getLastRow() === 0) {
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      } else {
        const existing = sheet.getDataRange().getValues();
        const data = existing.length ? existing : [headers];
        if (asText(data[0][0]) !== headers[0]) {
          sheet.insertRowBefore(1);
          sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        }
      }
    }
  });
}

function getSheetByName(name) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }

  const headers = SHEET_HEADERS[name] || [];
  if (headers.length) {
    const firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0] || [];
    const needsHeader = headers.some((header, idx) => asText(firstRow[idx]) !== header);
    if (needsHeader) {
      if (sheet.getLastRow() === 0) {
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      } else {
        const existing = sheet.getDataRange().getValues();
        if (asText(existing[0][0]) !== headers[0]) {
          sheet.insertRowBefore(1);
          sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        }
      }
    }
  }

  return sheet;
}

function asText(value) {
  return value == null ? "" : String(value).trim();
}

function normalizeDate(value) {
  const raw = asText(value);
  if (!raw) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [d, m, y] = raw.split("/");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  if (/^\d{2}-\d{2}-\d{4}$/.test(raw)) {
    const [d, m, y] = raw.split("-");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  return raw;
}

function normalizeTime(value) {
  const raw = asText(value).replace(/\./g, ":");
  if (!raw) return "";

  if (/^\d{1,2}:\d{2}$/.test(raw)) {
    const [h, m] = raw.split(":");
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  if (/^\d{1,2}:\d{2}:\d{2}$/.test(raw)) {
    return raw;
  }

  return raw;
}

function readSheetRows(sheetName) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet && sheetName === SHEET_SISWA && ss.getSheetByName(LEGACY_SISWA)) {
    sheet = ss.getSheetByName(LEGACY_SISWA);
  }

  if (!sheet) {
    return [];
  }

  const values = sheet.getDataRange().getValues();

  if (!values || values.length < 2) {
    return [];
  }

  const headers = values[0].map((header) => asText(header).toLowerCase());
  return values.slice(1).map((row) => {
    const rowObj = {};
    headers.forEach((header, idx) => {
      rowObj[header] = row[idx] ?? "";
    });
    return rowObj;
  });
}

function writeSheetRows(sheetName, rows) {
  const sheet = getSheetByName(sheetName);
  if (!rows || rows.length === 0) {
    sheet.clear();
    return;
  }

  const headers = Object.keys(rows[0]);
  const values = [headers, ...rows.map((row) => headers.map((key) => row[key] ?? ""))];
  sheet.clear();
  sheet.getRange(1, 1, values.length, values[0].length).setValues(values);
}

function toDateNumber(dateStr) {
  const norm = normalizeDate(dateStr);
  if (!norm) return 0;
  const [y, m, d] = norm.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1).getTime();
}

function getAdminUsers() {
  return readSheetRows(SHEET_ADMIN).map((row) => ({
    username: asText(row.username),
    password: asText(row.password),
    nama: asText(row.nama || row.username),
    role: asText(row.role || "Admin")
  }));
}

function getDaftarSiswa(kelasFilter) {
  const rows = readSheetRows(SHEET_SISWA);
  return rows
    .filter((row) => {
      if (!kelasFilter) return true;
      return asText(row.kelas).toUpperCase() === String(kelasFilter).toUpperCase();
    })
    .map((row) => ({
      nomorQr: asText(row.nomorqr || row.nomorQr),
      barcode: asText(row.barcode || row.nomorqr || row.nomorQr),
      nama: asText(row.nama),
      kelas: asText(row.kelas)
    }));
}

function getPresensiRows() {
  return readSheetRows(SHEET_PRESENSI).map((row) => ({
    tanggal: asText(row.tanggal),
    jam: normalizeTime(row.jam),
    nomorQr: asText(row.nomorqr || row.nomorQr),
    nama: asText(row.nama),
    kelas: asText(row.kelas),
    status: asText(row.status),
    metode: asText(row.metode || "Scan"),
    keterangan: asText(row.keterangan)
  }));
}

function parseRequestBody(payload) {
  if (!payload) return {};
  if (typeof payload === "string") {
    try {
      return JSON.parse(payload);
    } catch (err) {
      return {};
    }
  }
  return payload;
}

function setupDefaultSheets() {
  ensureSheetStructure();

  const adminSheet = getSheetByName(SHEET_ADMIN);
  if (adminSheet.getLastRow() <= 1) {
    adminSheet.appendRow(["admin", "admin123", "Admin Utama", "Admin"]);
  }

  const pengunjungSheet = getSheetByName(SHEET_PENGUNJUNG);
  if (pengunjungSheet.getLastRow() <= 1) {
    pengunjungSheet.appendRow(["2408001", "2408001", "AFIFAH SYAHIRA FITRI", "8.G"]);
    pengunjungSheet.appendRow(["2408002", "2408002", "AFIQAH KHAIRUNNISA RIZALOV", "8.G"]);
    pengunjungSheet.appendRow(["2408003", "2408003", "ALFARIS ADRIAN AKBAR", "8.G"]);
  }
}

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      success: true,
      message: "Google Apps Script backend aktif.",
      spreadsheetId: SPREADSHEET_ID,
      sheets: [SHEET_ADMIN, SHEET_SISWA, SHEET_PRESENSI]
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  let response = { success: false, message: "Aksi tidak dikenali." };

  try {
    const rawBody = e && e.postData && e.postData.contents ? e.postData.contents : "{}";
    const body = parseRequestBody(rawBody);
    const action = asText(body.action);

    if (!action) {
      response = { success: false, message: "Parameter action tidak ditemukan." };
      return outputJson(response);
    }

    switch (action) {
      case "login": {
        const username = asText(body.username);
        const password = asText(body.password);

        if (!username || !password) {
          response = { success: false, message: "Username dan password wajib diisi." };
          break;
        }

        const matched = getAdminUsers().find((user) => {
          return user.username.toLowerCase() === username.toLowerCase() && user.password === password;
        });

        if (!matched) {
          response = { success: false, message: "Username atau password tidak cocok dengan data spreadsheet." };
          break;
        }

        const token = "gas_" + Utilities.getUuid();
        response = { success: true, username: matched.username, nama: matched.nama, role: matched.role || "Admin", token };
        break;
      }

      case "getAdminUsers": {
        response = { success: true, data: getAdminUsers() };
        break;
      }

      case "getDaftarSiswa": {
        const kelas = asText(body.kelas || "");
        response = { success: true, data: getDaftarSiswa(kelas) };
        break;
      }

      case "tambahSiswa": {
        const nomorQr = asText(body.nomorQr);
        const barcode = asText(body.barcode || body.nomorQr);
        const nama = asText(body.nama);
        const kelas = asText(body.kelas);

        if (!nomorQr || !nama || !kelas) {
          response = { success: false, message: "Nomor QR, nama, dan kelas wajib diisi." };
          break;
        }

        const sheet = getSheetByName(SHEET_SISWA);
        const rows = readSheetRows(SHEET_SISWA);
        const duplicate = rows.some((row) => {
          const existingQr = asText(row.nomorqr || row.nomorQr);
          const existingBarcode = asText(row.barcode || row.nomorqr || row.nomorQr);
          return existingQr === nomorQr || existingBarcode === barcode;
        });

        if (duplicate) {
          response = { success: false, message: "Nomor QR atau barcode sudah terdaftar." };
          break;
        }

        sheet.appendRow([nomorQr, barcode, nama, kelas]);
        response = { success: true };
        break;
      }

      case "editSiswa": {
        const nomorQr = asText(body.nomorQr);
        const barcode = asText(body.barcode || body.nomorQr);
        const nama = asText(body.nama);
        const kelas = asText(body.kelas);

        if (!nomorQr || !nama || !kelas) {
          response = { success: false, message: "Nomor QR, nama, dan kelas wajib diisi." };
          break;
        }

        const sheet = getSheetByName(SHEET_SISWA);
        const values = sheet.getDataRange().getValues();
        let found = false;

        for (let i = 1; i < values.length; i += 1) {
          const currentQr = asText(values[i][0]);
          if (currentQr === nomorQr) {
            sheet.getRange(i + 1, 1, 1, 4).setValues([[nomorQr, barcode, nama, kelas]]);
            found = true;
            break;
          }
        }

        response = found ? { success: true } : { success: false, message: "Data siswa tidak ditemukan." };
        break;
      }

      case "hapusSiswa": {
        const nomorQr = asText(body.nomorQr);
        const sheet = getSheetByName(SHEET_SISWA);
        const values = sheet.getDataRange().getValues();
        let deleted = false;

        for (let i = values.length - 1; i >= 1; i -= 1) {
          if (asText(values[i][0]) === nomorQr) {
            sheet.deleteRow(i + 1);
            deleted = true;
            break;
          }
        }

        response = deleted ? { success: true } : { success: false, message: "Data siswa tidak ditemukan." };
        break;
      }

      case "simpanPresensi": {
        const nomorQr = asText(body.nomorQr);
        const nama = asText(body.nama || "");
        const kelas = asText(body.kelas || "8.G");
        const tanggal = normalizeDate(body.tanggal || new Date());
        const jam = normalizeTime(body.jam || new Date());
        const status = asText(body.status || "Hadir");
        const metode = asText(body.metode || "Scan");
        const keterangan = asText(body.keterangan || "");

        if (!nomorQr) {
          response = { success: false, message: "Nomor QR wajib diisi." };
          break;
        }

        const sheet = getSheetByName(SHEET_PRESENSI);
        const existing = getPresensiRows().find((r) => {
          return normalizeDate(r.tanggal) === normalizeDate(tanggal) && asText(r.nomorQr) === nomorQr;
        });

        if (existing) {
          response = { success: false, message: `${nama || nomorQr} sudah tercatat presensi hari ini.` };
          break;
        }

        const row = [tanggal, jam, nomorQr, nama, kelas, status, metode, keterangan];
        sheet.appendRow(row);
        response = { success: true, nama: nama || nomorQr, status };
        break;
      }

      case "getRekapHarian": {
        const tanggal = normalizeDate(body.tanggal || new Date());
        const kelas = asText(body.kelas || "8.G");
        const records = getPresensiRows().filter((row) => {
          const sameDate = normalizeDate(row.tanggal) === normalizeDate(tanggal);
          const sameClass = asText(row.kelas).toUpperCase() === kelas.toUpperCase();
          return sameDate && sameClass;
        });

        let hadir = 0;
        let izin = 0;
        let sakit = 0;
        let alpa = 0;
        const log = [];

        records.forEach((row) => {
          const status = asText(row.status);
          if (status === "Hadir" || status === "Terlambat") hadir += 1;
          else if (status === "Izin") izin += 1;
          else if (status === "Sakit") sakit += 1;
          else if (status === "Alpa") alpa += 1;

          log.push({
            jam: row.jam,
            nomorQr: row.nomorQr,
            nama: row.nama,
            status,
            metode: row.metode || "Scan"
          });
        });

        log.sort((a, b) => (a.jam < b.jam ? 1 : -1));

        response = { success: true, data: { hadir, izin, sakit, alpa, log: log.slice(0, 15) } };
        break;
      }

      case "getRekapPeriode": {
        const mulai = normalizeDate(body.mulai || new Date());
        const selesai = normalizeDate(body.selesai || new Date());
        const kelas = asText(body.kelas || "8.G");
        const siswa = getDaftarSiswa(kelas);
        const records = getPresensiRows().filter((row) => {
          const rowDate = normalizeDate(row.tanggal);
          const sameClass = asText(row.kelas).toUpperCase() === kelas.toUpperCase();
          const inRange = rowDate >= mulai && rowDate <= selesai;
          return sameClass && inRange;
        });

        const rekap = {};
        siswa.forEach((item) => {
          rekap[item.nomorQr] = {
            nomorQr: item.nomorQr,
            nama: item.nama,
            hadir: 0,
            izin: 0,
            sakit: 0,
            alpa: 0,
            persenHadir: 0
          };
        });

        let totalHadir = 0;
        let totalIzin = 0;
        let totalSakit = 0;
        let totalAlpa = 0;

        records.forEach((record) => {
          const target = rekap[record.nomorQr];
          if (!target) return;

          const status = asText(record.status);
          if (status === "Hadir" || status === "Terlambat") {
            target.hadir += 1;
            totalHadir += 1;
          } else if (status === "Izin") {
            target.izin += 1;
            totalIzin += 1;
          } else if (status === "Sakit") {
            target.sakit += 1;
            totalSakit += 1;
          } else if (status === "Alpa") {
            target.alpa += 1;
            totalAlpa += 1;
          }
        });

        const perSiswa = Object.values(rekap).map((item) => {
          const totalTercatat = item.hadir + item.izin + item.sakit + item.alpa;
          const persenHadir = totalTercatat > 0 ? Math.round((item.hadir / totalTercatat) * 100) : 100;
          return { ...item, persenHadir };
        });

        perSiswa.sort((a, b) => a.nama.localeCompare(b.nama, "id"));

        response = {
          success: true,
          data: {
            totalHadir,
            totalIzin,
            totalSakit,
            totalAlpa,
            perSiswa
          }
        };
        break;
      }

      default:
        response = { success: false, message: `Aksi ${action} belum didukung pada backend.` };
    }
  } catch (err) {
    response = {
      success: false,
      message: err && err.message ? err.message : "Terjadi kesalahan saat memproses permintaan."
    };
  }

  return outputJson(response);
}

function outputJson(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
