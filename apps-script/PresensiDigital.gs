// ================================================================
// BACKEND PRESENSI DIGITAL 8.G
// Google Apps Script
//
// STRUKTUR GOOGLE SPREADSHEET (harus sama persis dengan ini):
// 1. Admin
//    Username | Password | Nama | Role
//
// 2. Siswa   (nama sheet boleh "Siswa" ATAU "Data Siswa", keduanya dikenali)
//    Nomor QR | Barcode | Nama | Kelas
//
// 3. Presensi
//    Tanggal | Jam | Nomor QR | Nama | Kelas | Status | Metode | Keterangan
// ================================================================

// GANTI dengan ID Google Spreadsheet Anda.
const SPREADSHEET_ID = "1IvcU5AgRMF4a9CiY8QnSuMAQMG9pvj_mJBv_bdQPnzo";

const JAM_BATAS_TERLAMBAT = "07:15";

// Konfigurasi setiap sheet: kemungkinan nama sheet (candidate) + header baku.
// "siswa" mendukung 2 nama sheet supaya tidak perlu rename manual di spreadsheet lama.
const SHEET_CONFIG = {
  admin: {
    names: ["Admin"],
    headers: ["Username", "Password", "Nama", "Role"]
  },
  siswa: {
    names: ["Siswa", "Data Siswa"],
    headers: ["Nomor QR", "Barcode", "Nama", "Kelas"]
  },
  presensi: {
    names: ["Presensi"],
    headers: ["Tanggal", "Jam", "Nomor QR", "Nama", "Kelas", "Status", "Metode", "Keterangan"]
  }
};

// ================================================================
// UTILITAS
// ================================================================

function getSpreadsheet() {
  if (!SPREADSHEET_ID || SPREADSHEET_ID === "PASTE_SPREADSHEET_ID_HERE") {
    throw new Error("SPREADSHEET_ID belum diisi.");
  }

  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

// Mencari sheet berdasarkan daftar kemungkinan nama (mis. "Siswa" atau "Data Siswa").
// Kalau tidak ada satupun yang cocok, sheet baru dibuat dengan nama pertama di daftar.
function getSheet(key) {
  const config = SHEET_CONFIG[key];

  if (!config) {
    throw new Error("Konfigurasi sheet tidak dikenal: " + key);
  }

  const ss = getSpreadsheet();
  let sheet = null;

  for (let i = 0; i < config.names.length; i++) {
    sheet = ss.getSheetByName(config.names[i]);
    if (sheet) break;
  }

  // Tanpa sheet siswa: tidak dibuat otomatis lagi.
  if (!sheet && key === "siswa") {
    return null;
  }

  if (!sheet) {
    sheet = ss.insertSheet(config.names[0]);
  }

  setupSheet(sheet, config.headers, key);
  return sheet;
}

function setupSheet(sheet, headers, key) {
  const current = sheet
    .getRange(1, 1, 1, headers.length)
    .getValues()[0];

  let perluHeader = false;

  for (let i = 0; i < headers.length; i++) {
    if (String(current[i] || "").trim() !== headers[i]) {
      perluHeader = true;
      break;
    }
  }

  if (perluHeader) {
    sheet
      .getRange(1, 1, 1, headers.length)
      .setValues([headers]);
  }

  sheet.setFrozenRows(1);
  sheet
    .getRange(1, 1, 1, headers.length)
    .setFontWeight("bold");

  // Format Nomor QR & Barcode sebagai teks agar angka/QR tidak berubah jadi notasi ilmiah dsb.
  if (key === "siswa") {
    sheet.getRange("A:B").setNumberFormat("@");
  }

  if (key === "presensi") {
    sheet.getRange("C:C").setNumberFormat("@"); // kolom Nomor QR
  }
}

function asText(value) {
  return value == null ? "" : String(value).trim();
}

function normalizeDate(value) {
  if (
    Object.prototype.toString.call(value) === "[object Date]" &&
    !isNaN(value)
  ) {
    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone(),
      "yyyy-MM-dd"
    );
  }

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
  if (
    Object.prototype.toString.call(value) === "[object Date]" &&
    !isNaN(value)
  ) {
    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone(),
      "HH:mm:ss"
    );
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

function readSheetRows(key) {
  if (key === "siswa") {
    const sheet = getSheet(key);
    if (!sheet) return [];
  }

  const sheet = getSheet(key);
  if (!sheet) return [];

  const headers = SHEET_CONFIG[key].headers;

  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  const values = sheet
    .getRange(1, 1, lastRow, headers.length)
    .getValues();

  return values.slice(1).map(function(row) {
    const obj = {};

    headers.forEach(function(header, index) {
      obj[header.toLowerCase()] = row[index] == null
        ? ""
        : row[index];
    });

    return obj;
  });
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

function outputJson(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ================================================================
// ADMIN
// ================================================================

function getAdminUsers() {
  return readSheetRows("admin").map(function(row) {
    return {
      username: asText(row.username),
      password: asText(row.password),
      nama: asText(row.nama || row.username),
      role: asText(row.role || "Admin")
    };
  });
}

// ================================================================
// SISWA
// ================================================================

function getDaftarSiswa(kelasFilter) {
  return [];
}

// Siswa tidak lagi menggunakan sheet terpisah; scan langsung ditulis ke Presensi.
function findSiswaByCode(code) {
  return null;
}

// ================================================================
// PRESENSI
// ================================================================

function getPresensiRows() {
  return readSheetRows("presensi").map(function(row, index) {
    return {
      id: "REC" + (index + 2), // sintetis dari nomor baris di sheet (baris 1 = header)
      tanggal: normalizeDate(row.tanggal),
      jam: normalizeTime(row.jam),
      nomorQr: asText(row["nomor qr"]),
      nama: asText(row.nama),
      kelas: asText(row.kelas),
      status: asText(row.status),
      metode: asText(row.metode || "Scan"),
      keterangan: asText(row.keterangan)
    };
  });
}

// ================================================================
// GET
// ================================================================

function doGet(e) {
  // Hanya sheet yang benar-benar dipakai: Admin dan Presensi.
  getSheet("admin");
  getSheet("presensi");

  return outputJson({
    success: true,
    message: "Backend Presensi Digital 8.G aktif.",
    sheets: Object.keys(SHEET_CONFIG).map(function(key) {
      return SHEET_CONFIG[key].names[0];
    }),
    headers: {
      Admin: SHEET_CONFIG.admin.headers,
      Siswa: SHEET_CONFIG.siswa.headers,
      Presensi: SHEET_CONFIG.presensi.headers
    }
  });
}

// ================================================================
// POST
// ================================================================

function doPost(e) {
  let response = {
    success: false,
    message: "Aksi tidak dikenali."
  };

  try {
    const rawBody =
      e &&
      e.postData &&
      e.postData.contents
        ? e.postData.contents
        : "{}";

    const body = parseRequestBody(rawBody);
    const action = asText(body.action);

    if (!action) {
      return outputJson({
        success: false,
        message: "Parameter action tidak ditemukan."
      });
    }

    switch (action) {

      // ==========================================================
      // LOGIN
      // ==========================================================

      case "login": {
        const username = asText(body.username);
        const password = asText(body.password);

        if (!username || !password) {
          response = {
            success: false,
            message: "Username dan password wajib diisi."
          };
          break;
        }

        const matched = getAdminUsers().find(function(user) {
          return (
            user.username.toLowerCase() ===
              username.toLowerCase() &&
            user.password === password
          );
        });

        if (!matched) {
          response = {
            success: false,
            message:
              "Username atau password tidak cocok dengan data Admin."
          };
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

      // ==========================================================
      // GET ADMIN
      // ==========================================================

      case "getAdminUsers": {
        response = {
          success: true,
          data: getAdminUsers()
        };

        break;
      }

      // ==========================================================
      // GET DATA SISWA
      // ==========================================================

      case "getDaftarSiswa": {
        const kelas = asText(body.kelas || "");

        response = {
          success: true,
          data: getDaftarSiswa(kelas)
        };

        break;
      }

      // ==========================================================
      // TAMBAH SISWA
      // ==========================================================

      case "tambahSiswa": {
        const nomorQr = asText(body.nomorQr);
        const barcode = asText(body.barcode) || nomorQr;
        const nama = asText(body.nama);
        const kelas = asText(body.kelas);

        if (!nomorQr || !nama || !kelas) {
          response = {
            success: false,
            message:
              "Nomor QR, nama, dan kelas wajib diisi."
          };
          break;
        }

        const siswa = getDaftarSiswa();

        const duplicate = siswa.some(function(item) {
          return item.nomorQr.toLowerCase() === nomorQr.toLowerCase() ||
            item.barcode.toLowerCase() === barcode.toLowerCase();
        });

        if (duplicate) {
          response = {
            success: false,
            message: "Nomor QR atau barcode sudah terdaftar."
          };
          break;
        }

        const sheet = getSheet("siswa");

        // 4 KOLOM SESUAI TABEL SISWA:
        // Nomor QR | Barcode | Nama | Kelas
        sheet.appendRow([
          nomorQr,
          barcode,
          nama,
          kelas
        ]);

        response = {
          success: true,
          message: "Data siswa berhasil ditambahkan."
        };

        break;
      }

      // ==========================================================
      // EDIT SISWA
      // ==========================================================

      case "editSiswa": {
        const nomorQrLama =
          asText(body.nomorQrLama || body.nomorQr);

        const nomorQr = asText(body.nomorQr);
        const barcode = asText(body.barcode) || nomorQr;
        const nama = asText(body.nama);
        const kelas = asText(body.kelas);

        if (!nomorQr || !nama || !kelas) {
          response = {
            success: false,
            message:
              "Nomor QR, nama, dan kelas wajib diisi."
          };
          break;
        }

        const sheet = getSheet("siswa");

        const values =
          sheet.getDataRange().getValues();

        let found = false;

        for (let i = 1; i < values.length; i++) {
          if (
            asText(values[i][0]) === nomorQrLama
          ) {
            sheet
              .getRange(i + 1, 1, 1, 4)
              .setValues([[
                nomorQr,
                barcode,
                nama,
                kelas
              ]]);

            found = true;
            break;
          }
        }

        response = found
          ? {
              success: true,
              message: "Data siswa berhasil diperbarui."
            }
          : {
              success: false,
              message: "Data siswa tidak ditemukan."
            };

        break;
      }

      // ==========================================================
      // HAPUS SISWA
      // ==========================================================

      case "hapusSiswa": {
        const nomorQr = asText(body.nomorQr);

        if (!nomorQr) {
          response = {
            success: false,
            message: "Nomor QR wajib diisi."
          };
          break;
        }

        const sheet = getSheet("siswa");

        const values =
          sheet.getDataRange().getValues();

        let deleted = false;

        for (
          let i = values.length - 1;
          i >= 1;
          i--
        ) {
          if (asText(values[i][0]) === nomorQr) {
            sheet.deleteRow(i + 1);
            deleted = true;
            break;
          }
        }

        response = deleted
          ? {
              success: true,
              message: "Data siswa berhasil dihapus."
            }
          : {
              success: false,
              message: "Data siswa tidak ditemukan."
            };

        break;
      }

      // ==========================================================
      // SIMPAN PRESENSI
      // ==========================================================

      case "simpanPresensi": {
        const kodeDiscan = asText(body.nomorQr);

        let nama = asText(body.nama || "Tidak Diketahui");
        let kelas = asText(body.kelas || "Umum");

        const tanggal =
          normalizeDate(body.tanggal || new Date());

        const jam =
          normalizeTime(body.jam || new Date());

        let status =
          asText(body.status || "Hadir");

        const metode =
          asText(body.metode || "Scan");

        const keterangan =
          asText(body.keterangan || "");

        if (!kodeDiscan) {
          response = {
            success: false,
            message: "Nomor QR wajib diisi."
          };
          break;
        }

        const nomorQr = kodeDiscan;

        // Otomatis Terlambat setelah 07:15.
        if (
          status === "Hadir" &&
          jam &&
          jam.substring(0, 5) > JAM_BATAS_TERLAMBAT
        ) {
          status = "Terlambat";
        }

        const lock = LockService.getScriptLock();
        lock.waitLock(15000);

        try {
          const existing =
            getPresensiRows().find(function(row) {
              return (
                normalizeDate(row.tanggal) === tanggal &&
                asText(row.nomorQr).toLowerCase() ===
                  nomorQr.toLowerCase()
              );
            });

          if (existing) {
            response = {
              success: false,
              message:
                `${nama} sudah tercatat presensi hari ini.`,
              existingId: existing.id
            };
            break;
          }

          const sheet = getSheet("presensi");

          // 8 KOLOM WAJIB SESUAI TABEL PRESENSI:
          // Tanggal | Jam | Nomor QR | Nama | Kelas | Status | Metode | Keterangan
          sheet.appendRow([
            tanggal,
            jam,
            nomorQr,
            nama,
            kelas,
            status,
            metode,
            keterangan
          ]);
        } finally {
          lock.releaseLock();
        }

        response = {
          success: true,
          tanggal: tanggal,
          jam: jam,
          nomorQr: nomorQr,
          nama: nama,
          kelas: kelas,
          status: status,
          metode: metode,
          keterangan: keterangan
        };

        break;
      }

      // ==========================================================
      // GET SEMUA DATA PRESENSI
      // ==========================================================

      case "getPresensi": {
        const tanggal =
          normalizeDate(body.tanggal || "");

        const kelas =
          asText(body.kelas || "");

        let data = getPresensiRows();

        if (tanggal) {
          data = data.filter(function(row) {
            return row.tanggal === tanggal;
          });
        }

        if (kelas) {
          data = data.filter(function(row) {
            return row.kelas.toUpperCase() ===
              kelas.toUpperCase();
          });
        }

        response = {
          success: true,
          data: data
        };

        break;
      }

      // ==========================================================
      // REKAP HARIAN
      // ==========================================================

      case "getRekapHarian": {
        const tanggal =
          normalizeDate(body.tanggal || new Date());

        const kelas =
          asText(body.kelas || "8.G");

        const records =
          getPresensiRows().filter(function(row) {
            return (
              normalizeDate(row.tanggal) === tanggal &&
              asText(row.kelas).toUpperCase() ===
                kelas.toUpperCase()
            );
          });

        let hadir = 0;
        let izin = 0;
        let sakit = 0;
        let alpa = 0;

        const log = [];

        records.forEach(function(row) {
          const status = asText(row.status);

          if (
            status === "Hadir" ||
            status === "Terlambat"
          ) {
            hadir++;
          } else if (status === "Izin") {
            izin++;
          } else if (status === "Sakit") {
            sakit++;
          } else if (status === "Alpa") {
            alpa++;
          }

          log.push({
            id: row.id,
            tanggal: row.tanggal,
            jam: row.jam,
            nomorQr: row.nomorQr,
            nama: row.nama,
            kelas: row.kelas,
            status: status,
            metode: row.metode,
            keterangan: row.keterangan
          });
        });

        log.sort(function(a, b) {
          return a.jam < b.jam ? 1 : -1;
        });

        response = {
          success: true,
          data: {
            hadir: hadir,
            izin: izin,
            sakit: sakit,
            alpa: alpa,
            log: log.slice(0, 15)
          }
        };

        break;
      }

      // ==========================================================
      // REKAP PERIODE
      // ==========================================================

      case "getRekapPeriode": {
        const mulai =
          normalizeDate(body.mulai || new Date());

        const selesai =
          normalizeDate(body.selesai || new Date());

        const kelas =
          asText(body.kelas || "8.G");

        const records =
          getPresensiRows().filter(function(row) {
            const rowDate =
              normalizeDate(row.tanggal);

            return (
              asText(row.kelas).toUpperCase() ===
                kelas.toUpperCase() &&
              rowDate >= mulai &&
              rowDate <= selesai
            );
          });

        const rekap = {};

        records.forEach(function(record) {
          const key = asText(record.nomorQr) || asText(record.nama);
          if (!rekap[key]) {
            rekap[key] = {
              nomorQr: asText(record.nomorQr),
              nama: asText(record.nama),
              kelas: asText(record.kelas),
              hadir: 0,
              izin: 0,
              sakit: 0,
              alpa: 0,
              terlambat: 0,
              persenHadir: 0
            };
          }

          const status =
            asText(record.status);

          if (status === "Hadir") {
            rekap[key].hadir++;
          } else if (status === "Terlambat") {
            rekap[key].hadir++;
            rekap[key].terlambat++;
          } else if (status === "Izin") {
            rekap[key].izin++;
          } else if (status === "Sakit") {
            rekap[key].sakit++;
          } else if (status === "Alpa") {
            rekap[key].alpa++;
          }
        });

        const perSiswa =
          Object.values(rekap).map(function(item) {
            const totalTercatat =
              item.hadir +
              item.izin +
              item.sakit +
              item.alpa;

            item.persenHadir =
              totalTercatat > 0
                ? Math.round(
                    (item.hadir /
                      totalTercatat) *
                    100
                  )
                : 100;

            return item;
          });

        const totalHadir =
          records.filter(function(row) {
            const status = asText(row.status);
            return status === "Hadir" || status === "Terlambat";
          }).length;

        const totalIzin =
          records.filter(function(row) {
            return asText(row.status) === "Izin";
          }).length;

        const totalSakit =
          records.filter(function(row) {
            return asText(row.status) === "Sakit";
          }).length;

        const totalAlpa =
          records.filter(function(row) {
            return asText(row.status) === "Alpa";
          }).length;

        perSiswa.sort(function(a, b) {
          return a.nama.localeCompare(b.nama, "id");
        });

        response = {
          success: true,
          data: {
            totalHadir: totalHadir,
            totalIzin: totalIzin,
            totalSakit: totalSakit,
            totalAlpa: totalAlpa,
            perSiswa: perSiswa
          }
        };

        break;
      }

      default: {
        response = {
          success: false,
          message:
            `Aksi ${action} belum didukung pada backend.`
        };
      }
    }

  } catch (err) {
    response = {
      success: false,
      message:
        err && err.message
          ? err.message
          : "Terjadi kesalahan saat memproses permintaan."
    };
  }

  return outputJson(response);
}