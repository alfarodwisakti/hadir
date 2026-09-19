import React, { useState } from 'react';
import {
  GraduationCap,
  Lock,
  User,
  AlertCircle,
  ArrowRight,
  Chrome,
  Loader2
} from 'lucide-react';
import { callAPI, saveSession } from '../services/api';
import { supabase } from '../lib/supabase';
import { UserSession } from '../types';

interface LoginViewProps {
  onLoginSuccess: (user: UserSession) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const logoUrl = new URL('../../LOGO SMP 18 X KELAS 8G.png', import.meta.url).href;

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const visitorLabel = 'Masuk sebagai Pengunjung';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMsg('Username dan password wajib diisi.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await callAPI('login', { username: username.trim(), password });

      if (res.success && res.token) {
        if (supabase) {
          await supabase.auth.signOut({ scope: 'local' });
        }

        const user: UserSession = {
          username: res.username || username.trim(),
          nama: res.nama || 'Admin',
          role: res.role || 'Admin',
          token: res.token,
          provider: 'local'
        };
        saveSession(user);
        onLoginSuccess(user);
      } else {
        setErrorMsg(res.message || 'Username atau password salah.');
      }
    } catch {
      setErrorMsg('Gagal menghubungi server. Periksa koneksi.');
    } finally {
      setLoading(false);
    }
  };

  const handleSupabaseGoogleLogin = async () => {
    if (!supabase) {
      setErrorMsg('Supabase belum dikonfigurasi. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const appUrl = (import.meta.env.VITE_APP_URL || window.location.origin || '').replace(/\/$/, '');

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: appUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          }
        }
      });

      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Terjadi kesalahan saat login dengan Google.');
      setLoading(false);
    }
  };

  const handleVisitorLogin = () => {
    const visitorUser: UserSession = {
      username: 'pengunjung',
      nama: 'Pengunjung',
      role: 'Viewer',
      token: 'visitor_token_' + Date.now(),
      provider: 'visitor'
    };
    saveSession(visitorUser);
    onLoginSuccess(visitorUser);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 w-full max-w-md rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="inline-flex p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl mb-4">
            <GraduationCap className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">Presensi Digital 8.G</h1>
          <p className="text-slate-400 text-sm mt-1">Silakan masuk untuk mengelola data</p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-sm flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Username Admin
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                <User className="w-5 h-5" />
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan username"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                <Lock className="w-5 h-5" />
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-xl transition flex items-center justify-center space-x-2 text-sm disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Memproses...</span>
              </>
            ) : (
              <>
                <span>Masuk sebagai Admin</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={handleSupabaseGoogleLogin}
            disabled={loading}
            className="w-full bg-slate-700 hover:bg-slate-600 text-white font-medium py-3 rounded-xl transition flex items-center justify-center space-x-2 text-sm border border-slate-600 disabled:opacity-50"
          >
            <Chrome className="w-5 h-5 text-amber-400" />
            <span>Masuk dengan Google (Supabase)</span>
          </button>

          <button
            type="button"
            onClick={handleVisitorLogin}
            disabled={loading}
            className="w-full bg-slate-900 hover:bg-slate-700/50 text-slate-300 font-medium py-3 rounded-xl transition flex items-center justify-center space-x-2 text-sm border border-slate-700"
          >
            <span>{visitorLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};