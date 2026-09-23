import { Siswa, PresensiRecord, UserSession, ApiResponse, RekapHarianData, RekapPeriodeData, StatusPresensi, SiswaRekapStat } from '../types';

export const DEFAULT_KELAS = "8.G";
export const JAM_BATAS_TERLAMBAT = "23:59";
const DEFAULT_API_URL = "https://script.google.com/macros/s/AKfycbwx6Zu1e3ZoZI6plItKreD8qeWscV1g8YnKGvgo8Rg0ZWDBtD4M3_yAgSX-JUj0jDjS7w/exec";

const INITIAL_SISWA: Siswa[] = [];

export function getApiUrl(): string {
  return localStorage.getItem("presensi_api_url") || DEFAULT_API_URL;
}

export function setApiUrl(url: string): void {
  localStorage.setItem("presensi_api_url", url.trim());
}

export function resetApiUrl(): void {
  localStorage.setItem("presensi_api_url", DEFAULT_API_URL);
}

// Session Storage
export function saveSession(user: UserSession): void {
  localStorage.setItem("presensi_user", JSON.stringify(user));
  sessionStorage.setItem("presensi_user", JSON.stringify(user));
}

export function getSession(): UserSession | null {
  const raw = localStorage.getItem("presensi_user") || sessionStorage.getItem("presensi_user");
  if (!raw) return null;
  try {
    const session = JSON.parse(raw);
    if (!session || typeof session !== "object" || !session.token) {
      clearSession();
      return null;
    }
    return session;
  } catch {
    clearSession();
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem("presensi_user");
  sessionStorage.removeItem("presensi_user");
}

// Date & Time formatting
export function formatTanggal(date: Date = new Date()): string {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

export function formatJam(date: Date = new Date()): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export function normalizeDateString(value: any): string {
  if (!value) return "";
  const str = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
    const [day, month, year] = str.split("/");
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  if (/^\d{2}-\d{2}-\d{4}$/.test(str)) {
    const [day, month, year] = str.split("-");
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  return str;
}

export function normalizeTimeString(value: any): string {
  return String(value ?? "").trim().replace(/\./g, ":");
}

export function escapeHtml(value: any): string {
  return String(value ?? "").replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[char] || char));
}

function normalizeSiswaRecord(student: any): Siswa {
  const nomorQr = String(student?.nomorQr ?? student?.["Nomor Qr"] ?? student?.["nomor qr"] ?? "").trim();
  const barcode = String(student?.barcode ?? nomorQr).trim();
  return {
    nomorQr,
    barcode: barcode || nomorQr,
    nama: String(student?.nama ?? student?.Nama ?? "").trim(),
    kelas: String(student?.kelas ?? student?.Kelas ?? "").trim()
  };
}

// Local Database Helpers
function getLocalSiswa(): Siswa[] {
  const raw = localStorage.getItem("presensi_local_siswa");
  if (!raw) {
    localStorage.setItem("presensi_local_siswa", JSON.stringify(INITIAL_SISWA));
    return INITIAL_SISWA;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return INITIAL_SISWA;
    }
    return parsed.map(normalizeSiswaRecord);
  } catch {
    return INITIAL_SISWA;
  }
}

function saveLocalSiswa(list: Siswa[]): void {
  localStorage.setItem("presensi_local_siswa", JSON.stringify(list.map(normalizeSiswaRecord)));
}

function getLocalRecords(): PresensiRecord[] {
  const raw = localStorage.getItem("presensi_local_records");
  if (!raw) {
    const today = formatTanggal();
    const sampleRecords: PresensiRecord[] = [
      {
        id: "rec_1",
        tanggal: today,
        jam: "06:45:12",
        nomorQr: "2408001",
        nama: "Ahmad Fauzi",
        kelas: "8.G",
        status: "Hadir",
        metode: "Scan",
        keterangan: ""
      }
    ];
    localStorage.setItem("presensi_local_records", JSON.stringify(sampleRecords));
    return sampleRecords;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveLocalRecords(records: PresensiRecord[]): void {
  localStorage.setItem("presensi_local_records", JSON.stringify(records));
}

// Local execution helper
function executeLocalAction(action: string, payload: any): ApiResponse {
  const session = getSession();

  if (action === "login") {
    // Admin credentials are verified only by the Apps Script endpoint. They are
    // intentionally never copied into localStorage or used for offline login.
    return {
      success: false,
      message: "Login Admin memerlukan koneksi ke server. Periksa URL Web App dan koneksi internet."
    };
  }

  if (!session?.token) {
    return { success: false, message: "Sesi login tidak valid atau sudah berakhir." };
  }

  if (action === "getDaftarSiswa") {
    const list = getLocalSiswa();
    const filtered = payload.kelas
      ? list.filter(s => s.kelas.toUpperCase() === String(payload.kelas).toUpperCase())
      : list;
    return { success: true, data: filtered };
  }

  if (action === "tambahSiswa") {
    const { nomorQr, barcode, nama, kelas } = payload;
    if (!nomorQr || !nama || !kelas) {
      return { success: false, message: "Nomor QR, nama, dan kelas wajib diisi." };
    }
    const cleanBarcode = String(barcode ?? nomorQr).trim();
    const list = getLocalSiswa();
    list.push({ nomorQr: nomorQr.trim(), barcode: cleanBarcode || nomorQr.trim(), nama: nama.trim(), kelas: kelas.trim() });
    saveLocalSiswa(list);
    return { success: true };
  }

  if (action === "simpanPresensi") {
    const { nomorQr, status: statusInput, metode, tanggal, jam, keterangan, kelas } = payload;
    const list = getLocalSiswa();
    const siswa = list.find(s => s.nomorQr.trim() === String(nomorQr).trim());
    if (!siswa) {
      return { success: false, message: `Nomor QR "${nomorQr}" tidak ditemukan / tidak terdaftar.` };
    }

    let finalStatus: StatusPresensi = statusInput;
    if (statusInput === "Hadir" && normalizeTimeString(jam) > JAM_BATAS_TERLAMBAT) {
      finalStatus = "Terlambat";
    }

    const newRecord: PresensiRecord = {
      id: "rec_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      tanggal: tanggal || formatTanggal(),
      jam: jam || formatJam(),
      nomorQr: siswa.nomorQr,
      nama: siswa.nama,
      kelas: kelas || siswa.kelas || DEFAULT_KELAS,
      status: finalStatus,
      metode: metode || "Scan",
      keterangan: keterangan || ""
    };

    const records = getLocalRecords();
    records.unshift(newRecord);
    saveLocalRecords(records);

    return {
      success: true,
      nama: siswa.nama,
      status: finalStatus
    };
  }

  return { success: false, message: "Aksi tidak dikenali." };
}

// Master API caller with robust mapping for Uppercase Spreadsheet headers
export async function callAPI(action: string, payload: Record<string, any> = {}): Promise<ApiResponse> {
  const apiUrl = getApiUrl();
  const session = getSession();

  if (!apiUrl || apiUrl.includes("MY_APP_URL")) {
    return {
      success: false,
      offline: true,
      message: "URL Web App belum diatur. Buka menu Settings dan isi URL Apps Script terlebih dahulu."
    };
  }

  // CRITICAL: Actions that modify data MUST reach the server. Never fall back to
  // localStorage for write operations, or data will only exist on one device and
  // won't sync across accounts/devices.
  const requiresServerSync = ["simpanPresensi", "simpanPresensiMapel", "tambahSiswa", "editSiswa", "hapusSiswa"];
  const mustReachServer = requiresServerSync.includes(action);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(apiUrl, {
       method: "POST",
       headers: { "Content-Type": "text/plain;charset=utf-8" },
       signal: controller.signal,
       body: JSON.stringify({ action, ...payload, token: session?.token })
     });

     clearTimeout(timeoutId);

     if (res.ok) {
       const json = await res.json();
       if (json && json.success) {
         // Cache lokal HANYA untuk read operations seperti getDaftarSiswa
         // untuk mempercepat tampilan (autocomplete dsb).
         if (action === "getDaftarSiswa" && Array.isArray(json.data)) {
           saveLocalSiswa(json.data);
         }
       }
       return json;
     }

     // Server returned non-OK status — data was NOT saved to shared database.
     // Report clearly so user knows data is NOT synced to other devices/accounts.
     return {
       success: false,
       offline: true,
       message: `Server merespon dengan status ${res.status}. Data TIDAK tersimpan ke database bersama. Periksa deployment Apps Script dan koneksi internet.`
     };
   } catch (err: any) {
     clearTimeout(timeoutId);
     const isTimeout = err?.name === "AbortError";
     
     // If this is a write operation that requires server sync, NEVER fall back
     // to localStorage. Report failure clearly so user can retry.
     if (mustReachServer) {
       return {
         success: false,
         offline: true,
         message: isTimeout
           ? "Waktu tunggu server habis (15 detik). Data TIDAK tersimpan ke database bersama. Pastikan koneksi internet stabil dan coba lagi."
           : "Tidak dapat terhubung ke server pusat (Google Sheet). Data TIDAK tersimpan/tersinkron ke perangkat lain. Periksa koneksi internet atau URL Web App di menu Settings."
       };
     }
     
     // For read-only operations, return cached data if available (graceful degradation)
     if (action === "getDaftarSiswa") {
       const cached = getLocalSiswa();
       if (cached.length > 0) {
         return { success: true, data: cached, offline: true, message: "Menampilkan data cache (koneksi terputus)." };
       }
     }
     
     return {
       success: false,
       offline: true,
       message: isTimeout
         ? "Waktu tunggu server habis (15 detik). Coba lagi atau periksa koneksi internet."
         : "Tidak dapat terhubung ke server. Periksa koneksi internet atau URL Web App."
     };
   }
}

export function resetDatabaseToDefault(): void {
  localStorage.setItem("presensi_local_siswa", JSON.stringify(INITIAL_SISWA));
  localStorage.removeItem("presensi_local_records");
}