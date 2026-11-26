import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, CheckCircle2, Lock, Clock, Users } from 'lucide-react';

interface SessionSummaryItem {
  id: string;
  examId: string;
  examTitle: string;
  subject: string;
  studentName: string;
  absenNumber: string;
  startedAt: number;
  endsAt: number;
  unlockAt: number;
  status: 'active' | 'locked' | 'finished';
  violationCount: number;
  lastViolation: { time: number; reason: string } | null;
  finishedAt?: number;
  remainingSeconds: number;
}

interface MonitorTabProps {
  onOpenProctor: () => void;
}

function formatSeconds(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function MonitorTab({ onOpenProctor }: MonitorTabProps) {
  const [sessions, setSessions] = useState<SessionSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/sessions/summary');
      if (!res.ok) return;
      const data = await res.json();
      setSessions(data.sessions || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
    const timer = window.setInterval(fetchSummary, 4000);
    return () => window.clearInterval(timer);
  }, [fetchSummary]);

  const activeCount = sessions.filter((s) => s.status === 'active').length;
  const lockedCount = sessions.filter((s) => s.status === 'locked').length;
  const finishedCount = sessions.filter((s) => s.status === 'finished').length;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Pantau Kehadiran &amp; Fokus Kelas 5D
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">
            Ringkasan siswa yang sedang mengerjakan ujian sesuai jadwal. Untuk membuka kunci siswa
            atau menambah jadwal ulangan, masuk ke Panel Guru.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={fetchSummary}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Segarkan
          </button>
          <button
            type="button"
            onClick={onOpenProctor}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
          >
            Kelola di Panel Guru
          </button>
        </div>
      </div>

      {/* Summary Strip */}
      <div className="mt-8 grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-white p-6 sm:grid-cols-4">
        <div>
          <span className="text-xs font-medium text-slate-500">Total Masuk</span>
          <p className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {sessions.length}
          </p>
        </div>
        <div>
          <span className="text-xs font-medium text-slate-500">Sedang Mengerjakan</span>
          <p className="mt-1 font-mono text-2xl font-bold text-sky-700 tabular-nums">
            {activeCount}
          </p>
        </div>
        <div>
          <span className="text-xs font-medium text-slate-500">Terkunci Pelanggaran</span>
          <p className="mt-1 font-mono text-2xl font-bold text-red-700 tabular-nums">
            {lockedCount}
          </p>
        </div>
        <div>
          <span className="text-xs font-medium text-slate-500">Sudah Selesai</span>
          <p className="mt-1 font-mono text-2xl font-bold text-emerald-700 tabular-nums">
            {finishedCount}
          </p>
        </div>
      </div>

      {/* Student Table */}
      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">Memuat data sesi siswa...</div>
        ) : sessions.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="mx-auto h-9 w-9 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-800">
              Belum ada siswa yang masuk ujian
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Siswa yang memasukkan nama, nomor absen, dan token akan tampil otomatis di sini.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-5 py-3.5">Absen</th>
                  <th className="px-5 py-3.5">Nama Siswa</th>
                  <th className="px-5 py-3.5">Ulangan / Mapel</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Sisa Waktu</th>
                  <th className="px-5 py-3.5">Pelanggaran Fokus</th>
                  <th className="px-5 py-3.5">Catatan Terakhir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sessions.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3.5 font-mono font-semibold text-slate-900 tabular-nums">
                      {item.absenNumber}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-slate-900">
                      {item.studentName}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-600">
                      <span className="font-semibold text-slate-800">{item.subject}</span>
                      <span className="block text-slate-500">{item.examTitle}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      {item.status === 'active' && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700">
                          <Clock className="h-3.5 w-3.5" />
                          Mengerjakan
                        </span>
                      )}
                      {item.status === 'locked' && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700">
                          <Lock className="h-3.5 w-3.5" />
                          Terkunci
                        </span>
                      )}
                      {item.status === 'finished' && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Selesai
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-slate-700 tabular-nums">
                      {item.status === 'finished' ? '00:00' : formatSeconds(item.remainingSeconds)}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-slate-700 tabular-nums">
                      {item.violationCount} kali
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-500">
                      {item.lastViolation ? item.lastViolation.reason : 'Fokus terjaga'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
