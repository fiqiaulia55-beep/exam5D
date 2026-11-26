import { CheckCircle2, ArrowLeft } from 'lucide-react';
import type { StudentSession, ExamPublicItem } from '../types.ts';

interface ExamFinishedProps {
  session: StudentSession;
  exam: ExamPublicItem;
  onReturnToGate: () => void;
}

export function ExamFinished({ session, exam, onReturnToGate }: ExamFinishedProps) {
  const startStr = new Date(session.startedAt).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const endStr = session.finishedAt
    ? new Date(session.finishedAt).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '-';

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-xs">
        <div className="flex items-center gap-3 text-emerald-700">
          <CheckCircle2 className="h-7 w-7 shrink-0" />
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Ulangan Telah Selesai
          </h1>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Sesi pengerjaan pada portal CBT telah ditutup. Pastikan kamu sudah menekan tombol{' '}
          <strong className="font-semibold text-slate-900">Kirim / Submit</strong> di dalam
          formulir Google Form sebelum meninggalkan tempat duduk.
        </p>

        <div className="mt-8 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-slate-50/70">
          <div className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-slate-500">Nama Siswa</span>
            <span className="font-semibold text-slate-900">{session.studentName}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-slate-500">Nomor Absen / Kelas</span>
            <span className="font-mono font-medium text-slate-900 tabular-nums">
              Absen {session.absenNumber} · {exam.className}
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-slate-500">Judul Ulangan</span>
            <span className="font-medium text-slate-900">{exam.examTitle}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-slate-500">Mata Pelajaran</span>
            <span className="font-medium text-slate-900">{exam.subject}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-slate-500">Waktu Pengerjaan</span>
            <span className="font-mono font-medium text-slate-900 tabular-nums">
              {startStr} — {endStr}
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-slate-500">Catatan Keluar Fokus</span>
            <span className="font-mono font-medium text-slate-900 tabular-nums">
              {session.violations.length} kali
            </span>
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <button
            type="button"
            onClick={onReturnToGate}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Halaman Depan
          </button>
        </div>
      </div>
    </div>
  );
}
