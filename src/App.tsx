/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Sidebar, NavTab } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { PresensiView } from './components/PresensiView';
import { RekapView } from './components/RekapView';
import { SiswaView } from './components/SiswaView';
import { RandomCallView } from './components/RandomCallView';
import { SettingsView } from './components/SettingsView';
import { LoginView } from './components/LoginView';
import { getSession, clearSession, saveSession } from './services/api';
import { supabase } from './lib/supabase';
import { UserSession } from './types';

export default function App() {
  const [user, setUser] = useState<UserSession | null>(null);
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const savedUser = getSession();
    if (savedUser) {
      setUser(savedUser);
    }

    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!session?.user) {
          clearSession();
          setUser(null);
          return;
        }

        const nextUser: UserSession = {
          username: session.user.email || session.user.user_metadata?.full_name || 'user',
          nama: session.user.user_metadata?.full_name || session.user.email || 'User',
          role: 'Pengunjung',
          token: session.access_token,
          email: session.user.email || undefined,
          provider: 'supabase'
        };

        saveSession(nextUser);
        setUser(nextUser);
      });

      setIsReady(true);
      return () => subscription.unsubscribe();
    }

    setIsReady(true);
  }, []);

  const handleLogout = () => {
    clearSession();
    setUser(null);
    setCurrentTab('dashboard');
  };

  const handleLoginSuccess = (loggedInUser: UserSession) => {
    setUser(loggedInUser);
    setCurrentTab('dashboard');
  };

  if (!isReady) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">
        Memuat aplikasi...
      </div>
    );
  }

  // If not logged in, show login page
  if (!user) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-100 text-slate-800 font-sans">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        user={user}
        onLogout={handleLogout}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto max-h-screen">
        {currentTab === 'dashboard' && <DashboardView onNavigate={setCurrentTab} userRole={user?.role} />}
        {currentTab === 'presensi' && <PresensiView />}
        {currentTab === 'rekap' && <RekapView userRole={user?.role} />}
        {currentTab === 'siswa' && <SiswaView />}
        {currentTab === 'random-call' && <RandomCallView />}
        {currentTab === 'settings' && <SettingsView />}
      </main>
    </div>
  );
}
