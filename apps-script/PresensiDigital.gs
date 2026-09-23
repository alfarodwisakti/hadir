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
  // Sel tanggal yang ditulis lewat appendRow sering otomatis dikonversi Google
  // Sheets menjadi tipe Date asli saat dibaca kembali (bukan lagi teks). Kalau
  // ini tidak ditangani, perbandingan tanggal di getRekapHarian/getRekapPeriode
  // akan selalu gagal cocok dan rekap tampil 0 terus meski datanya ada.
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
  // Sama seperti tanggal, kolom Jam juga bisa terbaca sebagai objek Date/Time
  // asli, bukan teks "HH:mm:ss".
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
        const tanggal = normalizeDate(body.tanggal || new Date());
        const jam = normalizeTime(body.jam || new Date());
        let status = asText(body.status || "Hadir");
        const metode = asText(body.metode || "Scan");
        const keterangan = asText(body.keterangan || "");

        if (!nomorQr) {
          response = { success: false, message: "Nomor QR wajib diisi." };
          break;
        }

        // Wajib cocok dengan data di sheet "Data Siswa". Barcode/QR yang tidak
        // terdaftar akan DITOLAK dan tidak pernah dicatat sebagai kehadiran.
        const daftarSiswa = getDaftarSiswa();
        const cleanTargetQr = nomorQr.toLowerCase();
        const matchedSiswa = daftarSiswa.find((s) => s.nomorQr.toLowerCase() === cleanTargetQr);

        if (!matchedSiswa) {
          response = { success: false, message: `Nomor QR "${nomorQr}" tidak terdaftar di Data Siswa.` };
          break;
        }

        const nama = matchedSiswa.nama || "Tidak Diketahui";
        const kelas = matchedSiswa.kelas || "8.G";

        // Cegah dobel catat: kalau siswa ini sudah punya baris presensi untuk
        // tanggal yang sama, jangan tambah baris baru — beri tahu frontend
        // lewat flag "duplicate" supaya bisa ditampilkan notifikasi khusus
        // ("sudah terpresensi"), bukan dianggap gagal ataupun dicatat dua kali.
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
        // Kirim balik nama/kelas/status asli agar frontend tidak menampilkan
        // fallback generik "Siswa".
        response = { success: true, message: "Presensi disimpan.", nama: nama, kelas: kelas, status: status };
        break;
      }

      case "simpanPresensiMapel": {
        // Presensi berbasis observasi guru per mata pelajaran. Satu kali submit
        // menyimpan seluruh baris siswa sekaligus (1 kali panggilan server),
        // dan dianggap "divalidasi" karena guru sudah mencentang konfirmasi
        // di aplikasi sebelum mengirim.
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
        });

        if (rowsToInsert.length > 0) {
          const sheet = getSpreadsheet().getSheetByName(SHEET_PRESENSI);
          sheet.getRange(sheet.getLastRow() + 1, 1, rowsToInsert.length, rowsToInsert[0].length)
            .setValues(rowsToInsert);
        }

        let message = `Presensi mapel "${mapel}" tersimpan untuk ${rowsToInsert.length} siswa.`;
        if (dilewati.length > 0) {
          message += ` (${dilewati.length} nomor QR tidak dikenali dilewati: ${dilewati.join(", ")})`;
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
}// Fungsi untuk mengirim WA via Gateway (Contoh menggunakan Fonnte/Wablas)
function kirimWaOrtu(namaSiswa, status, noOrtu, waktu) {
  // GANTI DENGAN TOKEN DARI PENYEDIA LAYANAN ANDA
  var token = "TOKEN_API_ANDA_DISINI"; 
  var urlGateway = "https://api.fonnte.com/send"; // Atau URL penyedia lain
  
  var pesan = `Yth. Wali Murid,\n\nAnak Anda *${namaSiswa}* telah melakukan presensi *\${status}* pada jam ${waktu}.\n\nTerima kasih.\n- Class Digital SMPN 18 Padang`;

  var payload = {
    'target': noOrtu,
    'message': pesan,
    // 'countryCode': '62' // Tergantung dokumentasi provider
  };

  var options = {
    'method': 'post',
    'headers': {
      'Authorization': token // Atau 'Content-Type': 'application/json' tergantung provider
    },
    'payload': payload,
    'mute': true // Supaya tidak error jika gagal
  };

  try {
    UrlFetchApp.fetch(urlGateway, options);
    Logger.log("WA terkirim ke " + noOrtu);
  } catch (e) {
    Logger.log("Gagal kirim WA: " + e.toString());
  }
}