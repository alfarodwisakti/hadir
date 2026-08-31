import React, { useEffect, useState } from 'react';
import { 
  GraduationCap, 
  Lock, 
  User, 
  AlertCircle, 
  ArrowRight,
  ShieldCheck,
  Chrome
} from 'lucide-react';
import { callAPI, getGoogleClientId, saveSession } from '../services/api';
import { UserSession } from '../types';

interface LoginViewProps {
  onLoginSuccess: (user: UserSession) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('walikelas8g');
  const [password, setPassword] = useState('admin123');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    const clientId = getGoogleClientId();
    if (!clientId) return;

    const existingScript = document.getElementById('google-gsi-script');
    if (existingScript) {
      if ((window as any).google?.accounts?.id) {
        initializeGoogleButton();
      }
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-gsi-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initializeGoogleButton;
    document.body.appendChild(script);

    function initializeGoogleButton() {
      const google = (window as any).google;
      if (!google?.accounts?.id) return;

      google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response: { credential?: string }) => {
          await handleGoogleCredential(response);
        }
      });
    }
  }, []);

  const decodeGoogleJwt = (jwt: string) => {
    try {
      const payload = jwt.split('.')[1];
      if (!payload) return null;
      const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
      return JSON.parse(atob(padded));
    } catch {
      return null;
    }
  };

  const handleGoogleCredential = async (response: { credential?: string }) => {
    const credential = response?.credential;
    if (!credential) {
      setErrorMsg('Login Google dibatalkan atau tidak tersedia.');
      return;
    }

    setGoogleLoading(true);
    setErrorMsg('');

    try {
      const payload = decodeGoogleJwt(credential);
      const email = String(payload?.email || '').trim();
      const name = String(payload?.name || payload?.given_name || 'Siswa Google').trim();

      if (!email) {
        setErrorMsg('Email Google tidak tersedia dari akun yang dipilih.');
        return;
      }

      const res = await callAPI('googleLogin', {
        email,
        name,
        credential,
        provider: 'google'
      });

      if (res.success && res.token) {
        const user: UserSession = {
          username: res.username || email,
          nama: res.nama || name,
          role: res.role || 'Siswa',
          token: res.token,
          email,
          provider: 'google'
        };
        saveSession(user);
        onLoginSuccess(user);
      } else {
        setErrorMsg(res.message || 'Login Google gagal.');
      }
    } catch {
      setErrorMsg('Gagal menghubungi server untuk login Google.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await callAPI("login", {
        username: username.trim(),
        password: password.trim()
      });

      if (res.success && res.token) {
        const user: UserSession = {
          username: res.username || username.trim(),
          nama: res.nama || "Admin",
          role: res.role || "Admin",
          token: res.token
        };
        saveSession(user);
        onLoginSuccess(user);
      } else {
        setErrorMsg(res.message || "Username atau password salah.");
      }
    } catch {
      setErrorMsg("Gagal menghubungi server. Periksa koneksi.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-blue-950 flex flex-col justify-center items-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-3xl p-8 shadow-2xl border border-slate-100 space-y-6">
          {/* Logo & Header */}
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center mx-auto shadow-xl shadow-blue-500/25">
              <GraduationCap className="w-9 h-9" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Presensi Digital 8.G</h1>
            <p className="text-xs text-slate-500 font-medium">
              Sistem Absensi &amp; Rekapitulasi Kehadiran Siswa
            </p>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Username
              </label>
              <div className="relative">
                <input
                  id="inputLoginUsername"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Masukkan username"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 pl-10 text-sm focus:ring-2 focus:ring-blue-500 outline-hidden font-medium text-slate-800"
                  required
                />
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="inputLoginPassword"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 pl-10 text-sm focus:ring-2 focus:ring-blue-500 outline-hidden font-medium text-slate-800"
                  required
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              </div>
            </div>

            <button
              id="btnLoginSubmit"
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 active:scale-98 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span>Memproses Masuk...</span>
              ) : (
                <>
                  <span>Masuk ke Sistem</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-[0.2em] text-slate-400">
              <span className="bg-white px-2">atau</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              const clientId = getGoogleClientId();
              const google = (window as any).google;
              if (!clientId || !google?.accounts?.id) {
                setErrorMsg('Google Client ID belum dikonfigurasi. Tambahkan VITE_GOOGLE_CLIENT_ID di file .env.');
                return;
              }
              google.accounts.id.prompt();
            }}
            disabled={googleLoading}
            className="w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-3 rounded-xl text-sm transition shadow-sm flex items-center justify-center gap-2"
          >
            <Chrome className="w-4 h-4 text-blue-600" />
            <span>{googleLoading ? 'Menghubungkan Google...' : 'Masuk dengan Google'}</span>
          </button>

          {/* Quick Demo Credentials */}
          <div className="pt-4 border-t border-slate-100">
            <div className="text-[11px] font-bold text-slate-600 mb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>Akun Demo Cepat:</span>
            </div>
            <button
              type="button"
              onClick={() => handleQuickLogin('walikelas8g', 'admin123')}
              className="w-full p-2.5 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200 text-left transition flex items-center justify-between group"
            >
              <div>
                <div className="text-xs font-bold text-slate-800 group-hover:text-blue-700">
                  Wali Kelas 8.G (Bu Siti)
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  walikelas8g / admin123
                </div>
              </div>
              <span className="text-[10px] font-bold text-blue-600 bg-blue-100/60 px-2 py-0.5 rounded">
                Gunakan
              </span>
            </button>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center mt-6 text-xs text-slate-400 font-medium">
          Presensi Digital Kelas 8.G • SMP Negeri
        </div>
      </div>
    </div>
  );
};
