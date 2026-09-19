@@ -20,51 +20,51 @@ export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const visitorLabel = 'Masuk sebagai Pengunjung';
  const adminLabel = 'Masuk sebagai Admin';

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
        // Admin credentials and Google visitor authentication are mutually
        // exclusive. Clear an earlier Google session so it cannot overwrite
        // the admin session when the app is loaded again.
        if (supabase) {
          await supabase.auth.signOut();
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

  useEffect(() => {
    const syncAdminUsers = async () => {
      try {
        const res = await callAPI('getAdminUsers');
