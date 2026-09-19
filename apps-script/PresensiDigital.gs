// Google Apps Script backend untuk Presensi Digital 8.G
const SPREADSHEET_ID = "1IvcU5AgRMF4a9CiY8QnSuMAQMG9pvj_mJBv_bdQPnzo";
const SHEET_ADMIN = "Admin";
const SHEET_DATA_SISWA = "Data Siswa";
const SHEET_PRESENSI = "Presensi";
const JAM_BATAS_TERLAMBAT = "07:15";

function getSpreadsheet() {
  if (!SPREADSHEET_ID) {
    throw new Error("1IvcU5AgRMF4a9CiY8QnSuMAQMG9pvj_mJBv_bdQPnzo");
  }
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function asText(value) {
  return value == null ? "" : String(value).trim();
}

function normalizeDate(value) {
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
  const raw = asText(value).replace(/\./g, ":");
  if (!raw) return "";
  if (/^\d{1,2}:\d{2}$/.test(raw)) {
    const [h, m] = raw.split(":");
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  return raw;
}

function readSheetRows(sheetName) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];

  const values = sheet.getDataRange().getValues();
  if (!values || values.length < 2) return [];

  // Mengubah header menjadi huruf kecil dan menghilangkan spasi agar aman dari variasi penulisan kapital
  const headers = values[0].map((header) => asText(header).toLowerCase().replace(/\s+/g, ""));
  return values.slice(1).map((row) => {
    const rowObj = {};
    headers.forEach((header, idx) => {
      rowObj[header] = row[idx] ?? "";
    });
    return rowObj;
  });
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
    nomorQr: asText(row["nomorqr"] || row["noqr"] || row["nomorqr"]),
    nama: asText(row.nama),
    kelas: asText(row.kelas)
  }));

  if (!kelasFilter) return rows;
  return rows.filter((item) => item.kelas.toUpperCase() === kelasFilter.toUpperCase());
}

function getPresensiRows() {
  return readSheetRows(SHEET_PRESENSI).map((row) => ({
    id: asText(row.id),
    tanggal: asText(row.tanggal),
    jam: normalizeTime(row.jam),
    nomorQr: asText(row["nomorqr"] || row["noqr"]),
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
        const matched = getAdminUsers().find((user) => {
          return user.username.toLowerCase() === username.toLowerCase() && user.password === password;
        });

        if (!matched) {
          response = { success: false, message: "Username atau password salah." };
          break;
        }

        const token = "gas_" + Utilities.getUuid();
        response = { success: true, username: matched.username, nama: matched.nama, role: matched.role || "Admin", token };
        break;
      }

      case "getAdminUsers":
        response = { success: true, data: getAdminUsers() };
        break;

      case "getDaftarSiswa":
        response = { success: true, data: getDaftarSiswa(asText(body.kelas || "")) };
        break;

      case "tambahSiswa": {
        const nomorQr = asText(body.nomorQr);
        const nama = asText(body.nama);
        const kelas = asText(body.kelas);
        if (!nomorQr || !nama || !kelas) {
          response = { success: false, message: "Data tidak lengkap." };
          break;
        }

        const sheet = getSpreadsheet().getSheetByName(SHEET_DATA_SISWA);
        sheet.appendRow([nomorQr, nama, kelas]);
        response = { success: true, message: "Siswa berhasil ditambahkan." };
        break;
      }

      case "editSiswa": {
        const nomorQr = asText(body.nomorQr);
        const nama = asText(body.nama);
        const kelas = asText(body.kelas);
        const sheet = getSpreadsheet().getSheetByName(SHEET_DATA_SISWA);
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

        response = found ? { success: true, message: "Siswa diperbarui." } : { success: false, message: "Siswa tidak ditemukan." };
        break;
      }

      case "hapusSiswa": {
        const nomorQr = asText(body.nomorQr);
        const sheet = getSpreadsheet().getSheetByName(SHEET_DATA_SISWA);
        const dataRange = sheet.getDataRange().getValues();
        let foundIndex = -1;

        for (let i = 1; i < dataRange.length; i++) {
          if (String(dataRange[i][0]).trim() === nomorQr) {
            foundIndex = i + 1;
            break;
          }
        }

        if (foundIndex !== -1) {
          sheet.deleteRow(foundIndex);
          response = { success: true, message: "Siswa dihapus." };
        } else {
          response = { success: false, message: "Siswa tidak ditemukan." };
        }
        break;
      }

      case "simpanPresensi": {
        let id = asText(body.id);
        if (!id) {
          id = "P-" + Math.random().toString(36).substring(2, 9).toUpperCase();
        }
        
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

        if (!nama || !kelas || nama === "Tidak Diketahui") {
          const daftarSiswa = getDaftarSiswa();
          const cleanTargetQr = nomorQr.toLowerCase();
          const matchedSiswa = daftarSiswa.find((s) => s.nomorQr.toLowerCase() === cleanTargetQr);
          
          if (matchedSiswa) {
            nama = nama && nama !== "Tidak Diketahui" ? nama : matchedSiswa.nama;
            kelas = kelas && kelas !== "8.G" ? kelas : matchedSiswa.kelas;
          }
        }

        nama = nama || "Tidak Diketahui";
        kelas = kelas || "8.G";

        if (status === "Hadir" && jam && jam.substring(0, 5) > JAM_BATAS_TERLAMBAT) {
          status = "Terlambat";
        }

        const sheet = getSpreadsheet().getSheetByName(SHEET_PRESENSI);
        sheet.appendRow([id, tanggal, jam, nomorQr, nama, kelas, status, metode, keterangan]);
        response = { success: true, message: "Presensi disimpan." };
      }
    }
  } catch (err) {
    response = { success: false, message: err.message };
  }

  return outputJson(response);
}

function outputJson(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}