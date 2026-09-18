// Google Apps Script backend untuk Presensi Digital 8.G
// Struktur Spreadsheet:
// 1. Admin    : Username | Password | Nama | Role
// 2. Siswa    : Nomor QR | Nama | Kelas
// 3. Presensi : ID | Tanggal | Jam | Nomor QR | Nama | Kelas | Status | Metode | Keterangan
//
// Setelah itu Deploy > New deployment > Web app > Anyone.

const SPREADSHEET_ID = "1IvcU5AgRMF4a9CiY8QnSuMAQMG9pvj_mJBv_bdQPnzo";
const SHEET_ADMIN = "Admin";
const SHEET_SISWA = "Siswa";
const SHEET_PRESENSI = "Presensi";
const JAM_BATAS_TERLAMBAT = "07:15";

const HEADERS = {
  Admin: ["Username", "Password", "Nama", "Role"],
  Siswa: ["Nomor QR", "Nama", "Kelas"],
  Presensi: ["ID", "Tanggal", "Jam", "Nomor QR", "Nama", "Kelas", "Status", "Metode", "Keterangan"]
};

function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getSheetByName(name) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  ensureHeaders(sheet, name);
  return sheet;
}

function ensureHeaders(sheet, name) {
  const headers = HEADERS[name];
  if (!headers) return;

  const current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const same = headers.every((h, i) => String(current[i] || "").trim() === h);

  if (!same) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  }
}

function asText(value) {
  return value == null ? "" : String(value).trim();
}

function normalizeDate(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value)) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }

  const raw = asText(value);
  if (!raw) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

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
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value)) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "HH:mm:ss");
  }

  const raw = asText(value).replace(/\./g, ":");
  if (!raw) return "";

  if (/^\d{1,2}:\d{2}$/.test(raw)) {
    const [h, m] = raw.split(":");
    return `${String(h).padStart(2, "0")}:${m}`;
  }

  if (/^\d{1,2}:\d{2}:\d{2}$/.test(raw)) {
    const [h, m, s] = raw.split(":");
    return `${String(h).padStart(2, "0")}:${m}:${s}`;
  }

  return raw;
}

function readSheetRows(sheetName) {
  const sheet = getSheetByName(sheetName);
  const lastRow = sheet.getLastRow();
  const lastColumn = HEADERS[sheetName].length;

  if (lastRow < 2) return [];

  const values = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
  const headers = values[0].map(h => asText(h).toLowerCase());

  return values.slice(1).map(row => {
    const obj = {};
    headers.forEach((header, idx) => {
      obj[header] = row[idx] ?? "";
    });
    return obj;
  });
}

function getAdminUsers() {
  return readSheetRows(SHEET_ADMIN).map(row => ({
    username: asText(row.username),
    password: asText(row.password),
    nama: asText(row.nama || row.username),
    role: asText(row.role || "Admin")
  }));
}

function getDaftarSiswa(kelasFilter) {
  return readSheetRows(SHEET_SISWA)
    .filter(row => {
      if (!kelasFilter) return true;
      return asText(row.kelas).toUpperCase() === String(kelasFilter).toUpperCase();
    })
    .map(row => ({
      nomorQr: asText(row["nomor qr"] || row.nomorqr),
      nama: asText(row.nama),
      kelas: asText(row.kelas)
    }));
}

function getPresensiRows() {
  return readSheetRows(SHEET_PRESENSI).map(row => ({
    id: asText(row.id),
    tanggal: normalizeDate(row.tanggal),
    jam: normalizeTime(row.jam),
    nomorQr: asText(row["nomor qr"] || row.nomorqr),
    nama: asText(row.nama),
    kelas: asText(row.kelas),
    status: asText(row.status),
    metode: asText(row.metode || "Scan"),
    keterangan: asText(row.keterangan)
  }));
}

function generatePresensiId() {
  const rows = getPresensiRows();
  let max = 0;

  rows.forEach(row => {
    const match = asText(row.id).match(/(\d+)$/);
    if (match) max = Math.max(max, Number(match[1]));
  });

  return String(max + 1).padStart(3, "0");
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

function doGet(e) {
  getSheetByName(SHEET_ADMIN);
  getSheetByName(SHEET_SISWA);
  getSheetByName(SHEET_PRESENSI);

  return outputJson({
    success: true,
    message: "Google Apps Script backend aktif.",
    sheets: [SHEET_ADMIN, SHEET_SISWA, SHEET_PRESENSI],
    headers: HEADERS
  });
}

function doPost(e) {
  let response = { success: false, message: "Aksi tidak dikenali." };

  try {
    const rawBody = e && e.postData && e.postData.contents ? e.postData.contents : "{}";
    const body = parseRequestBody(rawBody);
    const action = asText(body.action);

    if (!action) {
      return outputJson({
        success: false,
        message: "Parameter action tidak ditemukan."
      });
    }

    switch (action) {
      case "login": {
        const username = asText(body.username);
        const password = asText(body.password);

        if (!username || !password) {
          response = { success: false, message: "Username dan password wajib diisi." };
          break;
        }

        const matched = getAdminUsers().find(user =>
          user.username.toLowerCase() === username.toLowerCase() && user.password === password
        );

        if (!matched) {
          response = { success: false, message: "Username atau password tidak cocok dengan data spreadsheet." };
          break;
        }

        response = {
          success: true,
          username: matched.username,
          nama: matched.nama,
          role: matched.role,
          token: "gas_" + Utilities.getUuid()
        };
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

        const sheet = getSheetByName(SHEET_SISWA);
        const rows = getDaftarSiswa();
        const duplicate = rows.some(row => row.nomorQr.toLowerCase() === nomorQr.toLowerCase());

        if (duplicate) {
          response = { success: false, message: "Nomor QR sudah terdaftar." };
          break;
        }

        sheet.appendRow([nomorQr, nama, kelas]);
        response = { success: true };
        break;
      }

      case "editSiswa": {
        const nomorQrLama = asText(body.nomorQrLama || body.nomorQr);
        const nomorQr = asText(body.nomorQr);
        const nama = asText(body.nama);
        const kelas = asText(body.kelas);

        if (!nomorQr || !nama || !kelas) {
          response = { success: false, message: "Nomor QR, nama, dan kelas wajib diisi." };
          break;
        }

        const sheet = getSheetByName(SHEET_SISWA);
        const values = sheet.getDataRange().getValues();
        let found = false;

        for (let i = 1; i < values.length; i++) {
          if (asText(values[i][0]) === nomorQrLama) {
            sheet.getRange(i + 1, 1, 1, 3).setValues([[nomorQr, nama, kelas]]);
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

        for (let i = values.length - 1; i >= 1; i--) {
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
        let nama = asText(body.nama || "");
        let kelas = asText(body.kelas || "");

        const tanggal = normalizeDate(body.tanggal || new Date());
        const jam = normalizeTime(body.jam || new Date());
        let status = asText(body.status || "Hadir");
        const metode = asText(body.metode || "Scan");
        const keterangan = asText(body.keterangan || "");

        if (!nomorQr) {
          response = { success: false, message: "Nomor QR wajib diisi." };
          break;
        }

        const siswa = getDaftarSiswa().find(item => item.nomorQr.toLowerCase() === nomorQr.toLowerCase());

        if (siswa) {
          nama = siswa.nama;
          kelas = siswa.kelas;
        }

        if (!nama || !kelas) {
          response = { success: false, message: "Nomor QR belum terdaftar pada Data Siswa." };
          break;
        }

        if (status === "Hadir" && jam && jam.substring(0, 5) > JAM_BATAS_TERLAMBAT) {
          status = "Terlambat";
        }

        const sheet = getSheetByName(SHEET_PRESENSI);
        const existing = getPresensiRows().find(row =>
          normalizeDate(row.tanggal) === tanggal && asText(row.nomorQr).toLowerCase() === nomorQr.toLowerCase()
        );

        if (existing) {
          response = { success: false, message: `${nama} sudah tercatat presensi hari ini.`, existingId: existing.id };
          break;
        }

        const id = generatePresensiId();
        sheet.appendRow([id, tanggal, jam, nomorQr, nama, kelas, status, metode, keterangan]);

        response = { success: true, id, nama, kelas, status, metode };
        break;
      }

      case "getPresensi": {
        const tanggal = normalizeDate(body.tanggal || "");
        const kelas = asText(body.kelas || "");

        let data = getPresensiRows();

        if (tanggal) {
          data = data.filter(row => row.tanggal === tanggal);
        }

        if (kelas) {
          data = data.filter(row => row.kelas.toUpperCase() === kelas.toUpperCase());
        }

        response = { success: true, data };
        break;
      }

      case "getRekapHarian": {
        const tanggal = normalizeDate(body.tanggal || new Date());
        const kelas = asText(body.kelas || "8.G");

        const records = getPresensiRows().filter(row =>
          normalizeDate(row.tanggal) === tanggal && asText(row.kelas).toUpperCase() === kelas.toUpperCase()
        );

        let hadir = 0;
        let izin = 0;
        let sakit = 0;
        let alpa = 0;
        const log = [];

        records.forEach(row => {
          const status = asText(row.status);

          if (status === "Hadir" || status === "Terlambat") hadir++;
          else if (status === "Izin") izin++;
          else if (status === "Sakit") sakit++;
          else if (status === "Alpa") alpa++;

          log.push({
            id: row.id,
            tanggal: row.tanggal,
            jam: row.jam,
            nomorQr: row.nomorQr,
            nama: row.nama,
            kelas: row.kelas,
            status,
            metode: row.metode || "Scan",
            keterangan: row.keterangan
          });
        });

        log.sort((a, b) => (a.jam < b.jam ? 1 : -1));

        response = {
          success: true,
          data: { hadir, izin, sakit, alpa, log: log.slice(0, 15) }
        };
        break;
      }

      case "getRekapPeriode": {
        const mulai = normalizeDate(body.mulai || new Date());
        const selesai = normalizeDate(body.selesai || new Date());
        const kelas = asText(body.kelas || "8.G");

        const siswa = getDaftarSiswa(kelas);
        const records = getPresensiRows().filter(row => {
          const rowDate = normalizeDate(row.tanggal);
          return asText(row.kelas).toUpperCase() === kelas.toUpperCase() && rowDate >= mulai && rowDate <= selesai;
        });

        const rekap = {};

        siswa.forEach(item => {
          rekap[item.nomorQr] = {
            nomorQr: item.nomorQr,
            nama: item.nama,
            kelas: item.kelas,
            hadir: 0,
            izin: 0,
            sakit: 0,
            alpa: 0,
            terlambat: 0,
            persenHadir: 0
          };
        });

        let totalHadir = 0;
        let totalIzin = 0;
        let totalSakit = 0;
        let totalAlpa = 0;

        records.forEach(record => {
          const target = rekap[record.nomorQr];
          if (!target) return;

          const status = asText(record.status);

          if (status === "Hadir") {
            target.hadir++;
            totalHadir++;
          } else if (status === "Terlambat") {
            target.hadir++;
            target.terlambat++;
            totalHadir++;
          } else if (status === "Izin") {
            target.izin++;
            totalIzin++;
          } else if (status === "Sakit") {
            target.sakit++;
            totalSakit++;
          } else if (status === "Alpa") {
            target.alpa++;
            totalAlpa++;
          }
        });

        const perSiswa = Object.values(rekap).map(item => {
          const totalTercatat = item.hadir + item.izin + item.sakit + item.alpa;
          item.persenHadir = totalTercatat > 0 ? Math.round((item.hadir / totalTercatat) * 100) : 100;
          return item;
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
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
