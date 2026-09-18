// Google Apps Script backend untuk Presensi Digital 8.G
// 1. Buat spreadsheet baru atau gunakan spreadsheet yang sama.
// 2. Pastikan sheet bernama: Admin, Data Siswa, Presensi
// 3. Deploy sebagai Web App: "Anyone" dengan akses ke aplikasi
// 4. Salin URL hasil deploy ke pengaturan aplikasi web di Settings
//
// Catatan: ganti SPREADSHEET_ID di bawah dengan ID spreadsheet Anda.

const SPREADSHEET_ID = "1IvcU5AgRMF4a9CiY8QnSuMAQMG9pvj_mJBv_bdQPnzo";
const SHEET_ADMIN = "Admin";
const SHEET_DATA_SISWA = "Data Siswa";
const SHEET_PRESENSI = "Presensi";
const JAM_BATAS_TERLAMBAT = "07:15";

const SHEET_CONFIG = {
  [SHEET_ADMIN]: {
    names: [SHEET_ADMIN],
    headers: ["Username", "Password", "Nama", "Role"]
  },
  [SHEET_DATA_SISWA]: {
    names: [SHEET_DATA_SISWA],
    headers: ["Nomor QR", "Nama", "Kelas"]
  },
  [SHEET_PRESENSI]: {
    names: [SHEET_PRESENSI],
    headers: ["ID", "Tanggal", "Jam", "Nomor QR", "Nama", "Kelas", "Status", "Metode", "Keterangan"]
  }
};

function getSpreadsheet() {
  if (!SPREADSHEET_ID || SPREADSHEET_ID === "PASTE_SPREADSHEET_ID_HERE") {
    throw new Error("SPREADSHEET_ID belum diisi.");
  }
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getSheetByName(name) {
  const config = SHEET_CONFIG[name];
  if (!config) {
    throw new Error("Nama sheet tidak dikenal: " + name);
  }

  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }

  const headers = config.headers;
  const firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0] || [];
  const needsHeader = headers.some((header, idx) => asText(firstRow[idx]) !== header);

  if (needsHeader) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");

  if (name === SHEET_PRESENSI) {
    sheet.getRange("D:D").setNumberFormat("@"); // Format teks untuk Nomor QR (kolom ke-4)
  } else if (name === SHEET_DATA_SISWA) {
    sheet.getRange("A:A").setNumberFormat("@"); // Format teks untuk Nomor QR
  }

  return sheet;
}

function ensureSheetStructure() {
  getSheetByName(SHEET_ADMIN);
  getSheetByName(SHEET_DATA_SISWA);
  getSheetByName(SHEET_PRESENSI);
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
  const sheet = ss.getSheetByName(sheetName);

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

function getAdminUsers() {
  return readSheetRows(SHEET_ADMIN).map((row) => ({
    username: asText(row.username),
    password: asText(row.password),
    nama: asText(row.nama || row.username),
    role: asText(row.role || "Admin")
  }));
}

function getDaftarSiswa(kelasFilter) {
  const rows = readSheetRows(SHEET_DATA_SISWA).map((row) => ({
    nomorQr: asText(row["nomor qr"] || row.nomorqr || row.nomorQr),
    nama: asText(row.nama),
    kelas: asText(row.kelas)
  }));

  if (!kelasFilter) {
    return rows;
  }

  return rows.filter((item) => item.kelas.toUpperCase() === kelasFilter.toUpperCase());
}

function getPresensiRows() {
  return readSheetRows(SHEET_PRESENSI).map((row) => ({
    id: asText(row.id),
    tanggal: asText(row.tanggal),
    jam: normalizeTime(row.jam),
    nomorQr: asText(row["nomor qr"] || row.nomorqr || row.nomorQr),
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
}

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      success: true,
      message: "Google Apps Script backend aktif.",
      spreadsheetId: SPREADSHEET_ID,
      sheets: [SHEET_ADMIN, SHEET_DATA_SISWA, SHEET_PRESENSI]
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
        const nama = asText(body.nama);
        const kelas = asText(body.kelas);

        if (!nomorQr || !nama || !kelas) {
          response = { success: false, message: "Nomor QR, nama, dan kelas wajib diisi." };
          break;
        }

        const sheet = getSheetByName(SHEET_DATA_SISWA);
        const siswaList = getDaftarSiswa();
        const exists = siswaList.some((s) => s.nomorQr === nomorQr);

        if (exists) {
          response = { success: false, message: "Nomor QR sudah terdaftar pada siswa lain." };
          break;
        }

        sheet.appendRow([nomorQr, nama, kelas]);
        response = { success: true, message: "Data siswa berhasil ditambahkan." };
        break;
      }

      case "editSiswa": {
        const nomorQr = asText(body.nomorQr);
        const nama = asText(body.nama);
        const kelas = asText(body.kelas);

        if (!nomorQr || !nama || !kelas) {
          response = { success: false, message: "Nomor QR, nama, dan kelas wajib diisi." };
          break;
        }

        const sheet = getSheetByName(SHEET_DATA_SISWA);
        const dataRange = sheet.getDataRange().getValues();
        let found = false;

        for (let i = 1; i < dataRange.length; i++) {
          if (String(dataRange[i][0]).trim() === nomorQr) {
            sheet.getRange(i + 1, 2).setValue(nama);
            sheet.getRange(i + 1, 3).setValue(kelas);
            found = true;
            break;
          }
        }

        if (!found) {
          response = { success: false, message: "Data siswa dengan Nomor QR tersebut tidak ditemukan." };
          break;
        }

        response = { success: true, message: "Data siswa berhasil diperbarui." };
        break;
      }

      case "hapusSiswa": {
        const nomorQr = asText(body.nomorQr);

        if (!nomorQr) {
          response = { success: false, message: "Nomor QR wajib diisi." };
          break;
        }

        const sheet = getSheetByName(SHEET_DATA_SISWA);
        const dataRange = sheet.getDataRange().getValues();
        let foundIndex = -1;

        for (let i = 1; i < dataRange.length; i++) {
          if (String(dataRange[i][0]).trim() === nomorQr) {
            foundIndex = i + 1;
            break;
          }
        }

        if (foundIndex === -1) {
          response = { success: false, message: "Data siswa tidak ditemukan." };
          break;
        }

        sheet.deleteRow(foundIndex);
        response = { success: true, message: "Data siswa berhasil dihapus." };
        break;
      }

      case "simpanPresensi": {
        const id = asText(body.id || "");
        const nomorQr = asText(body.nomorQr);
        let nama = asText(body.nama);
        let kelas = asText(body.kelas);
        const tanggal = normalizeDate(body.tanggal || new Date());
        const jam = normalizeTime(body.jam || new Date());
        let status = asText(body.status || "Hadir");
        const metode = asText(body.metode || "Scan");
        const keterangan = asText(body.keterangan || "");

        if (!nomorQr) {
          response = { success: false, message: "Nomor QR wajib diisi." };
          break;
        }

        // Jika nama/kelas kosong dari frontend, cari otomatis dari sheet Data Siswa
        if (!nama || !kelas) {
          const matchedSiswa = getDaftarSiswa().find((s) => s.nomorQr === nomorQr);
          if (matchedSiswa) {
            nama = nama || matchedSiswa.nama;
            kelas = kelas || matchedSiswa.kelas;
          }
        }

        nama = nama || "Tidak Diketahui";
        kelas = kelas || "8.G";

        if (status === "Hadir" && jam && jam.substring(0, 5) > JAM_BATAS_TERLAMBAT) {
          status = "Terlambat";
        }

        const sheet = getSheetByName(SHEET_PRESENSI);
        const existing = getPresensiRows().find((r) => {
          return normalizeDate(r.tanggal) === normalizeDate(tanggal) && asText(r.nomorQr) === nomorQr;
        });

        if (existing) {
          response = { success: false, message: `${nama || nomorQr} sudah tercatat presensi hari ini.` };
          break;
        }

        const row = [id, tanggal, jam, nomorQr, nama, kelas, status, metode, keterangan];
        sheet.appendRow(row);
        response = { success: true, id, tanggal, jam, nomorQr, nama, kelas, status, metode, keterangan };
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
            id: row.id,
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