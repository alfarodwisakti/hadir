@@ -10,50 +10,57 @@ interface AdminUser {
  nama: string;
  role: string;
}

const INITIAL_SISWA: Siswa[] = [];

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

function adminSyncUnavailableResponse(): ApiResponse {
  return {
    success: false,
    message: "Data Admin tidak dapat dimuat dari spreadsheet. Periksa URL Web App Google Apps Script dan pastikan deployment dapat diakses, lalu coba lagi."
  };
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
@@ -300,38 +307,48 @@ export async function callAPI(action: string, payload: Record<string, any> = {})
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
        if ((action === "getAdminUsers" || action === "login") && Array.isArray(json.data)) {
          saveLocalAdminUsers(json.data.map((user: any) => ({
            username: String((user.username || user.Username) ?? "").trim(),
            password: String((user.password || user.Password) ?? "").trim(),
            nama: String((user.nama || user.Nama || user.username || user.Username) ?? "").trim(),
            role: String((user.role || user.Role) ?? "Admin").trim() || "Admin"
          }))); 
        }
      }
      return json;
    } else {
      if ((action === "login" || action === "getAdminUsers") && getLocalAdminUsers().length === 0) {
        return adminSyncUnavailableResponse();
      }
      return executeLocalAction(action, payload);
    }
  } catch (err: any) {
    clearTimeout(timeoutId);

    // Do not present an empty local cache as an Admin-sheet synchronization
    // error. Authentication can use a previously synchronized cache offline,
    // but a first login must reach the configured Google Apps Script endpoint.
    if ((action === "login" || action === "getAdminUsers") && getLocalAdminUsers().length === 0) {
      return adminSyncUnavailableResponse();
    }
    return executeLocalAction(action, payload);
  }
}

export function resetDatabaseToDefault(): void {
  localStorage.setItem("presensi_local_siswa", JSON.stringify(INITIAL_SISWA));
  localStorage.removeItem("presensi_local_records");
  localStorage.setItem("presensi_local_admin_users", JSON.stringify([]));
}
}
