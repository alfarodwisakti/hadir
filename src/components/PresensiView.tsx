import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  Square, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  Upload, 
  Sparkles, 
  History, 
  Clock,
  UserCheck,
  Video,
  Volume2
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { callAPI, formatTanggal, formatJam, DEFAULT_KELAS } from '../services/api';
import { Siswa, StatusPresensi, MetodePresensi } from '../types';

interface SessionLogItem {
  nomorQr: string;
  nama: string;
  status: StatusPresensi;
  metode: MetodePresensi;
  jam: string;
}

export const PresensiView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'scan' | 'manual'>('scan');
  const [siswaList, setSiswaList] = useState<Siswa[]>([]);
  const [sessionLogs, setSessionLogs] = useState<SessionLogItem[]>([]);
  
  // Scanner state
  const [isScanning, setIsScanning] = useState(false);
  const [scannerStatus, setScannerStatus] = useState<string>('Tekan "Mulai Kamera" untuk mengaktifkan pemindaian barcode/QR.');
  const [notif, setNotif] = useState<{ message: string; isError: boolean; time: string } | null>(null);
  const [selectedFacing, setSelectedFacing] = useState<string>('environment');
  const [availableCameras, setAvailableCameras] = useState<Array<{ id: string; label: string }>>([]);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isCooldownRef = useRef(false);

  // Manual Tab state
  const [manualQuery, setManualQuery] = useState('');
  const [manualNomorQr, setManualNomorQr] = useState('');
  const [manualNama, setManualNama] = useState('');
  const [manualStatus, setManualStatus] = useState<StatusPresensi>('Hadir');
  const [manualKeterangan, setManualKeterangan] = useState('');
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [submittingManual, setSubmittingManual] = useState(false);

  // Play audio beep
  const playBeep = (isSuccess: boolean) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      if (isSuccess) {
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.2);
      } else {
        osc.frequency.setValueAtTime(300, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.3);
      }
    } catch {
      // Audio context might be restricted before user gesture
    }
  };

  // Load students for cache & manual autocomplete
  useEffect(() => {
    const loadStudents = async () => {
      const res = await callAPI("getDaftarSiswa", { kelas: DEFAULT_KELAS });
      if (res.success && Array.isArray(res.data)) {
        setSiswaList(res.data);
      }
    };
    loadStudents();

    // Check cameras
    if (navigator.mediaDevices && typeof Html5Qrcode !== "undefined") {
      Html5Qrcode.getCameras().then(devices => {
        if (devices && devices.length) {
          setAvailableCameras(devices);
        }
      }).catch(err => {
        console.warn("Kamera devices check:", err);
      });
    }

    return () => {
      stopScanner();
    };
  }, []);

  const showNotification = (message: string, isError: boolean) => {
    setNotif({
      message,
      isError,
      time: formatJam()
    });
  };

  const handleAttendance = async (nomorQr: string, statusInput: StatusPresensi, metode: MetodePresensi, keterangan: string = "") => {
    const nowJam = formatJam();
    const res = await callAPI("simpanPresensi", {
      nomorQr,
      status: statusInput,
      metode,
      keterangan,
      kelas: DEFAULT_KELAS,
      tanggal: formatTanggal(),
      jam: nowJam
    });

    if (res.success) {
      playBeep(true);
      const studentName = res.nama || "Siswa";
      const finalStatus = res.status || statusInput;
      showNotification(`✅ Presensi Berhasil: ${studentName} (${nomorQr}) — Status: ${finalStatus}`, false);
      
      setSessionLogs(prev => [
        {
          nomorQr,
          nama: studentName,
          status: finalStatus,
          metode,
          jam: nowJam
        },
        ...prev
      ]);
    } else {
      playBeep(false);
      showNotification(`⚠️ ${res.message || 'Gagal mencatat presensi'} (Nomor: ${nomorQr})`, true);
    }
    return res;
  };

  const startScanner = async () => {
    if (isScanning) return;
    setScannerStatus('Membuka kamera...');

    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode("reader");
      }

      const qrConfig = { 
        fps: 15, 
        qrbox: { width: 260, height: 260 },
        aspectRatio: 1.0
      };

      const cameraMode = selectedFacing.length > 20 
        ? selectedFacing 
        : { facingMode: selectedFacing === 'user' ? 'user' : 'environment' };

      await html5QrCodeRef.current.start(
        cameraMode,
        qrConfig,
        async (decodedText) => {
          if (isCooldownRef.current) return;
          const cleaned = String(decodedText || "").trim();
          if (!cleaned) return;

          isCooldownRef.current = true;
          setScannerStatus(`Memproses kode: ${cleaned}...`);

          await handleAttendance(cleaned, "Hadir", "Scan");

          setTimeout(() => {
            isCooldownRef.current = false;
            setScannerStatus('Scanner aktif. Arahkan barcode/QR ke kamera.');
          }, 3000);
        },
        () => {
          // Frame error (normal during search)
        }
      );

      setIsScanning(true);
      setScannerStatus('Scanner aktif. Arahkan barcode atau QR Code ke dalam kotak.');
    } catch (err: any) {
      console.error("Camera start error:", err);
      setIsScanning(false);
      const errName = err?.name || '';
      if (errName === 'NotAllowedError') {
        setScannerStatus('Izin kamera ditolak. Izinkan akses kamera pada browser Anda.');
      } else if (errName === 'NotFoundError') {
        setScannerStatus('Kamera tidak ditemukan pada perangkat ini.');
      } else {
        setScannerStatus(`Kamera tidak dapat dibuka (${err?.message || 'Gagal akses'}). Gunakan tombol tes atau input manual.`);
      }
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current && isScanning) {
      try {
        await html5QrCodeRef.current.stop();
        await html5QrCodeRef.current.clear();
      } catch (err) {
        console.warn("Scanner stop error:", err);
      } finally {
        setIsScanning(false);
        setScannerStatus('Scanner dihentikan.');
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScannerStatus('Memindai gambar yang diunggah...');
    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode("reader");
      }
      const decoded = await html5QrCodeRef.current.scanFile(file, true);
      const cleaned = String(decoded || "").trim();
      if (cleaned) {
        await handleAttendance(cleaned, "Hadir", "Scan", "Upload Barcode");
      }
    } catch {
      showNotification('⚠️ Barcode/QR tidak terdeteksi pada gambar yang diunggah.', true);
    } finally {
      e.target.value = '';
    }
  };

  // Manual Submit
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualNomorQr) {
      showNotification('Pilih siswa dari saran pencarian terlebih dahulu.', true);
      return;
    }

    setSubmittingManual(true);
    const res = await handleAttendance(manualNomorQr, manualStatus, "Manual", manualKeterangan);
    setSubmittingManual(false);

    if (res.success) {
      setManualQuery('');
      setManualNomorQr('');
      setManualNama('');
      setManualKeterangan('');
    }
  };

  const filteredAutocomplete = manualQuery.trim() === '' ? [] : siswaList.filter(s => {
    const q = manualQuery.toLowerCase();
    return s.nama.toLowerCase().includes(q) || s.nomorQr.toLowerCase().includes(q);
  }).slice(0, 6);

  const getStatusBadge = (status: StatusPresensi) => {
    switch (status) {
      case 'Hadir':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Hadir</span>;
      case 'Terlambat':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">Terlambat</span>;
      case 'Izin':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">Izin</span>;
      case 'Sakit':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">Sakit</span>;
      case 'Alpa':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">Alpa</span>;
      default:
        return <span>{status}</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Presensi Kelas {DEFAULT_KELAS}</h1>
          <p className="text-xs text-slate-500 mt-0.5">Scan kode barcode/QR atau input manual kehadiran siswa</p>
        </div>

        {/* Tab switch */}
        <div className="flex bg-slate-200/80 p-1 rounded-xl shrink-0 self-start">
          <button
            id="tabScanBtn"
            onClick={() => {
              setActiveTab('scan');
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${
              activeTab === 'scan'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>Scan Barcode/QR</span>
          </button>
          <button
            id="tabManualBtn"
            onClick={() => {
              setActiveTab('manual');
              stopScanner();
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${
              activeTab === 'manual'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Input Manual</span>
          </button>
        </div>
      </div>

      {/* Main Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Action Area */}
        <div className="lg:col-span-7 space-y-4">
          {activeTab === 'scan' ? (
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
              {/* Controls */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[200px]">
                  <select
                    id="cameraSelector"
                    value={selectedFacing}
                    onChange={(e) => setSelectedFacing(e.target.value)}
                    disabled={isScanning}
                    className="w-full text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 outline-hidden"
                  >
                    <option value="environment">📷 Kamera Belakang (Utama)</option>
                    <option value="user">🤳 Kamera Depan (Selfie)</option>
                    {availableCameras.map(cam => (
                      <option key={cam.id} value={cam.id}>
                        {cam.label || `Kamera ${cam.id.slice(0, 8)}`}
                      </option>
                    ))}
                  </select>
                </div>

                {!isScanning ? (
                  <button
                    id="btnStartScanner"
                    onClick={startScanner}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-xl text-xs sm:text-sm transition shadow-xs active:scale-95"
                  >
                    <Video className="w-4 h-4" />
                    <span>Mulai Kamera</span>
                  </button>
                ) : (
                  <button
                    id="btnStopScanner"
                    onClick={stopScanner}
                    className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold px-4 py-2 rounded-xl text-xs sm:text-sm transition shadow-xs active:scale-95"
                  >
                    <Square className="w-4 h-4" />
                    <span>Hentikan Kamera</span>
                  </button>
                )}

                {/* Upload Image alternative */}
                <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer transition">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Foto</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                </label>
              </div>

              {/* Reader Viewport */}
              <div className="relative rounded-2xl overflow-hidden bg-slate-950 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center min-h-[300px]">
                <div id="reader" className="w-full h-full max-w-[420px]" />
                
                {!isScanning && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-900/90 text-slate-200">
                    <div className="w-14 h-14 rounded-2xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center mb-3">
                      <Camera className="w-7 h-7" />
                    </div>
                    <p className="text-sm font-semibold text-slate-100 mb-1">Kamera Siap Digunakan</p>
                    <p className="text-xs text-slate-400 max-w-xs mb-4">
                      Arahkan barcode atau QR kartu pelajar 8.G untuk presensi instan.
                    </p>
                    <button
                      onClick={startScanner}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-blue-600/20"
                    >
                      Buka Scanner Kamera
                    </button>
                  </div>
                )}
              </div>

              {/* Status Bar */}
              <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                <span className="font-medium truncate">{scannerStatus}</span>
                <span className="flex items-center gap-1 text-[11px] text-slate-400 shrink-0 ml-2">
                  <Volume2 className="w-3.5 h-3.5" /> Audio Suara Aktif
                </span>
              </div>

              {/* Quick Testing Barcode Simulator for Easy Demo */}
              <div className="pt-3 border-t border-slate-100">
                <div className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>Tes Cepat Barcode Siswa (Simulasi Scan):</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {siswaList.slice(0, 6).map(s => (
                    <button
                      key={s.nomorQr}
                      onClick={() => handleAttendance(s.nomorQr, "Hadir", "Scan", "Simulasi Scan")}
                      className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 border border-slate-200 transition font-mono"
                    >
                      {s.nomorQr} - {s.nama.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Manual Input Form */
            <form onSubmit={handleManualSubmit} className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
              <div className="relative">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Cari Nama Siswa atau Nomor QR
                </label>
                <div className="relative">
                  <input
                    id="manualSearchInput"
                    type="text"
                    placeholder="Ketik nama (misal: Ahmad) atau nomor QR (misal: 2408001)..."
                    value={manualQuery}
                    onChange={(e) => {
                      setManualQuery(e.target.value);
                      setShowAutocomplete(true);
                      if (manualNomorQr && e.target.value !== `${manualNama} (${manualNomorQr})`) {
                        setManualNomorQr('');
                        setManualNama('');
                      }
                    }}
                    onFocus={() => setShowAutocomplete(true)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 pl-10 text-sm focus:ring-2 focus:ring-blue-500 outline-hidden font-medium"
                    required
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                </div>

                {/* Autocomplete Dropdown */}
                {showAutocomplete && filteredAutocomplete.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-lg z-20 overflow-hidden divide-y divide-slate-100">
                    {filteredAutocomplete.map(s => (
                      <button
                        key={s.nomorQr}
                        type="button"
                        onClick={() => {
                          setManualNomorQr(s.nomorQr);
                          setManualNama(s.nama);
                          setManualQuery(`${s.nama} (${s.nomorQr})`);
                          setShowAutocomplete(false);
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm hover:bg-blue-50 flex items-center justify-between transition"
                      >
                        <span className="font-semibold text-slate-800">{s.nama}</span>
                        <span className="text-xs font-mono font-bold text-blue-600 bg-blue-100/60 px-2 py-0.5 rounded">
                          {s.nomorQr}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Status Kehadiran Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Status Kehadiran
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['Hadir', 'Izin', 'Sakit', 'Alpa'] as StatusPresensi[]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setManualStatus(st)}
                      className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-bold border transition text-center ${
                        manualStatus === st
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Keterangan */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Keterangan (Opsional)
                </label>
                <textarea
                  id="manualKetInput"
                  rows={2}
                  value={manualKeterangan}
                  onChange={(e) => setManualKeterangan(e.target.value)}
                  placeholder="Contoh: Sakit flu demam, ada acara keluarga, dsb."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-hidden font-medium"
                />
              </div>

              {/* Submit Button */}
              <button
                id="btnSubmitManual"
                type="submit"
                disabled={submittingManual || !manualNomorQr}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition shadow-md shadow-blue-600/20 active:scale-98"
              >
                {submittingManual ? 'Menyimpan Presensi...' : 'Simpan Presensi Manual'}
              </button>
            </form>
          )}

          {/* Result Notification Banner */}
          {notif && (
            <div className={`p-4 rounded-xl border flex items-start gap-3 transition-all ${
              notif.isError 
                ? 'bg-rose-50 border-rose-200 text-rose-800' 
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}>
              {notif.isError ? (
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <div className="font-semibold text-sm">{notif.message}</div>
                <div className="text-[11px] opacity-75 mt-0.5">Waktu: {notif.time}</div>
              </div>
            </div>
          )}
        </div>

        {/* Right Area: Session Logs */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-blue-600" />
              <h2 className="font-bold text-sm text-slate-800">Riwayat Sesi Ini</h2>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700">
              {sessionLogs.length} Terabsen
            </span>
          </div>

          <div className="p-3 flex-1 overflow-y-auto max-h-[460px] divide-y divide-slate-100">
            {sessionLogs.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                Belum ada presensi yang dilakukan pada sesi ini.
              </div>
            ) : (
              sessionLogs.map((log, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold text-xs sm:text-sm text-slate-800">{log.nama}</div>
                    <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2">
                      <span>{log.nomorQr}</span>
                      <span>•</span>
                      <span>{log.metode}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div>{getStatusBadge(log.status)}</div>
                    <div className="text-[10px] font-mono text-slate-400 mt-1">{log.jam}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
