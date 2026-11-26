import { useState, useEffect } from 'react';
import {
  Lock,
  ShieldCheck,
  Clock,
  KeyRound,
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Ban,
} from 'lucide-react';
import type { ExamPublicItem, PortalPublicPayload } from '../types.ts';

interface StudentGateProps {
  portal: PortalPublicPayload;
  onAttemptStart: (
    examId: string,
    studentName: string,
    absenNumber: string,
    token: string
  ) => Promise<void>;
  onOpenProctor: () => void;
}

function formatScheduleRange(exam: ExamPublicItem): string {
  if (exam.availabilityMode === 'manual_open') {
    return 'Dibuka Manual oleh Guru';
  }
  if (exam.availabilityMode === 'closed') {
    return 'Ditutup Sementara';
  }
  if (!exam.scheduledStart || !exam.scheduledEnd) {
    return 'Jadwal belum diatur';
  }
  const start = new Date(exam.scheduledStart);
  const end = new Date(exam.scheduledEnd);
  const datePart = start.toLocaleDateString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const startTime = start.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const endTime = end.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${datePart} · ${startTime} — ${endTime}`;
}

export function StudentGate({
  portal,
  onAttemptStart,
  onOpenProctor,
}: StudentGateProps) {
  const { settings, exams } = portal;

  const [selectedExamId, setSelectedExamId] = useState<string>(() => {
    const firstOpen = exams.find((e) => e.computedStatus === 'open');
    return firstOpen?.id || exams[0]?.id || '';
  });

  // Keep selectedExamId valid when list updates
  useEffect(() => {
    if (exams.length === 0) {
      setSelectedExamId('');
      return;
    }
    const stillExists = exams.some((e) => e.id === selectedExamId);
    if (!stillExists) {
      const firstOpen = exams.find((e) => e.computedStatus === 'open');
      setSelectedExamId(firstOpen?.id || exams[0].id);
    }
  }, [exams, selectedExamId]);

  const selectedExam = exams.find((e) => e.id === selectedExamId) || null;

  const [studentName, setStudentName] = useState('');
  const [absenNumber, setAbsenNumber] = useState('');
  const [token, setToken] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedExam) {
      setError('Pilih jadwal ulangan terlebih dahulu.');
      return;
    }
    if (!studentName.trim()) {
      setError('Tuliskan nama lengkap kamu terlebih dahulu.');
      return;
    }
    if (!absenNumber.trim()) {
      setError('Masukkan nomor absen kamu.');
      return;
    }
    if (!token.trim()) {
      setError('Masukkan Token Ujian yang diberikan oleh Guru.');
      return;
    }

    setSubmitting(true);
    try {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        try {
          await document.documentElement.requestFullscreen();
        } catch {
          // Handled inside ExamKioskRoom if fullscreen prompt is needed
        }
      }
      await onAttemptStart(
        selectedExam.id,
        studentName.trim(),
        absenNumber.trim(),
        token.trim().toUpperCase()
      );
    } catch (err) {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      setError(err instanceof Error ? err.message : 'Gagal memulai sesi ujian.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 lg:py-12">
      {exams.length === 0 && (
        <div className="mb-8 flex flex-col gap-4 rounded-xl border border-amber-300 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
            <div>
              <p className="text-sm font-semibold text-amber-950">
                Belum Ada Jadwal Ulangan yang Dibuat
              </p>
              <p className="mt-1 text-sm text-amber-900">
                Bapak/Ibu Guru silakan buka Panel Guru untuk menambahkan daftar ulangan beserta
                judul, mapel, jadwal, token, dan link Google Form.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenProctor}
            className="shrink-0 rounded-lg bg-amber-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-800 whitespace-nowrap"
          >
            Buat Jadwal di Panel Guru
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-stretch">
        {/* Left Column: Schedule List & Exam Rules */}
        <section className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-7 lg:col-span-7 lg:p-8">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                  <span>{settings.className}</span>
                  <span aria-hidden="true">·</span>
                  <span>{settings.defaultTeacherName}</span>
                </div>
                <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900 [text-wrap:balance] sm:text-3xl">
                  Jadwal Ulangan {settings.className}
                </h1>
              </div>

              <button
                type="button"
                onClick={onOpenProctor}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                + Kelola Jadwal
              </button>
            </div>

            <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
              Pilih mata pelajaran yang sedang berlangsung dari daftar jadwal di bawah ini, lalu
              masukkan identitas dan token ujian dari Guru.
            </p>

            {/* Scheduled Exams List */}
            <div className="mt-6 space-y-3">
              {exams.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-6 py-10 text-center">
                  <CalendarClock className="mx-auto h-8 w-8 text-slate-400" />
                  <p className="mt-2.5 text-sm font-semibold text-slate-800">
                    Daftar Jadwal Masih Kosong
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Guru dapat menambahkan lebih dari satu ulangan terjadwal melalui Panel Guru.
                  </p>
                </div>
              ) : (
                exams.map((exam) => {
                  const isSelected = exam.id === selectedExamId;
                  const status = exam.computedStatus;

                  return (
                    <button
                      key={exam.id}
                      type="button"
                      onClick={() => {
                        setSelectedExamId(exam.id);
                        setError(null);
                      }}
                      className={`w-full rounded-xl border p-4 text-left transition-colors ${
                        isSelected
                          ? 'border-sky-600 bg-sky-50/50 ring-1 ring-sky-600'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                      }`}
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="font-semibold text-sky-700">{exam.subject}</span>
                            <span aria-hidden="true">·</span>
                            <span>{exam.teacherName}</span>
                          </div>
                          <h2 className="mt-1 text-base font-bold text-slate-900">
                            {exam.examTitle}
                          </h2>
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                            <span className="inline-flex items-center gap-1.5">
                              <CalendarClock className="h-3.5 w-3.5 text-slate-400" />
                              {formatScheduleRange(exam)}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">
                              Durasi {exam.durationMinutes}m (Kunci kirim {exam.lockSubmitMinutes}m)
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0 pt-0.5">
                          {status === 'open' && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 whitespace-nowrap">
                              <CheckCircle2 className="h-4 w-4" />
                              Dibuka Sekarang
                            </span>
                          )}
                          {status === 'upcoming' && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 whitespace-nowrap">
                              <Clock className="h-4 w-4" />
                              Belum Mulai
                            </span>
                          )}
                          {status === 'ended' && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 whitespace-nowrap">
                              <Ban className="h-4 w-4" />
                              Waktu Habis
                            </span>
                          )}
                          {status === 'closed' && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 whitespace-nowrap">
                              <Lock className="h-4 w-4" />
                              Ditutup
                            </span>
                          )}
                          {status === 'no_form' && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 whitespace-nowrap">
                              <AlertTriangle className="h-4 w-4" />
                              Form Belum Diisi
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Selected Exam Rules Summary */}
            <div className="mt-7 border-t border-slate-100 pt-6">
              <h3 className="text-sm font-semibold text-slate-900">
                Ketentuan Mode Terkunci Chromebook
              </h3>
              <ol className="mt-3 space-y-2 text-xs leading-relaxed text-slate-600">
                <li className="flex gap-2.5">
                  <span className="font-mono font-semibold text-sky-700 tabular-nums">01.</span>
                  <span>
                    Setelah klik mulai, Chromebook masuk ke <strong>Layar Penuh Terkunci</strong>{' '}
                    dan tidak boleh berpindah tab atau keluar layar penuh.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <span className="font-mono font-semibold text-sky-700 tabular-nums">02.</span>
                  <span>
                    Jika keluar fokus melebihi{' '}
                    <strong>{selectedExam?.maxViolationsBeforeLock ?? 3} kali</strong>, layar
                    terkunci otomatis dan hanya bisa dibuka oleh Guru melalui Panel Guru.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <span className="font-mono font-semibold text-sky-700 tabular-nums">03.</span>
                  <span>
                    Tombol kirim dan pengakhiran sesi otomatis terbuka setelah waktu tunggu{' '}
                    <strong>{selectedExam?.lockSubmitMinutes ?? 60} menit</strong> terpenuhi.
                  </span>
                </li>
              </ol>
            </div>
          </div>

          <div className="mt-7 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-700" />
              Portal CBT Terjadwal {settings.className}
            </span>
            <span className="font-mono tabular-nums">{exams.length} Ulangan Terdaftar</span>
          </div>
        </section>

        {/* Right Column: Student Token Login Card */}
        <section className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-7 lg:col-span-5 lg:p-8">
          <div>
            <div className="flex items-center gap-2.5">
              <KeyRound className="h-5 w-5 text-sky-600" />
              <h2 className="text-xl font-bold tracking-tight text-slate-900">
                Masuk Ruang Ujian
              </h2>
            </div>

            {selectedExam ? (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <span className="block text-[11px] font-medium text-slate-500">
                  Ulangan Dipilih
                </span>
                <p className="mt-0.5 text-sm font-bold text-slate-900">
                  {selectedExam.examTitle}
                </p>
                <p className="text-xs font-medium text-sky-700">
                  {selectedExam.subject} · {selectedExam.durationMinutes} Menit
                </p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-600">
                Pilih ulangan dari daftar jadwal di samping untuk memulai.
              </p>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <div>
                <label
                  htmlFor="studentName"
                  className="block text-sm font-medium text-slate-800"
                >
                  Nama Lengkap Siswa
                </label>
                <input
                  id="studentName"
                  type="text"
                  autoComplete="off"
                  placeholder="Contoh: Ahmad Pratama"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="absenNumber"
                    className="block text-sm font-medium text-slate-800"
                  >
                    Nomor Absen
                  </label>
                  <input
                    id="absenNumber"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="Contoh: 12"
                    value={absenNumber}
                    onChange={(e) => setAbsenNumber(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20 tabular-nums"
                  />
                </div>

                <div>
                  <label
                    htmlFor="examClass"
                    className="block text-sm font-medium text-slate-800"
                  >
                    Kelas
                  </label>
                  <input
                    id="examClass"
                    type="text"
                    readOnly
                    value={settings.className}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-700"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="examToken"
                  className="block text-sm font-medium text-slate-800"
                >
                  Token Ujian
                </label>
                <input
                  id="examToken"
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Masukkan token dari Guru"
                  value={token}
                  onChange={(e) => setToken(e.target.value.toUpperCase())}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-base font-semibold tracking-wider text-slate-900 uppercase placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:tracking-normal placeholder:normal-case placeholder:text-slate-400 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
                />
              </div>

              {selectedExam && selectedExam.computedStatus !== 'open' && (
                <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs text-amber-900">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                  <span>
                    {selectedExam.computedStatus === 'upcoming' &&
                      `Ulangan ini baru dibuka pada ${formatScheduleRange(selectedExam)}.`}
                    {selectedExam.computedStatus === 'ended' &&
                      'Jadwal ulangan ini sudah selesai.'}
                    {selectedExam.computedStatus === 'closed' &&
                      'Ulangan ini sedang ditutup oleh Guru Pengawas.'}
                    {selectedExam.computedStatus === 'no_form' &&
                      'Link Google Form untuk ulangan ini belum dipasang di Panel Guru.'}
                  </span>
                </div>
              )}

              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || !selectedExam || selectedExam.computedStatus !== 'open'}
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
              >
                <span>
                  {submitting ? 'Memeriksa Token...' : 'Mulai Ujian & Kunci Layar'}
                </span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>

          <p className="mt-6 border-t border-slate-100 pt-4 text-xs leading-relaxed text-slate-500">
            Catatan: Pastikan memilih mata pelajaran yang sesuai dengan jadwal hari ini sebelum
            memasukkan token.
          </p>
        </section>
      </div>
    </main>
  );
}
