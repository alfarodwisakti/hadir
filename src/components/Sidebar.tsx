import React from 'react';
import { 
  LayoutDashboard, 
  QrCode, 
  BarChart3, 
  Users, 
  Settings, 
  LogOut, 
  GraduationCap,
  Menu,
  X,
  BellRing
} from 'lucide-react';
import { UserSession } from '../types';

export type NavTab = 'dashboard' | 'presensi' | 'rekap' | 'siswa' | 'random-call' | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  user: UserSession | null;
  onLogout: () => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  user,
  onLogout,
  mobileOpen,
  setMobileOpen
}) => {
  const navItems = [
    { id: 'dashboard' as NavTab, label: 'Dashboard', icon: LayoutDashboard, desc: 'Ringkasan harian' },
    { id: 'presensi' as NavTab, label: 'Presensi', icon: QrCode, desc: 'Scan QR & manual' },
    { id: 'rekap' as NavTab, label: 'Rekap & Laporan', icon: BarChart3, desc: 'Grafik & export Excel' },
    { id: 'siswa' as NavTab, label: 'Data Siswa', icon: Users, desc: 'Kelola & cetak kartu' },
    { id: 'random-call' as NavTab, label: 'Panggil Acak', icon: BellRing, desc: 'Animasi & suara' },
    { id: 'settings' as NavTab, label: 'Koneksi & Panduan', icon: Settings, desc: 'Supabase & backend' },
  ];

  const visibleNavItems = user?.role === 'Siswa'
    ? navItems.filter(item => item.id === 'dashboard' || item.id === 'presensi')
    : navItems;

  return (
    <>
      {/* Mobile Topbar */}
      <div className="lg:hidden flex items-center justify-between bg-slate-900 text-white px-4 py-3 border-b border-slate-800 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-sm">
            8G
          </div>
          <div>
            <h1 className="font-bold text-sm leading-none">Presensi 8.G</h1>
            <p className="text-[11px] text-slate-400">SMP Negeri Absensi</p>
          </div>
        </div>
        <button
          id="btnToggleMobileMenu"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 active:scale-95 transition"
          aria-label="Toggle Menu"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed lg:static top-0 bottom-0 left-0 z-50
        w-64 bg-slate-900 text-slate-200 flex flex-col border-r border-slate-800
        transition-transform duration-200 ease-in-out
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Brand */}
        <div className="p-5 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20 font-black text-lg">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <div className="font-bold text-slate-100 text-base leading-tight">Presensi 8.G</div>
              <div className="text-xs text-slate-400 font-medium">Sistem Absensi Digital</div>
            </div>
          </div>
        </div>

        {/* User Chip */}
        {user && (
          <div className="mx-4 my-3 p-2.5 rounded-xl bg-slate-800/70 border border-slate-700/50 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center text-xs border border-blue-500/30">
              {user.nama ? user.nama.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-slate-200 truncate">{user.nama}</div>
              <div className="text-[10px] text-blue-400 uppercase tracking-wider font-semibold">{user.role || 'Admin'}</div>
            </div>
          </div>
        )}

        {/* Navigation items */}
        <nav className="flex-1 px-3 py-3 space-y-1.5 overflow-y-auto">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                onClick={() => {
                  onSelectTab(item.id);
                  setMobileOpen(false);
                }}
                className={`
                  w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all text-left
                  ${isActive 
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 font-semibold' 
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-slate-100'
                  }
                `}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <div className="min-w-0 flex-1">
                  <div className="truncate leading-tight">{item.label}</div>
                  <div className={`text-[10px] truncate ${isActive ? 'text-blue-100' : 'text-slate-500'}`}>
                    {item.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Bottom / Logout */}
        <div className="p-3 border-t border-slate-800/80">
          <button
            id="btnLogout"
            onClick={onLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Keluar (Logout)</span>
          </button>
        </div>
      </aside>
    </>
  );
};
