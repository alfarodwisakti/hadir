import { Siswa, PresensiRecord, UserSession, ApiResponse, RekapHarianData, RekapPeriodeData, StatusPresensi, SiswaRekapStat } from '../types';

export const DEFAULT_KELAS = "8.G";
export const JAM_BATAS_TERLAMBAT = "07:15";
const DEFAULT_API_URL = "https://script.google.com/macros/s/AKfycbxOwJTvjmpi240jXr_0i-jG2FSXOfLQQMTmWCXgHTeL5Cz3QGWeDJ8NQO1_Pt4YypRcxQ/exec

interface AdminUser {
  username: string;
  password: string;
  nama: string;
  role: string;
}

// Seed data mengikuti daftar siswa yang terdapat pada file Excel "PRESENSI DIGITAL.xlsx".
const INITIAL_SISWA: Siswa[] = [
  { nomorQr: "2408001", barcode: "2408001", nama: "AFIFAH SYAHIRA FITRI", kelas: "8.G" },
  { nomorQr: "2408002", barcode: "2408002", nama: "AFIQAH KHAIRUNNISA RIZALOV", kelas: "8.G" },
  { nomorQr: "2408003", barcode: "2408003", nama: "ALFARIS ADRIAN AKBAR", kelas: "8.G" },
  { nomorQr: "2408004", barcode: "2408004", nama: "ALFARO DWI SAKTI", kelas: "8.G" },
  { nomorQr: "2408005", barcode: "2408005", nama: "ALTA LATHIFA AMINI", kelas: "8.G" },
  { nomorQr: "2408006", barcode: "2408006", nama: "AQILA KIRANA SYAFRI", kelas: "8.G" },
  { nomorQr: "2408007", barcode: "2408007", nama: "ARRAHMAH WAZNA", kelas: "8.G" },
  { nomorQr: "2408008", barcode: "2408008", nama: "ARZIKI GILBI EL SURYA", kelas: "8.G" },
  { nomorQr: "2408009", barcode: "2408009", nama: "BINTANY NAURA ALJANNAH", kelas: "8.G" },
  { nomorQr: "2408010", barcode: "2408010", nama: "DANISH EDILLA KENZY", kelas: "8.G" },
  { nomorQr: "2408011", barcode: "2408011", nama: "DZAKIA TALITA DELSKI", kelas: "8.G" },
  { nomorQr: "2408012", barcode: "2408012", nama: "FAIZ PUTRA RINALFI", kelas: "8.G" },
  { nomorQr: "2408013", barcode: "2408013", nama: "HADISYA RUFLIANZA", kelas: "8.G" },
  { nomorQr: "2408014", barcode: "2408014", nama: "HAKIM BAWAZIR", kelas: "8.G" },
  { nomorQr: "2408015", barcode: "2408015", nama: "HUSNATHUL CHADLI", kelas: "8.G" },
  { nomorQr: "2408016", barcode: "2408016", nama: "IQBAL AR RASYID", kelas: "8.G" },
  { nomorQr: "2408017", barcode: "2408017", nama: "KAILYLA PUTRI INDO", kelas: "8.G" },
  { nomorQr: "2408018", barcode: "2408018", nama: "KEKIRA ATHALETA IRAWAN", kelas: "8.G" },
  { nomorQr: "2408019", barcode: "2408019", nama: "MALAIKA KEISHA APRIADI", kelas: "8.G" },
  { nomorQr: "2408020", barcode: "2408020", nama: "MAULANA ALIF NUGROHO", kelas: "8.G" },
  { nomorQr: "2408021", barcode: "2408021", nama: "MUTIA MELINRA PUTRI", kelas: "8.G" },
  { nomorQr: "2408022", barcode: "2408022", nama: "NAFISA AZIZAH", kelas: "8.G" },
  { nomorQr: "2408023", barcode: "2408023", nama: "NANANG PRAYOGA", kelas: "8.G" },
  { nomorQr: "2408024", barcode: "2408024", nama: "NAYLA MUAZARA ULFA", kelas: "8.G" },
  { nomorQr: "2408025", barcode: "2408025", nama: "PADUKA ALISHA SAFARANI", kelas: "8.G" },
  { nomorQr: "2408026", barcode: "2408026", nama: "RAUDAH RAHAYU FIRDAUS", kelas: "8.G" },
  { nomorQr: "2408027", barcode: "2408027", nama: "REVAN FIYATRA NADIFATUNNAGARA", kelas: "8.G" },
  { nomorQr: "2408028", barcode: "2408028", nama: "SANI RUMAISHA VISANO", kelas: "8.G" },
  { nomorQr: "2408029", barcode: "2408029", nama: "SHAZIA AFARYN ARIVIE", kelas: "8.G" },
  { nomorQr: "2408030", barcode: "2408030", nama: "SYAKIRA PUTRI NEYANDRA", kelas: "8.G" },
  { nomorQr: "2408031", barcode: "2408031", nama: "ZAHRA PUTRI ZANI", kelas: "8.G" },
  { nomorQr: "2408032", barcode: "2408032", nama: "ZIVAN ANDESTA", kelas: "8.G" }
];

function getLocalAdminUsers(): AdminUser[] {
  const raw = localStorage.getItem("presensi_local_admin_users");
  if (!raw) {
    localStorage.setItem("presensi_local_admin_users", JSON.stringify([]));
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalAdminUsers(list: AdminUser[]): void {
  localStorage.setItem("presensi_local_admin_users", JSON.stringify(list));
}

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
    localStorage.setItem("presensi_local_records", JSON.stringify([]));
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
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
    const username = String(payload?.username ?? "").trim();
    const password = String(payload?.password ?? "").trim();
    const adminUsers = getLocalAdminUsers();

    if (!username || !password) {
      return { success: false, message: "Username dan password wajib diisi." };
    }

    const matched = adminUsers.find(user =>
      user.username.toLowerCase() === username.toLowerCase() && user.password === password
    );

    if (matched) {
      const token = "tok_" + Math.random().toString(36).substring(2) + Date.now().toString(36);
      return {
        success: true,
        username: matched.username,
        nama: matched.nama || matched.username,
        role: matched.role || "Admin",
        token
      };
    }

    if (adminUsers.length === 0) {
      return {
        success: false,
        message: "Data admin belum sinkron dengan spreadsheet. Hubungkan sheet Admin lalu login kembali."
      };
    }

    return { success: false, message: "Username atau password tidak cocok dengan data spreadsheet." };
  }

  if (action === "googleLogin") {
    const email = String(payload?.email || "").trim();
    const name = String(payload?.name || payload?.nama || "").trim() || email.split('@')[0] || "Siswa";

    if (!payload?.fromSupabase) {
      return {
        success: false,
        message: "Login pengunjung harus melalui Supabase. Fallback lokal tidak diizinkan untuk akses Google."
      };
    }

    if (!email || !email.includes('@')) {
      return { success: false, message: "Login Supabase gagal: email tidak valid." };
    }

    const token = "supabase_tok_" + Math.random().toString(36).substring(2) + Date.now().toString(36);
    return {
      success: true,
      username: email,
      nama: name,
      role: "Pengunjung",
      email,
      token
    };
  }

  if (action === "getAdminUsers") {
    const adminUsers = getLocalAdminUsers();
    return { success: true, data: adminUsers };
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
    const { nomorQr, status: statusInput, metode, tanggal, jam, keterangan, kelas, nama: namaInput } = payload;
    const cleanNomorQr = String(nomorQr ?? "").trim();
    const nama = String(namaInput ?? "Tidak Diketahui").trim() || "Tidak Diketahui";
    const kelasNama = String(kelas ?? DEFAULT_KELAS).trim() || DEFAULT_KELAS;

    if (!cleanNomorQr) {
      return { success: false, message: "Nomor QR wajib diisi." };
    }

    const records = getLocalRecords();
    const targetTanggalNorm = normalizeDateString(tanggal);
    const existing = records.find(
      r => r.nomorQr.trim() === cleanNomorQr && normalizeDateString(r.tanggal) === targetTanggalNorm
    );
    if (existing) {
      return { success: false, message: `${nama} sudah tercatat presensi hari ini (${existing.status}).` };
    }

    let finalStatus: StatusPresensi = statusInput;
    if (statusInput === "Hadir" && normalizeTimeString(jam) > JAM_BATAS_TERLAMBAT) {
      finalStatus = "Terlambat";
    }

    const finalMetode: any = metode || "Scan";

    const newRecord: PresensiRecord = {
      id: "rec_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      tanggal: tanggal || formatTanggal(),
      jam: jam || formatJam(),
      nomorQr: cleanNomorQr,
      nama,
      kelas: kelasNama,
      status: finalStatus,
      metode: finalMetode,
      keterangan: keterangan || ""
    };

    records.unshift(newRecord);
    saveLocalRecords(records);

    return {
      success: true,
      nama,
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

        const status = r.status === "Terlambat" ? "Hadir" : r.status;

        if (status === "Hadir") {
          rekapMap[r.nomorQr].hadir++;
          totalHadir++;
        } else if (status === "Izin") {
          rekapMap[r.nomorQr].izin++;
          totalIzin++;
        } else if (status === "Sakit") {
          rekapMap[r.nomorQr].sakit++;
          totalSakit++;
        } else if (status === "Alpa") {
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

      if (json && json.success) {
        if (action === "getDaftarSiswa" && Array.isArray(json.data)) {
          saveLocalSiswa(json.data);
        }

        if (action === "login" && json.username) {
          const localAdmin = getLocalAdminUsers();
          if (!localAdmin.some(user => user.username.toLowerCase() === String(json.username ?? "").toLowerCase())) {
            saveLocalAdminUsers([...localAdmin, {
              username: String(json.username ?? "").trim(),
              password: String(payload?.password ?? "").trim(),
              nama: String(json.nama ?? json.username ?? "").trim(),
              role: String(json.role ?? "Admin").trim() || "Admin"
            }]);
          }
        }

        if ((action === "getAdminUsers" || action === "login") && Array.isArray(json.data)) {
          saveLocalAdminUsers(json.data.map((user: any) => ({
            username: String(user.username ?? "").trim(),
            password: String(user.password ?? "").trim(),
            nama: String(user.nama ?? user.username ?? "").trim(),
            role: String(user.role ?? "Admin").trim() || "Admin"
          })));
        }

        if (action === "simpanPresensi" && json.success && json.nama) {
          const records = getLocalRecords();
          const targetDate = normalizeDateString(payload.tanggal || formatTanggal());
          const existing = records.find(r =>
            normalizeDateString(r.tanggal) === targetDate && r.nomorQr.trim() === String(payload.nomorQr ?? "").trim()
          );

          if (!existing) {
            const record: PresensiRecord = {
              id: "sync_" + Date.now() + Math.random().toString(36).slice(2, 8),
              tanggal: String(payload.tanggal || formatTanggal()),
              jam: String(payload.jam || formatJam()),
              nomorQr: String(payload.nomorQr ?? ""),
              nama: String(json.nama ?? payload.nama ?? ""),
              kelas: String(payload.kelas || DEFAULT_KELAS),
              status: String(json.status || payload.status || "Hadir"),
              metode: String(payload.metode || "Scan"),
              keterangan: String(payload.keterangan || "")
            };
            saveLocalRecords([record, ...records]);
          }
        }
      }

      return json;
    }

    const errorText = await res.text();
    let message = "Server presensi tidak merespons. Pastikan URL Web App Google Apps Script sudah benar dan dapat diakses publik.";

    try {
      const parsed = JSON.parse(errorText);
      if (parsed && parsed.message) message = parsed.message;
    } catch {
      if (errorText) message = errorText;
    }

    console.warn("GAS responded with non-ok HTTP status:", res.status, message);
    return {
      success: false,
      message
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    const fallbackMessage = "Tidak dapat terhubung ke server presensi. Periksa URL Web App Google Apps Script dan setelan akses 'Anyone'.";
    console.info("Remote server unavailable:", err?.message || err);
    return {
      success: false,
      message: err?.message ? `${fallbackMessage} Detail: ${err.message}` : fallbackMessage
    };
  }
}

// Helper to reset and re-seed database
export function resetDatabaseToDefault(): void {
  localStorage.setItem("presensi_local_siswa", JSON.stringify(INITIAL_SISWA));
  localStorage.removeItem("presensi_local_records");
  localStorage.setItem("presensi_local_admin_users", JSON.stringify([]));
}
