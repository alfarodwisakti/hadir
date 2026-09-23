// Google Apps Script backend untuk Presensi Digital 8.G
const SPREADSHEET_ID = "1IvcU5AgRMF4a9CiY8QnSuMAQMG9pvj_mJBv_bdQPnzo";
const SHEET_ADMIN = "Admin";
const SHEET_DATA_SISWA = "Siswa"; // PASTIKAN nama tab di Google Sheet persis "Siswa" (cek juga catatan di bawah)
const SHEET_PRESENSI = "Presensi";
const JAM_BATAS_TERLAMBAT = "07:15";

// --- KONFIGURASI WHATSAPP GATEWAY (Fonnte) ---
// Disarankan pindahkan token ini ke Project Settings > Script Properties
// (key: WA_TOKEN) supaya tidak tertulis polos di source code. Kalau belum
// diset di Script Properties, kode ini otomatis pakai nilai fallback di bawah.
const WA_TOKEN = PropertiesService.getScriptProperties().getProperty("WA_TOKEN") || "JhoAvrvGXDPYWGRMX7Ng";
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

  // Normalisasi header: huruf kecil + hapus SEMUA karakter non-alfanumerik
  // (spasi, underscore, strip, dll disamakan). Jadi "No Ortu", "No_Ortu",
  // "no-ortu" semuanya jadi kunci yang sama: "noortu".
  const headers = values[0].map((header) => asText(header).toLowerCase().replace(/[^a-z0-9]/g, ""));
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
  const rows = readSheetRows(SHEET_DATA_SISWA).map((row) => {
    // Header sudah dinormalisasi (huruf kecil, tanpa simbol) oleh readSheetRows,
    // jadi "No Ortu" / "No_Ortu" / "no-ortu" semuanya terbaca sebagai "noortu".
    const nomorQr = asText(row["nomorqr"] || row["noqr"] || row["nis"] || "");
    const noOrtu = asText(row["noortu"] || row["nohp"] || row["notelepon"] || row["hportu"] || row["nowa"] || "");
    return {
      nomorQr: nomorQr,
      nama: asText(row.nama),
      kelas: asText(row.kelas),
      noOrtu: noOrtu
    };
  });

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

// Cari nomor kolom (1-based) berdasarkan nama header, dengan normalisasi yang
// sama seperti readSheetRows (huruf kecil, tanpa spasi/simbol). Mengembalikan
// -1 kalau tidak ketemu, supaya kode pemanggil bisa fallback dengan aman
// alih-alih menebak posisi kolom secara kaku.
function findColumnIndex(sheet, headerKeyOrKeys) {
  const keys = Array.isArray(headerKeyOrKeys) ? headerKeyOrKeys : [headerKeyOrKeys];
  const lastCol = sheet.getLastColumn();
  if (lastCol < 1) return -1;
  const headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const normalized = headerRow.map((h) => asText(h).toLowerCase().replace(/[^a-z0-9]/g, ""));
  for (const key of keys) {
    const idx = normalized.indexOf(key);
    if (idx !== -1) return idx + 1; // 1-based untuk getRange
  }
  return -1;
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
        const noOrtu = asText(body.noOrtu || "");
        if (!nomorQr || !nama || !kelas) {
          response = { success: false, message: "Data tidak lengkap." };
          break;
        }

        const sheet = getSpreadsheet().getSheetByName(SHEET_DATA_SISWA);
        const colQr = findColumnIndex(sheet, ["nomorqr", "noqr", "nis"]);
        const colNama = findColumnIndex(sheet, "nama");
        const colKelas = findColumnIndex(sheet, "kelas");
        const colOrtu = findColumnIndex(sheet, ["noortu", "nohp", "notelepon", "hportu", "nowa"]);

        // Kalau header kolom belum terbaca (sheet kosong/baru), fallback ke
        // urutan default: Nomor QR, Nama, Kelas, No Ortu.
        const lastCol = Math.max(sheet.getLastColumn(), colOrtu > 0 ? colOrtu : 4);
        const newRow = new Array(lastCol).fill("");
        newRow[(colQr > 0 ? colQr : 1) - 1] = nomorQr;
        newRow[(colNama > 0 ? colNama : 2) - 1] = nama;
        newRow[(colKelas > 0 ? colKelas : 3) - 1] = kelas;
        newRow[(colOrtu > 0 ? colOrtu : 4) - 1] = noOrtu;

        sheet.appendRow(newRow);
        response = { success: true, message: "Siswa berhasil ditambahkan." };
        break;
      }

      case "editSiswa": {
        const nomorQr = asText(body.nomorQr);
        const nama = asText(body.nama);
        const kelas = asText(body.kelas);
        const noOrtu = body.noOrtu !== undefined ? asText(body.noOrtu) : null;
        const sheet = getSpreadsheet().getSheetByName(SHEET_DATA_SISWA);
        const colQr = findColumnIndex(sheet, ["nomorqr", "noqr", "nis"]);
        const colNama = findColumnIndex(sheet, "nama");
        const colKelas = findColumnIndex(sheet, "kelas");
        const colOrtu = findColumnIndex(sheet, ["noortu", "nohp", "notelepon", "hportu", "nowa"]);
        const qrColIdx0 = (colQr > 0 ? colQr : 1) - 1;

        const dataRange = sheet.getDataRange().getValues();
        let found = false;

        for (let i = 1; i < dataRange.length; i++) {
          if (String(dataRange[i][qrColIdx0]).trim() === nomorQr) {
            sheet.getRange(i + 1, colNama > 0 ? colNama : 2).setValue(nama);
            sheet.getRange(i + 1, colKelas > 0 ? colKelas : 3).setValue(kelas);
            if (noOrtu !== null && colOrtu > 0) {
              sheet.getRange(i + 1, colOrtu).setValue(noOrtu);
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
        const colQr = findColumnIndex(sheet, ["nomorqr", "noqr", "nis"]);
        const qrColIdx0 = (colQr > 0 ? colQr : 1) - 1;
        const dataRange = sheet.getDataRange().getValues();
        let foundIndex = -1;

        for (let i = 1; i < dataRange.length; i++) {
          if (String(dataRange[i][qrColIdx0]).trim() === nomorQr) {
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
          Logger.log("GAGAL: QR '" + nomorQr + "' tidak ditemukan di sheet '" + SHEET_DATA_SISWA + "'.");
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

        // --- Notifikasi WhatsApp ke orang tua (best-effort, tidak menggagalkan presensi) ---
        if (matchedSiswa.noOrtu) {
          try {
            kirimWaOrtu(nama, status, matchedSiswa.noOrtu, jam.substring(0, 5));
          } catch (waErr) {
            Logger.log("Gagal kirim WA untuk " + nama + ": " + waErr);
          }
        } else {
          Logger.log("Lewati kirim WA: kolom No Ortu kosong untuk siswa " + nama);
        }
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
}

function kirimWaOrtu(nama, status, noHpMentah, jam) {
  // Bersihkan nomor HP dari spasi, strip, tanda kurung, dll — sisakan digit saja.
  let noHp = asText(noHpMentah).replace(/[^0-9+]/g, "");
  if (noHp.startsWith("+")) noHp = noHp.slice(1);
  if (noHp.startsWith("0")) noHp = "62" + noHp.slice(1);
  if (!noHp) return;

  // PENTING: dulu di sini tertulis `*\${status}*` (ada backslash sebelum
  // ${status}), yang membuat JavaScript mengirim teks harfiah "${status}"
  // alih-alih nilai statusnya (Hadir/Terlambat). Sudah diperbaiki jadi
  // interpolasi biasa `${status}`.
  const pesan = `Yth. Wali Murid,\n\nAnak Anda *${nama}* telah presensi *${status}* pada jam ${jam}.\n\nTerima kasih.\n- Class Digital SMPN 18 Padang`;

  const options = {
    method: "post",
    headers: { Authorization: WA_TOKEN },
    payload: { target: noHp, message: pesan, countryCode: "62" },
    muteHttpExceptions: true
  };

  try {
    const res = UrlFetchApp.fetch(WA_URL, options);
    Logger.log("Respon Fonnte (" + nama + "): " + res.getContentText());
  } catch (e) {
    Logger.log("Error kirim WA untuk " + nama + ": " + e.toString());
  }
}