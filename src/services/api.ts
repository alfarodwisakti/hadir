import { Siswa, PresensiRecord, UserSession, ApiResponse, RekapHarianData, RekapPeriodeData, StatusPresensi, SiswaRekapStat } from '../types';

export const DEFAULT_KELAS = "8.G";
export const JAM_BATAS_TERLAMBAT = "07:15";
const DEFAULT_API_URL = "https://script.google.com/macros/s/AKfycbxx_Yx9ZwyR-PoSoliQ-kpM4JaHvsEsjmQca8Mp9L-cpXBq8GSC-wqiPgEonek1tb8g9g/exec";

export function getGoogleClientId(): string {
  return (import.meta.env.VITE_GOOGLE_CLIENT_ID || "").trim();
}

// Seed data awal dihapus agar daftar siswa bersifat kosong sampai data ditambahkan manual.
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
  const nomorQr = String(student?.nomorQr ?? "").trim();
  const barcode = String(student?.barcode ?? nomorQr).trim();
  return {
    nomorQr,
    barcode: barcode || nomorQr,
    nama: String(student?.nama ?? "").trim(),
    kelas: String(student?.kelas ?? "").trim()
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
    // Generate some recent sample records for realistic UI preview
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
      },
      {
        id: "rec_2",
        tanggal: today,
        jam: "06:58:30",
        nomorQr: "2408002",
        nama: "Aisyah Putri",
        kelas: "8.G",
        status: "Hadir",
        metode: "Scan",
        keterangan: ""
      },
      {
        id: "rec_3",
        tanggal: today,
        jam: "07:22:04",
        nomorQr: "2408003",
        nama: "Bagas Pratama",
        kelas: "8.G",
        status: "Terlambat",
        metode: "Scan",
        keterangan: "Terlambat tiba di sekolah"
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

// Local mock execution for offline or unconfigured GAS
function executeLocalAction(action: string, payload: any): ApiResponse {
  const session = getSession();

  if (action === "login") {
    const { username, password } = payload;
    if (
      (username === "walikelas8g" && password === "admin123") ||
      (username === "admin" && password === "admin123") ||
      (username && password && username.toLowerCase() === "guru" && password === "123456")
    ) {
      const token = "tok_" + Math.random().toString(36).substring(2) + Date.now().toString(36);
      return {
        success: true,
        username,
        nama: username === "walikelas8g" ? "Bu Siti (Wali Kelas)" : "Admin Presensi",
        role: "Admin",
        token
      };
    }
    return { success: false, message: "Username atau password salah. (Gunakan: walikelas8g / admin123)" };
  }

  if (action === "googleLogin") {
    const email = String(payload?.email || "").trim();
    const name = String(payload?.name || payload?.nama || "").trim() || email.split('@')[0] || "Siswa";

    if (!email || !email.includes('@')) {
      return { success: false, message: "Login Google gagal: email tidak valid." };
    }

    const token = "google_tok_" + Math.random().toString(36).substring(2) + Date.now().toString(36);
    return {
      success: true,
      username: email,
      nama: name,
      role: "Siswa",
      email,
      token
    };
  }

  // Check auth
  if (!session?.token && payload?.token !== session?.token) {
    // allow if valid session in storage
    if (!session) {
      return { success: false, message: "Sesi login tidak valid atau sudah berakhir." };
    }
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
    if (list.some(s => s.nomorQr.trim() === nomorQr.trim() || (s.barcode || s.nomorQr).trim() === cleanBarcode)) {
      return { success: false, message: "Nomor QR atau barcode sudah terdaftar." };
    }
    list.push({ nomorQr: nomorQr.trim(), barcode: cleanBarcode || nomorQr.trim(), nama: nama.trim(), kelas: kelas.trim() });
    saveLocalSiswa(list);
    return { success: true };
  }

  if (action === "editSiswa") {
    const { nomorQr, barcode, nama, kelas } = payload;
    const list = getLocalSiswa();
    const index = list.findIndex(s => s.nomorQr.trim() === nomorQr.trim());
    if (index === -1) {
      return { success: false, message: "Data siswa tidak ditemukan." };
    }
    const cleanBarcode = String(barcode ?? nomorQr).trim();
    const duplicateIndex = list.findIndex(s => s.nomorQr.trim() !== nomorQr.trim() && (s.nomorQr.trim() === nomorQr.trim() || (s.barcode || s.nomorQr).trim() === cleanBarcode));
    if (duplicateIndex !== -1) {
      return { success: false, message: "Nomor QR atau barcode sudah terdaftar untuk siswa lain." };
    }
    list[index] = { nomorQr: nomorQr.trim(), barcode: cleanBarcode || nomorQr.trim(), nama: nama.trim(), kelas: kelas.trim() };
    saveLocalSiswa(list);
    return { success: true };
  }

  if (action === "hapusSiswa") {
    const { nomorQr } = payload;
    let list = getLocalSiswa();
    const prevLen = list.length;
    list = list.filter(s => s.nomorQr.trim() !== String(nomorQr).trim());
    if (list.length === prevLen) {
      return { success: false, message: "Data siswa tidak ditemukan." };
    }
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

    const records = getLocalRecords();
    const targetTanggalNorm = normalizeDateString(tanggal);
    const existing = records.find(
      r => r.nomorQr.trim() === String(nomorQr).trim() && normalizeDateString(r.tanggal) === targetTanggalNorm
    );
    if (existing) {
      return { success: false, message: `${siswa.nama} sudah tercatat presensi hari ini (${existing.status}).` };
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

    records.unshift(newRecord);
    saveLocalRecords(records);

    return {
      success: true,
      nama: siswa.nama,
      status: finalStatus
    };
  }

  if (action === "getRekapHarian") {
    const records = getLocalRecords();
    const targetTanggalNorm = normalizeDateString(payload.tanggal || formatTanggal());
    const kelasTarget = String(payload.kelas || DEFAULT_KELAS).toUpperCase();

    let hadir = 0;
    let izin = 0;
    let sakit = 0;
    let alpa = 0;
    const log: RekapHarianData['log'] = [];

    records.forEach(r => {
      if (normalizeDateString(r.tanggal) === targetTanggalNorm && r.kelas.toUpperCase() === kelasTarget) {
        if (r.status === "Hadir" || r.status === "Terlambat") hadir++;
        else if (r.status === "Izin") izin++;
        else if (r.status === "Sakit") sakit++;
        else if (r.status === "Alpa") alpa++;

        log.push({
          jam: r.jam,
          nomorQr: r.nomorQr,
          nama: r.nama,
          status: r.status,
          metode: r.metode
        });
      }
    });

    log.sort((a, b) => (a.jam < b.jam ? 1 : -1));

    return {
      success: true,
      data: { hadir, izin, sakit, alpa, log: log.slice(0, 15) }
    };
  }

  if (action === "getRekapPeriode") {
    const records = getLocalRecords();
    const listSiswa = getLocalSiswa();
    const mulaiNorm = normalizeDateString(payload.mulai);
    const selesaiNorm = normalizeDateString(payload.selesai);
    const kelasTarget = String(payload.kelas || DEFAULT_KELAS).toUpperCase();

    const rekapMap: Record<string, SiswaRekapStat> = {};
    listSiswa.forEach(s => {
      if (s.kelas.toUpperCase() === kelasTarget) {
        rekapMap[s.nomorQr] = {
          nomorQr: s.nomorQr,
          nama: s.nama,
          hadir: 0,
          izin: 0,
          sakit: 0,
          alpa: 0,
          persenHadir: 0
        };
      }
    });

    let totalHadir = 0;
    let totalIzin = 0;
    let totalSakit = 0;
    let totalAlpa = 0;

    records.forEach(r => {
      const t = normalizeDateString(r.tanggal);
      if (r.kelas.toUpperCase() === kelasTarget && t >= mulaiNorm && t <= selesaiNorm) {
        if (!rekapMap[r.nomorQr]) {
          rekapMap[r.nomorQr] = {
            nomorQr: r.nomorQr,
            nama: r.nama,
            hadir: 0,
            izin: 0,
            sakit: 0,
            alpa: 0,
            persenHadir: 0
          };
        }

        if (r.status === "Hadir" || r.status === "Terlambat") {
          rekapMap[r.nomorQr].hadir++;
          totalHadir++;
        } else if (r.status === "Izin") {
          rekapMap[r.nomorQr].izin++;
          totalIzin++;
        } else if (r.status === "Sakit") {
          rekapMap[r.nomorQr].sakit++;
          totalSakit++;
        } else if (r.status === "Alpa") {
          rekapMap[r.nomorQr].alpa++;
          totalAlpa++;
        }
      }
    });

    const perSiswa = Object.values(rekapMap).map(s => {
      const totalTercatat = s.hadir + s.izin + s.sakit + s.alpa;
      const persenHadir = totalTercatat > 0 ? Math.round((s.hadir / totalTercatat) * 100) : 100;
      return { ...s, persenHadir };
    });

    // sort alphabetically by name
    perSiswa.sort((a, b) => a.nama.localeCompare(b.nama, "id"));

    const data: RekapPeriodeData = {
      totalHadir,
      totalIzin,
      totalSakit,
      totalAlpa,
      perSiswa
    };

    return { success: true, data };
  }

  return { success: false, message: "Aksi tidak dikenali." };
}

// Master API caller: Tries Google Apps Script with fallback to Local State
export async function callAPI(action: string, payload: Record<string, any> = {}): Promise<ApiResponse> {
  const apiUrl = getApiUrl();
  const session = getSession();

  // If apiUrl is explicitly disabled or empty, use local handler immediately
  if (!apiUrl || apiUrl.includes("MY_APP_URL")) {
    return executeLocalAction(action, payload);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

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
      // Also update local copy for offline resilience
      if (json && json.success) {
        if (action === "getDaftarSiswa" && Array.isArray(json.data)) {
          saveLocalSiswa(json.data);
        }
      }
      return json;
    } else {
      console.warn("GAS responded with non-ok HTTP status, falling back to local state:", res.status);
      return executeLocalAction(action, payload);
    }
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.info("Using active local persistence (Google Apps Script sync standby):", err?.message || err);
    // Fallback seamlessly to local engine so user is never blocked
    return executeLocalAction(action, payload);
  }
}

// Helper to reset and re-seed database
export function resetDatabaseToDefault(): void {
  localStorage.setItem("presensi_local_siswa", JSON.stringify(INITIAL_SISWA));
  localStorage.removeItem("presensi_local_records");
}
