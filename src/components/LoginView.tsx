import React, { useState } from 'react';
import {
  GraduationCap,
  Lock,
  User,
  AlertCircle,
  ArrowRight,
  Chrome
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
@@ -39,64 +39,50 @@ export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {

      if (res.success && res.token) {
        if (supabase) {
          await supabase.auth.signOut({ scope: 'local' });
        }

        const user: UserSession = {
          username: res.username || username.trim(),
          nama: res.nama || "Admin",
          role: res.role || "Admin",
          token: res.token,
          provider: 'local'
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