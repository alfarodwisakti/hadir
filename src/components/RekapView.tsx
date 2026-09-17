import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Download, 
  Calendar, 
  Search, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  HelpCircle,
  XCircle,
  FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { callAPI, DEFAULT_KELAS } from '../services/api';
import { RekapPeriodeData, SiswaRekapStat } from '../types';

interface RekapViewProps {
  userRole?: string;
}

export const RekapView: React.FC<RekapViewProps> = ({ userRole }) => {
  const formatDateInput = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const today = new Date();
  const weekAgo = new Date();
  weekAgo.setDate(today.getDate() - 6);

  const [tglMulai, setTglMulai] = useState(formatDateInput(weekAgo));
  const [tglSelesai, setTglSelesai] = useState(formatDateInput(today));
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [data, setData] = useState<RekapPeriodeData>({
    totalHadir: 0,
    totalIzin: 0,
    totalSakit: 0,
    totalAlpa: 0,
    perSiswa: []
  });

  const loadRekap = async () => {
    setLoading(true);
    try {
      const res = await callAPI("getRekapPeriode", {
        mulai: tglMulai,
        selesai: tglSelesai,
        kelas: DEFAULT_KELAS
      });

      if (res.success && res.data) {
        setData(res.data);
      }
    } catch (err) {
      console.error("Gagal memuat rekap:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRekap();
  }, []);

  // Quick Date Presets
  const setPreset = (type: 'today' | '7days' | 'month') => {
    const now = new Date();
    if (type === 'today') {
      setTglMulai(formatDateInput(now));
      setTglSelesai(formatDateInput(now));
    } else if (type === '7days') {
      const past = new Date();
      past.setDate(now.getDate() - 6);
      setTglMulai(formatDateInput(past));
      setTglSelesai(formatDateInput(now));
    } else if (type === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      setTglMulai(formatDateInput(startOfMonth));
      setTglSelesai(formatDateInput(now));
    }
  };

  const buildDateSequence = (start: string, end: string) => {
    const normalizedStart = start || end;
    const normalizedEnd = end || start;
    const [sy, sm, sd] = normalizedStart.split('-').map(Number);
    const [ey, em, ed] = normalizedEnd.split('-').map(Number);
    const startDate = new Date(sy, (sm || 1) - 1, sd || 1);
    const endDate = new Date(ey, (em || 1) - 1, ed || 1);
    const out: string[] = [];
    const cursor = new Date(startDate);
    while (cursor <= endDate) {
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, '0');
      const d = String(cursor.getDate()).padStart(2, '0');
      out.push(`${y}-${m}-${d}`);
      cursor.setDate(cursor.getDate() + 1);
    }
    return out;
  };

  const buildDailySheetRows = () => {
    const rows: any[][] = [
      ['REKAP PRESENSI (HARIAN)', '', '', '', '', '', '', ''],
      ['KELAS 8.G TAHUN AJARAN 2026/2027', '', '', '', '', '', '', ''],
      ['SMP NEGERI 18 PADANG', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
      ['Hari/Tanggal:', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
      ['No.', 'Nama Siswa', 'kelas', 'Status Presensi', '', '', '', '%Kehadiran', 'Status Evaluasi'],
      ['', '', '', 'Hadir', 'Izin', 'Sakit', 'Alpa', '', '']
    ];

    const dateLabel = tglMulai === tglSelesai ? `Hari/Tanggal: ${tglMulai}` : `Hari/Tanggal: ${tglMulai} s/d ${tglSelesai}`;
    rows[4][0] = dateLabel;

    const studentRows = filteredStudents.length > 0 ? filteredStudents : data.perSiswa;
    studentRows.forEach((s, index) => {
      const row = [index + 1, s.nama, DEFAULT_KELAS, s.hadir, s.izin, s.sakit, s.alpa, `${s.persenHadir}%`, s.persenHadir < 75 ? 'Perlu Perhatian (<75%)' : 'Baik'];
      rows.push(row);
    });

    return rows;
  };

  const buildWeeklySheetRows = () => {
    const dates = buildDateSequence(tglMulai, tglSelesai);
    const rowCount = 11 + Math.max(data.perSiswa.length, filteredStudents.length, 1);
    const rows: any[][] = Array.from({ length: rowCount }, () => Array(28).fill(''));

    rows[0][0] = 'REKAP PRESENSI (MINGGUAN)';
    rows[1][0] = 'KELAS 8.G TAHUN AJARAN 2026/2027';
    rows[2][0] = 'SMP NEGERI 18 PADANG';
    rows[4][0] = 'Minggu Ke- :';
    rows[5][0] = 'Bulan :';
    rows[6][0] = 'Tahun :';

    rows[8][0] = 'No.';
    rows[8][1] = 'Nama Siswa';
    rows[8][2] = 'kelas';
    rows[8][3] = 'STATUS PRESENSI';
    rows[8][23] = '%Kehadiran';
    rows[8][24] = 'Status  Evaluasi';

    const statusStartColumn = 3;
    dates.slice(0, 5).forEach((date, index) => {
      const groupStart = statusStartColumn + index * 5;
      rows[9][groupStart] = '(Hari/Tanggal)';
      rows[10][groupStart] = 'Hadir';
      rows[10][groupStart + 1] = 'Izin';
      rows[10][groupStart + 2] = 'Sakit';
      rows[10][groupStart + 3] = 'Alpa';
      rows[9][groupStart + 4] = date;
    });

    const studentRows = filteredStudents.length > 0 ? filteredStudents : data.perSiswa;
    studentRows.forEach((s, index) => {
      const rowIndex = 11 + index;
      rows[rowIndex][0] = index + 1;
      rows[rowIndex][1] = s.nama;
      rows[rowIndex][2] = DEFAULT_KELAS;
      rows[rowIndex][23] = `${s.persenHadir}%`;
      rows[rowIndex][24] = s.persenHadir < 75 ? 'Perlu Perhatian (<75%)' : 'Baik';

      const statusDefault = [s.hadir, s.izin, s.sakit, s.alpa];
      const firstGroupStart = 3;
      statusDefault.forEach((value, statusIndex) => {
        rows[rowIndex][firstGroupStart + statusIndex] = value;
      });
    });

    return rows;
  };

  // Export to Excel .xlsx using SheetJS
  const exportToExcel = () => {
    if (!data.perSiswa || data.perSiswa.length === 0) {
      alert("Tidak ada data untuk diekspor. Silakan tampilkan rekap terlebih dahulu.");
      return;
    }

    const isDaily = tglMulai === tglSelesai;
    const rows = isDaily ? buildDailySheetRows() : buildWeeklySheetRows();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, isDaily ? 'REKAP HARIAN' : 'REKAP MINGGUAN');

    ws['!cols'] = [
      { wch: 10 },
      { wch: 28 },
      { wch: 10 },
      { wch: 12 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
      { wch: 22 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 }
    ];

    const fileName = `Rekap-Presensi-${isDaily ? 'Harian' : 'Mingguan'}_${tglMulai}${isDaily ? '' : `-sd-${tglSelesai}`}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const filteredStudents = data.perSiswa.filter(s => {
    const q = searchQuery.toLowerCase();
    return s.nama.toLowerCase().includes(q) || s.nomorQr.toLowerCase().includes(q);
  });

  const totalLogs = data.totalHadir + data.totalIzin + data.totalSakit + data.totalAlpa;
  const persenHadirOverall = totalLogs > 0 ? Math.round((data.totalHadir / totalLogs) * 100) : 0;
  const isVisitor = userRole === 'Pengunjung';

  const getStatusPill = (persen: number) => {
    if (persen < 75) {
      return <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold">Perlu Perhatian</span>;
    }
    if (persen < 90) {
      return <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">Cukup Baik</span>;
    }
    return <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">Sangat Baik</span>;
  };

  const isSingleDay = tglMulai === tglSelesai;

  const reportRows = filteredStudents.length > 0 ? filteredStudents : data.perSiswa;

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div className="bg-white border border-slate-300 shadow-[0_0_0_1px_rgba(148,163,184,0.14)] p-3 sm:p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-200">
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-600">Laporan Presensi</div>
            <button
              id="btnExportExcel"
              onClick={exportToExcel}
              className="flex items-center gap-2 bg-[#1f6f43] hover:bg-[#195c39] text-white font-bold px-3 py-2 text-[11px] transition"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Excel</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
            <div className="sm:col-span-4">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Dari Tanggal</label>
              <input
                id="inputTglMulai"
                type="date"
                value={tglMulai}
                onChange={(e) => setTglMulai(e.target.value)}
                className="w-full border border-slate-300 bg-white px-2 py-2 text-[12px] text-slate-700 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-4">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Sampai Tanggal</label>
              <input
                id="inputTglSelesai"
                type="date"
                value={tglSelesai}
                onChange={(e) => setTglSelesai(e.target.value)}
                className="w-full border border-slate-300 bg-white px-2 py-2 text-[12px] text-slate-700 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-4 flex gap-2">
              <button
                id="btnFilterRekap"
                onClick={loadRekap}
                disabled={loading}
                className="w-full bg-[#1f497d] hover:bg-[#173b69] text-white font-bold py-2 px-3 text-[12px] transition"
              >
                <span>{loading ? 'Memuat Data...' : 'Tampilkan Rekap'}</span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1.5">
              <button onClick={() => setPreset('today')} className="border border-slate-300 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-700">Hari Ini</button>
              <button onClick={() => setPreset('7days')} className="border border-slate-300 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-700">7 Hari</button>
              <button onClick={() => setPreset('month')} className="border border-slate-300 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-700">Bulan Ini</button>
            </div>

            <div className="relative w-full max-w-xs">
              <input
                type="text"
                placeholder="Cari siswa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full border border-slate-300 bg-white px-2 py-1.5 pl-8 text-[12px] text-slate-700 focus:outline-none"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </div>
          </div>
        </div>
      </div>

      <div className="sheet-report bg-white border border-slate-300 shadow-[0_0_0_1px_rgba(148,163,184,0.18)] overflow-hidden font-['Arial','Helvetica',sans-serif] text-slate-900">
        <div className="px-3 py-3 sm:px-5 sm:py-5">
          <div className="text-[18px] font-bold leading-none">{isSingleDay ? 'REKAP PRESENSI (HARIAN)' : 'REKAP PRESENSI (MINGGUAN)'}</div>
          <div className="mt-2 text-[18px] font-bold">KELAS 8.G TAHUN AJARAN 2026/2027</div>
          <div className="mt-2 text-[18px] font-bold">SMP NEGERI 18 PADANG</div>

          {isSingleDay ? (
            <>
              <div className="mt-6 text-[13px] font-bold">Hari/Tanggal: {tglMulai}</div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full border-collapse border border-[#000] text-[12px]">
                  <thead>
                    <tr>
                      <th className="border border-[#000] bg-[#1f497d] px-2 py-2 text-center font-bold text-white" style={{ width: 60 }}>No.</th>
                      <th className="border border-[#000] bg-[#1f497d] px-2 py-2 text-center font-bold text-white" style={{ width: 220 }}>Nama Siswa</th>
                      <th className="border border-[#000] bg-[#1f497d] px-2 py-2 text-center font-bold text-white" style={{ width: 90 }}>kelas</th>
                      <th className="border border-[#000] bg-[#d9e2f3] px-2 py-2 text-center font-bold text-slate-900" colSpan={4}>Status Presensi</th>
                      <th className="border border-[#000] bg-[#1f497d] px-2 py-2 text-center font-bold text-white" style={{ width: 100 }}>%Kehadiran</th>
                      <th className="border border-[#000] bg-[#1f497d] px-2 py-2 text-center font-bold text-white" style={{ width: 120 }}>Status Evaluasi</th>
                    </tr>
                    <tr>
                      <th className="border border-[#000] bg-[#1f497d] px-2 py-2 text-center font-bold text-white"></th>
                      <th className="border border-[#000] bg-[#1f497d] px-2 py-2 text-center font-bold text-white"></th>
                      <th className="border border-[#000] bg-[#1f497d] px-2 py-2 text-center font-bold text-white"></th>
                      <th className="border border-[#000] bg-[#d9e2f3] px-2 py-2 text-center font-bold text-slate-900">Hadir</th>
                      <th className="border border-[#000] bg-[#d9e2f3] px-2 py-2 text-center font-bold text-slate-900">Izin</th>
                      <th className="border border-[#000] bg-[#d9e2f3] px-2 py-2 text-center font-bold text-slate-900">Sakit</th>
                      <th className="border border-[#000] bg-[#d9e2f3] px-2 py-2 text-center font-bold text-slate-900">Alpa</th>
                      <th className="border border-[#000] bg-[#1f497d] px-2 py-2 text-center font-bold text-white"></th>
                      <th className="border border-[#000] bg-[#1f497d] px-2 py-2 text-center font-bold text-white"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportRows.map((s, index) => (
                      <tr key={s.nomorQr}>
                        <td className="border border-[#000] px-2 py-2 text-center font-bold">{index + 1}</td>
                        <td className="border border-[#000] px-2 py-2 font-normal">{s.nama}</td>
                        <td className="border border-[#000] px-2 py-2 text-center">{DEFAULT_KELAS}</td>
                        <td className="border border-[#000] px-2 py-2 text-center">{s.hadir}</td>
                        <td className="border border-[#000] px-2 py-2 text-center">{s.izin}</td>
                        <td className="border border-[#000] px-2 py-2 text-center">{s.sakit}</td>
                        <td className="border border-[#000] px-2 py-2 text-center">{s.alpa}</td>
                        <td className="border border-[#000] px-2 py-2 text-center font-bold">{s.persenHadir}%</td>
                        <td className="border border-[#000] px-2 py-2 text-center">{s.persenHadir < 75 ? 'Perlu Perhatian (<75%)' : 'Baik'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <>
              <div className="mt-6 text-[13px] font-bold">Minggu Ke- : &nbsp;&nbsp; Bulan : &nbsp;&nbsp; Tahun :</div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full border-collapse border border-[#000] text-[12px]">
                  <thead>
                    <tr>
                      <th className="border border-[#000] bg-[#1f497d] px-2 py-2 text-center font-bold text-white" rowSpan={2} style={{ width: 60 }}>No.</th>
                      <th className="border border-[#000] bg-[#1f497d] px-2 py-2 text-center font-bold text-white" rowSpan={2} style={{ width: 220 }}>Nama Siswa</th>
                      <th className="border border-[#000] bg-[#1f497d] px-2 py-2 text-center font-bold text-white" rowSpan={2} style={{ width: 90 }}>kelas</th>
                      <th className="border border-[#000] bg-[#d9e2f3] px-2 py-2 text-center font-bold text-slate-900" colSpan={20}>STATUS PRESENSI</th>
                      <th className="border border-[#000] bg-[#1f497d] px-2 py-2 text-center font-bold text-white" rowSpan={2} style={{ width: 100 }}>%Kehadiran</th>
                      <th className="border border-[#000] bg-[#1f497d] px-2 py-2 text-center font-bold text-white" rowSpan={2} style={{ width: 140 }}>Status Evaluasi</th>
                    </tr>
                    <tr>
                      {Array.from({ length: 5 }).map((_, idx) => (
                        <React.Fragment key={idx}>
                          <th className="border border-[#000] bg-[#d9e2f3] px-2 py-2 text-center font-bold text-slate-900">{`(Hari/Tanggal)`}</th>
                          <th className="border border-[#000] bg-[#d9e2f3] px-2 py-2 text-center font-bold text-slate-900">Hadir</th>
                          <th className="border border-[#000] bg-[#d9e2f3] px-2 py-2 text-center font-bold text-slate-900">Izin</th>
                          <th className="border border-[#000] bg-[#d9e2f3] px-2 py-2 text-center font-bold text-slate-900">Sakit</th>
                          <th className="border border-[#000] bg-[#d9e2f3] px-2 py-2 text-center font-bold text-slate-900">Alpa</th>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reportRows.map((s, index) => (
                      <tr key={s.nomorQr}>
                        <td className="border border-[#000] px-2 py-2 text-center font-bold">{index + 1}</td>
                        <td className="border border-[#000] px-2 py-2">{s.nama}</td>
                        <td className="border border-[#000] px-2 py-2 text-center">{DEFAULT_KELAS}</td>
                        {Array.from({ length: 5 }).map((_, groupIndex) => (
                          <React.Fragment key={`${s.nomorQr}-${groupIndex}`}>
                            <td className="border border-[#000] px-2 py-2 text-center">{groupIndex === 0 ? '' : ''}</td>
                            <td className="border border-[#000] px-2 py-2 text-center">{groupIndex === 0 ? s.hadir : ''}</td>
                            <td className="border border-[#000] px-2 py-2 text-center">{groupIndex === 0 ? s.izin : ''}</td>
                            <td className="border border-[#000] px-2 py-2 text-center">{groupIndex === 0 ? s.sakit : ''}</td>
                            <td className="border border-[#000] px-2 py-2 text-center">{groupIndex === 0 ? s.alpa : ''}</td>
                          </React.Fragment>
                        ))}
                        <td className="border border-[#000] px-2 py-2 text-center font-bold">{s.persenHadir}%</td>
                        <td className="border border-[#000] px-2 py-2 text-center">{s.persenHadir < 75 ? 'Perlu Perhatian (<75%)' : 'Baik'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
