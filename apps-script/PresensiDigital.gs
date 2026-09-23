// Google Apps Script backend untuk Presensi Digital 8.G
const SPREADSHEET_ID = "1IvcU5AgRMF4a9CiY8QnSuMAQMG9pvj_mJBv_bdQPnzo";
const SHEET_ADMIN = "Admin";
const SHEET_DATA_SISWA = "Siswa"; // DIUBAH menjadi "Siswa" agar cocok dengan fungsi helper
const SHEET_PRESENSI = "Presensi";
const JAM_BATAS_TERLAMBAT = "07:15";

// --- KONFIGURASI WHATSAPP GATEWAY ---
const WA_TOKEN = "JhoAvrvGXDPYWGRMX7Ng"; 
const WA_URL = "https://api.fonnte.com/send";

function getSpreadsheet() {
  if (!SPREADSHEET_ID) {
    throw new Error("Spreadsheet ID tidak ditemukan.");
  }
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function asText(value) {
  return value == null ? "" : String(value).trim();
}

function normalizeDate(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone() || "GMT+7", "yyyy-MM-dd");
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
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone() || "GMT+7", "HH:mm:ss");
  }
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
    kelas: asText(row.kelas),
    noOrtu: asText(row["no_ortu"] || row["nohp"] || row["notelepon"]) // Ambil juga jika ada kolom no_ortu
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
    keterangan: asText(row.keterangan),
    mapel: asText(row.mapel),
    guru: asText(row.guru)
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

      case "getRekapHarian": {
        const tanggal = normalizeDate(body.tanggal || new Date());
        const kelasFilter = asText(body.kelas || "");

        const rows = getPresensiRows().filter((r) => {
          const cocokTanggal = normalizeDate(r.tanggal) === tanggal;
          const cocokKelas = !kelasFilter || r.kelas.toUpperCase() === kelasFilter.toUpperCase();
          return cocokTanggal && cocokKelas;
        });

        let hadir = 0, izin = 0, sakit = 0, alpa = 0;
        rows.forEach((r) => {
          if (r.status === "Hadir" || r.status === "Terlambat") hadir++;
          else if (r.status === "Izin") izin++;
          else if (r.status === "Sakit") sakit++;
          else if (r.status === "Alpa") alpa++;
        });

        const log = rows
          .map((r) => ({ jam: r.jam, nomorQr: r.nomorQr, nama: r.nama, status: r.status, metode: r.metode }))
          .sort((a, b) => (a.jam < b.jam ? 1 : a.jam > b.jam ? -1 : 0));

        response = { success: true, data: { hadir, izin, sakit, alpa, log } };
        break;
      }

      case "getRekapPeriode": {
        const mulai = normalizeDate(body.mulai);
        const selesai = normalizeDate(body.selesai || body.mulai);
        const kelasFilter = asText(body.kelas || "");

        const rows = getPresensiRows().filter((r) => {
          const tgl = normalizeDate(r.tanggal);
          const dalamRentang = (!mulai || tgl >= mulai) && (!selesai || tgl <= selesai);
          const cocokKelas = !kelasFilter || r.kelas.toUpperCase() === kelasFilter.toUpperCase();
          return dalamRentang && cocokKelas;
        });

        const daftarSiswa = getDaftarSiswa(kelasFilter);
        const perSiswaMap = {};
        daftarSiswa.forEach((s) => {
          perSiswaMap[s.nomorQr] = { nomorQr: s.nomorQr, nama: s.nama, hadir: 0, izin: 0, sakit: 0, alpa: 0 };
        });

        let totalHadir = 0, totalIzin = 0, totalSakit = 0, totalAlpa = 0;

        rows.forEach((r) => {
          if (!perSiswaMap[r.nomorQr]) {
            perSiswaMap[r.nomorQr] = { nomorQr: r.nomorQr, nama: r.nama, hadir: 0, izin: 0, sakit: 0, alpa: 0 };
          }
          const target = perSiswaMap[r.nomorQr];
          if (r.status === "Hadir" || r.status === "Terlambat") { target.hadir++; totalHadir++; }
          else if (r.status === "Izin") { target.izin++; totalIzin++; }
          else if (r.status === "Sakit") { target.sakit++; totalSakit++; }
          else if (r.status === "Alpa") { target.alpa++; totalAlpa++; }
        });

        const perSiswa = Object.keys(perSiswaMap).map((qr) => {
          const s = perSiswaMap[qr];
          const totalTercatat = s.hadir + s.izin + s.sakit + s.alpa;
          const persenHadir = totalTercatat > 0 ? Math.round((s.hadir / totalTercatat) * 100) : 0;
          return Object.assign({}, s, { persenHadir: persenHadir });
        });

        response = {
          success: true,
          data: { totalHadir: totalHadir, totalIzin: totalIzin, totalSakit: totalSakit, totalAlpa: totalAlpa, perSiswa: perSiswa }
        };
        break;
      }

      case "tambahSiswa": {
        const nomorQr = asText(body.nomorQr);
        const nama = asText(body.nama);
        const kelas = asText(body.kelas);
        // Opsional: ambil no_ortu jika dikirim dari frontend
        const noOrtu = asText(body.noOrtu || ""); 
        
        if (!nomorQr || !nama || !kelas) {
          response = { success: false, message: "Data tidak lengkap." };
          break;
        }

        const sheet = getSpreadsheet().getSheetByName(SHEET_DATA_SISWA);
        // Urutan: NomorQR, Nama, Kelas, No_Ortu
        sheet.appendRow([nomorQr, nama, kelas, noOrtu]);
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
            // Update No Ortu jika ada (Kolom D = index 4)
            if (body.noOrtu !== undefined) {
               sheet.getRange(i + 1, 4).setValue(asText(body.noOrtu));
            }
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
        const tanggal = normalizeDate(body.tanggal || new Date());
        const jam = normalizeTime(body.jam || new Date());
        let status = asText(body.status || "Hadir");
        const metode = asText(body.metode || "Scan");
        const keterangan = asText(body.keterangan || "");

        if (!nomorQr) {
          response = { success: false, message: "Nomor QR wajib diisi." };
          break;
        }

        const daftarSiswa = getDaftarSiswa();
        const cleanTargetQr = nomorQr.toLowerCase();
        const matchedSiswa = daftarSiswa.find((s) => s.nomorQr.toLowerCase() === cleanTargetQr);

        if (!matchedSiswa) {
          response = { success: false, message: `Nomor QR "${nomorQr}" tidak terdaftar di Data Siswa.` };
          break;
        }

        const nama = matchedSiswa.nama || "Tidak Diketahui";
        const kelas = matchedSiswa.kelas || "8.G";
        
        // Ambil nomor ortu dari hasil query siswa (jika ada di sheet)
        const noOrtuDariSheet = matchedSiswa.noOrtu || "";

        const sudahPresensiHariIni = getPresensiRows().some((r) => {
          return r.nomorQr.toLowerCase() === cleanTargetQr && normalizeDate(r.tanggal) === tanggal;
        });

        if (sudahPresensiHariIni) {
          response = {
            success: true,
            duplicate: true,
            message: `${nama} sudah tercatat presensi hari ini.`,
            nama: nama,
            kelas: kelas,
            status: status
          };
          break;
        }

        if (status === "Hadir" && jam && jam.substring(0, 5) > JAM_BATAS_TERLAMBAT) {
          status = "Terlambat";
        }

        const sheet = getSpreadsheet().getSheetByName(SHEET_PRESENSI);
        sheet.appendRow([id, tanggal, jam, nomorQr, nama, kelas, status, metode, keterangan]);
        
        response = { success: true, message: "Presensi disimpan.", nama: nama, kelas: kelas, status: status };

        // --- KIRIM NOTIFIKASI WA ---
        // Kirim jika status Hadir/Terlambat dan ada nomor ortu
        if ((status === "Hadir" || status === "Terlambat") && noOrtuDariSheet) {
           kirimWaOrtu(nama, status, noOrtuDariSheet, jam.substring(0,5));
        } else if ((status === "Hadir" || status === "Terlambat") && !noOrtuDariSheet) {
           Logger.log("Gagal kirim WA: Nomor orang tua untuk " + nama + " tidak ditemukan di sheet.");
        }
        
        break;
      }

      case "simpanPresensiMapel": {
        const mapel = asText(body.mapel);
        const guru = asText(body.guru) || "Guru";
        const tanggal = normalizeDate(body.tanggal || new Date());
        const jam = normalizeTime(body.jam || new Date());
        const kelasDefault = asText(body.kelas) || "8.G";
        const records = Array.isArray(body.records) ? body.records : [];

        if (!mapel) {
          response = { success: false, message: "Mata pelajaran wajib dipilih." };
          break;
        }
        if (records.length === 0) {
          response = { success: false, message: "Tidak ada data siswa untuk disimpan." };
          break;
        }

        const daftarSiswa = getDaftarSiswa();
        const siswaMap = {};
        daftarSiswa.forEach((s) => { siswaMap[s.nomorQr.toLowerCase()] = s; });

        const rowsToInsert = [];
        const dilewati = [];

        records.forEach((rec, idx) => {
          const nomorQr = asText(rec.nomorQr);
          if (!nomorQr) return;

          const matched = siswaMap[nomorQr.toLowerCase()];
          if (!matched) {
            dilewati.push(nomorQr);
            return;
          }

          const status = asText(rec.status || "Hadir");
          const keterangan = asText(rec.keterangan || "");
          const id = "PM-" + Date.now() + "-" + idx;

          rowsToInsert.push([
            id, tanggal, jam, nomorQr, matched.nama, matched.kelas || kelasDefault,
            status, "Observasi", keterangan, mapel, guru
          ]);
          
          // Opsional: Kirim WA juga untuk presensi Mapel jika diinginkan
          // if ((status === "Hadir" || status === "Terlambat") && matched.noOrtu) {
          //    kirimWaOrtu(matched.nama, status + " (" + mapel + ")", matched.noOrtu, jam.substring(0,5));
          // }
        });

        if (rowsToInsert.length > 0) {
          const sheet = getSpreadsheet().getSheetByName(SHEET_PRESENSI);
          sheet.getRange(sheet.getLastRow() + 1, 1, rowsToInsert.length, rowsToInsert[0].length)
            .setValues(rowsToInsert);
        }

        let message = `Presensi mapel "${mapel}" tersimpan untuk ${rowsToInsert.length} siswa.`;
        if (dilewati.length > 0) {
          message += ` (${dilewati.length} nomor QR tidak dikenali dilewati)`;
        }

        response = {
          success: true,
          message: message,
          saved: rowsToInsert.length,
          skipped: dilewati
        };
        break;
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

// --- FUNGSI KIRIM WHATSAPP ---
function kirimWaOrtu(namaSiswa, status, noOrtu, waktu) {
  if (!noOrtu) return;

  // Format nomor: pastikan dimulai dengan 62
  if (noOrtu.startsWith("0")) {
    noOrtu = "62" + noOrtu.substring(1);
  }
  
  var pesan = `Yth. Wali Murid,\n\nAnak Anda *${namaSiswa}* telah melakukan presensi *\${status}* pada jam ${waktu}.\n\nTerima kasih.\n- Class Digital SMPN 18 Padang`;

  var payload = {
    'target': noOrtu,
    'message': pesan,
    'countryCode': '62'
  };

  var options = {
    'method': 'post',
    'headers': {
      'Authorization': WA_TOKEN
    },
    'payload': payload,
    'mute': true 
  };

  try {
    var response = UrlFetchApp.fetch(WA_URL, options);
    Logger.log("WA terkirim ke " + noOrtu + ": " + response.getContentText());
  } catch (e) {
    Logger.log("Gagal kirim WA ke " + noOrtu + ": " + e.toString());
  }
}

// Fungsi helper tambahan jika ingin mencari manual (tidak digunakan langsung jika data sudah diambil di getDaftarSiswa)
function getNomorOrtu(nisCari) {
  var ss = getSpreadsheet();
  var sheetSiswa = ss.getSheetByName(SHEET_DATA_SISWA); 
  
  if (!sheetSiswa) return null;
  
  var data = sheetSiswa.getDataRange().getValues();
  
  for (var i = 1; i < data.length; i++) { 
    var nisData = String(data[i][0]).trim(); 
    
    if (nisData == String(nisCari).trim()) {
      var noHp = String(data[i][3]).trim(); // Kolom D (Index 3)
      if (noHp.startsWith("0")) {
        noHp = "62" + noHp.substring(1);
      }
      return noHp;
    }
  }
  return null;
}