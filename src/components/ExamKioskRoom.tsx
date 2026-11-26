import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Clock,
  Lock,
  Unlock,
  AlertTriangle,
  ShieldAlert,
  Copy,
  Check,
  Maximize2,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';
import type { ActiveExamPayload } from '../types.ts';
import { normalizeGoogleFormUrl } from '../utils/formUrl.ts';

interface ExamKioskRoomProps {
  initialData: ActiveExamPayload;
  onFinished: (payload: ActiveExamPayload) => void;
}

function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const hours = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function playAlertTone(kind: 'violation' | 'unlock') {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = kind === 'violation' ? 'sawtooth' : 'sine';
    osc.frequency.setValueAtTime(kind === 'violation' ? 440 : 660, ctx.currentTime);
    if (kind === 'unlock') {
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
    }
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.36);
  } catch {
    // Ignore audio errors when autoplay policy blocks sound
  }
}

export function ExamKioskRoom({ initialData, onFinished }: ExamKioskRoomProps) {
  const [examData, setExamData] = useState<ActiveExamPayload>(initialData);
  const [nowMs, setNowMs] = useState<number>(Date.now());
  const [serverOffsetMs, setServerOffsetMs] = useState<number>(
    initialData.serverTime - Date.now()
  );
  const [focusWarning, setFocusWarning] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(Boolean(document.fullscreenElement));
  const [copiedToken, setCopiedToken] = useState(false);

  // Proctor early-finish modal
  const [showProctorModal, setShowProctorModal] = useState(false);
  const [proctorPinInput, setProctorPinInput] = useState('');
  const [proctorError, setProctorError] = useState<string | null>(null);

  // Finish confirmation modal
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [finishBusy, setFinishBusy] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [lockNotice, setLockNotice] = useState<string | null>(null);
  const [resolvedFormUrl, setResolvedFormUrl] = useState<string>(() => {
    const norm = normalizeGoogleFormUrl(initialData.googleFormUrl || '');
    return norm.embedUrl || initialData.googleFormUrl || '';
  });

  const prevUnlockedRef = useRef<boolean>(initialData.submitUnlocked);
  const lastViolationReportRef = useRef<number>(0);
  const isFinishingRef = useRef<boolean>(false);
  const sessionTokenRef = useRef<string>(
    initialData.sessionToken ||
      (typeof window !== 'undefined' ? sessionStorage.getItem('cbt_5d_session_token') || '' : '')
  );

  useEffect(() => {
    if (initialData.sessionToken && typeof window !== 'undefined') {
      sessionTokenRef.current = initialData.sessionToken;
      sessionStorage.setItem('cbt_5d_session_token', initialData.sessionToken);
    }
  }, [initialData.sessionToken]);

  const syncedNow = nowMs + serverOffsetMs;
  const remainingTotalSec = Math.max(0, Math.ceil((examData.session.endsAt - syncedNow) / 1000));
  const remainingLockSec = Math.max(0, Math.ceil((examData.session.unlockAt - syncedNow) / 1000));
  const submitUnlocked = examData.submitUnlocked || remainingLockSec <= 0;

  const activeViolations = examData.session.violations.filter((v) => !v.forgiven).length;
  const maxViolations = examData.exam.maxViolationsBeforeLock;
  const isHardLocked = examData.session.status === 'locked';

  // Play chime when 1-hour lock expires
  useEffect(() => {
    if (!prevUnlockedRef.current && submitUnlocked) {
      prevUnlockedRef.current = true;
      setLockNotice(null);
      playAlertTone('unlock');
    }
  }, [submitUnlocked]);

  // Normalize and resolve short forms.gle links so Google Form renders & submits inside iframe
  useEffect(() => {
    const raw = examData.googleFormUrl || '';
    const norm = normalizeGoogleFormUrl(raw);
    if (!norm.isShortLink) {
      setResolvedFormUrl(norm.embedUrl || raw);
      return;
    }
    let cancelled = false;
    fetch('/api/forms/resolve-short-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: norm.originalUrl }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { resolvedUrl?: string } | null) => {
        if (cancelled) return;
        if (data?.resolvedUrl) {
          setResolvedFormUrl(normalizeGoogleFormUrl(data.resolvedUrl).embedUrl || data.resolvedUrl);
        } else {
          setResolvedFormUrl(norm.embedUrl || raw);
        }
      })
      .catch(() => {
        if (!cancelled) setResolvedFormUrl(norm.embedUrl || raw);
      });
    return () => {
      cancelled = true;
    };
  }, [examData.googleFormUrl]);

  // 1-second local clock tick
  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  // Poll server every 2.5 seconds to sync unlock token & proctor remote unlock
  const syncWithServer = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (sessionTokenRef.current) {
        headers['x-session-token'] = sessionTokenRef.current;
      }
      const res = await fetch(`/api/sessions/${examData.session.id}`, { headers });
      if (!res.ok) return;
      const fresh = (await res.json()) as ActiveExamPayload;
      if (fresh.sessionToken) {
        sessionTokenRef.current = fresh.sessionToken;
        sessionStorage.setItem('cbt_5d_session_token', fresh.sessionToken);
      }
      setServerOffsetMs(fresh.serverTime - Date.now());
      setExamData((prev) => {
        if (prev.session.status === 'locked' && fresh.session.status === 'active') {
          setFocusWarning(null);
        }
        return fresh;
      });
      if (fresh.session.status === 'finished') {
        isFinishingRef.current = true;
        sessionStorage.removeItem('cbt_5d_session_token');
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
        onFinished(fresh);
      }
    } catch {
      // Transient network hiccup; next poll will recover
    }
  }, [examData.session.id, onFinished]);

  useEffect(() => {
    const poll = window.setInterval(syncWithServer, 2500);
    return () => window.clearInterval(poll);
  }, [syncWithServer]);

  // Also immediately sync when lock countdown hits 0 so server releases submitToken
  useEffect(() => {
    if (remainingLockSec === 0 && !examData.submitUnlocked) {
      syncWithServer();
    }
  }, [remainingLockSec, examData.submitUnlocked, syncWithServer]);

  const reportViolation = useCallback(
    async (reason: string) => {
      const now = Date.now();
      if (now - lastViolationReportRef.current < 1800) return;
      lastViolationReportRef.current = now;

      playAlertTone('violation');
      setFocusWarning(reason);

      try {
        const res = await fetch(`/api/sessions/${examData.session.id}/violation`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(sessionTokenRef.current ? { 'x-session-token': sessionTokenRef.current } : {}),
          },
          body: JSON.stringify({
            reason,
            sessionToken: sessionTokenRef.current || undefined,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.sessionToken) {
            sessionTokenRef.current = data.sessionToken;
            sessionStorage.setItem('cbt_5d_session_token', data.sessionToken);
          }
          setExamData((prev) => ({ ...prev, session: data.session }));
        }
      } catch {
        // Offline tolerance
      }
    },
    [examData.session.id]
  );

  // Chromebook Kiosk Lockdown Listeners
  useEffect(() => {
    const handleFullscreenChange = () => {
      const fsActive = Boolean(document.fullscreenElement);
      setIsFullscreen(fsActive);
      if (!fsActive && !isFinishingRef.current && examData.session.status !== 'finished') {
        reportViolation('Keluar dari mode Layar Penuh (Fullscreen)');
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden && examData.session.status !== 'finished') {
        reportViolation('Berpindah tab atau meminimalkan browser Chromebook');
      }
    };

    const handleWindowBlur = () => {
      window.setTimeout(() => {
        const activeTag = document.activeElement?.tagName;
        if (activeTag !== 'IFRAME' && !document.hasFocus() && examData.session.status !== 'finished') {
          reportViolation('Berpindah jendela / aplikasi lain di Chromebook');
        }
      }, 120);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (
        e.key === 'F12' ||
        e.key === 'F11' ||
        (e.ctrlKey && ['u', 's', 'p', 't', 'w', 'n', 'r', 'c', 'v', 'x'].includes(key)) ||
        (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(key)) ||
        (e.metaKey && ['t', 'w', 'n', 'r'].includes(key))
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Ujian sedang berlangsung. Jangan tutup halaman ini!';
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [examData.session.status, reportViolation]);

  const handleReturnFullscreen = async () => {
    try {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Allow resume if embedded environment blocks fullscreen
    }
    setFocusWarning(null);
  };

  const handleFinishExam = async (overridePin?: string) => {
    setFinishError(null);
    setFinishBusy(true);
    try {
      const res = await fetch(`/api/sessions/${examData.session.id}/finish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionTokenRef.current ? { 'x-session-token': sessionTokenRef.current } : {}),
        },
        body: JSON.stringify({
          proctorPin: overridePin || '',
          sessionSnapshot: examData.session,
          sessionToken: sessionTokenRef.current || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 404) {
          isFinishingRef.current = true;
          sessionStorage.removeItem('cbt_5d_session_token');
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
          }
          onFinished({
            ...examData,
            session: {
              ...examData.session,
              status: 'finished',
              finishedAt: Date.now(),
            },
          });
          return;
        }
        throw new Error(data.error || 'Belum bisa mengakhiri ujian.');
      }
      isFinishingRef.current = true;
      sessionStorage.removeItem('cbt_5d_session_token');
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      onFinished({ ...examData, session: data.session });
    } catch (err) {
      setFinishError(err instanceof Error ? err.message : 'Gagal mengakhiri ujian.');
    } finally {
      setFinishBusy(false);
    }
  };

  const handleCopySubmitToken = () => {
    if (!examData.submitToken) return;
    navigator.clipboard.writeText(examData.submitToken).catch(() => {});
    setCopiedToken(true);
    window.setTimeout(() => setCopiedToken(false), 2000);
  };

  return (
    <div className="cbt-locked-select fixed inset-0 z-50 flex flex-col bg-slate-900">
      {/* Top Kiosk Bar */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-700 bg-slate-900 px-4 py-2.5 text-white sm:px-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="truncate font-medium text-slate-200">
              {examData.session.studentName}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono whitespace-nowrap tabular-nums">
              Absen {examData.session.absenNumber}
            </span>
            <span aria-hidden="true">·</span>
            <span className="hidden sm:inline whitespace-nowrap">
              {examData.exam.className}
            </span>
          </div>
          <p className="truncate text-sm font-semibold text-white">
            {examData.exam.examTitle}{' '}
            <span className="font-normal text-slate-300">· {examData.exam.subject}</span>
          </p>
        </div>

        {/* Center Countdown & Submit Token Status */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-5">
          {/* Main Exam Timer */}
          <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5">
            <Clock
              className={`h-4 w-4 shrink-0 ${
                remainingTotalSec <= 300 ? 'text-amber-400' : 'text-sky-400'
              }`}
            />
            <div className="leading-none">
              <span className="block text-[10px] text-slate-400">Sisa Waktu</span>
              <span className="font-mono text-sm font-semibold tracking-wide text-white tabular-nums">
                {formatDuration(remainingTotalSec)}
              </span>
            </div>
          </div>

          {/* Submit Token Reveal Box (if enabled) */}
          {examData.exam.enableSubmitToken && (
            <div
              className={`flex items-center gap-2.5 rounded-lg border px-3 py-1.5 ${
                submitUnlocked
                  ? 'border-emerald-500/50 bg-emerald-950/60'
                  : 'border-slate-700 bg-slate-800'
              }`}
            >
              {submitUnlocked ? (
                <Unlock className="h-4 w-4 shrink-0 text-emerald-400" />
              ) : (
                <Lock className="h-4 w-4 shrink-0 text-amber-400" />
              )}
              <div className="leading-none">
                <span className="block text-[10px] text-slate-300">
                  {submitUnlocked ? 'Token Kirim Form' : 'Kunci Kirim Terbuka Dalam'}
                </span>
                {submitUnlocked && examData.submitToken ? (
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span className="font-mono text-sm font-bold tracking-wider text-emerald-300">
                      {examData.submitToken}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopySubmitToken}
                      title="Salin Token Kirim"
                      className="rounded p-0.5 text-emerald-300 hover:bg-emerald-900"
                    >
                      {copiedToken ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                ) : (
                  <span className="mt-0.5 block font-mono text-sm font-semibold text-amber-300 tabular-nums">
                    {formatDuration(remainingLockSec)}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Violation Strike Indicator */}
          <div
            className={`hidden md:flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium ${
              activeViolations > 0
                ? 'border-red-500/40 bg-red-950/50 text-red-200'
                : 'border-slate-700 bg-slate-800 text-slate-300'
            }`}
          >
            <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
            <span className="font-mono tabular-nums">
              Pelanggaran {activeViolations}/{maxViolations}
            </span>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          {!isFullscreen && (
            <button
              type="button"
              onClick={handleReturnFullscreen}
              className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/50 bg-sky-600/20 px-3 py-1.5 text-xs font-medium text-sky-200 hover:bg-sky-600/30 whitespace-nowrap"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              Layar Penuh
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowProctorModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 whitespace-nowrap"
          >
            <KeyRound className="h-3.5 w-3.5" />
            Pengawas
          </button>

          <button
            type="button"
            onClick={() => {
              if (submitUnlocked) {
                setFinishError(null);
                setLockNotice(null);
                setShowFinishConfirm(true);
              } else {
                setLockNotice(
                  `Tombol Kirim & Selesai terbuka dalam ${formatDuration(remainingLockSec)}. Selesaikan jawaban dulu atau minta Guru tekan "Buka Tombol Kirim" di Panel Guru.`
                );
              }
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              submitUnlocked
                ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                : 'border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {submitUnlocked ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Kirim &amp; Selesai
              </>
            ) : (
              <>
                <Lock className="h-3.5 w-3.5" />
                Tunggu {formatDuration(remainingLockSec)}
              </>
            )}
          </button>
        </div>
      </header>

      {/* Lock Notice Banner if clicked early */}
      {!submitUnlocked && lockNotice && (
        <div className="flex items-center justify-between gap-4 border-b border-amber-200 bg-amber-50 px-6 py-2 text-xs font-medium text-amber-950">
          <span>{lockNotice}</span>
          <button
            type="button"
            onClick={() => setLockNotice(null)}
            className="shrink-0 font-semibold underline"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Unlocked Notification Strip */}
      {submitUnlocked && (
        <div className="flex items-center justify-between gap-4 border-b border-emerald-200 bg-emerald-50 px-6 py-2 text-xs font-medium text-emerald-950">
          <span>
            Waktu tunggu {examData.exam.lockSubmitMinutes} menit telah selesai.{' '}
            {examData.exam.enableSubmitToken && examData.submitToken
              ? `Masukkan Token Kirim "${examData.submitToken}" ke dalam Google Form lalu klik Kirim, kemudian tekan tombol "Kirim & Selesai" di pojok kanan atas.`
              : 'Silakan klik tombol Kirim pada Google Form di bawah ini, lalu tekan "Kirim & Selesai" di pojok kanan atas.'}
          </span>
        </div>
      )}

      {/* Main Embedded Google Form Stage */}
      <div className="relative flex-1 min-h-0 overflow-hidden bg-white">
        {resolvedFormUrl ? (
          <iframe
            title="Lembar Soal Google Form"
            src={resolvedFormUrl}
            className="absolute inset-0 h-full w-full border-0 bg-white"
            allow="fullscreen"
            referrerPolicy="no-referrer-when-downgrade"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-8 text-center">
            <div className="max-w-md">
              <AlertTriangle className="mx-auto h-10 w-10 text-amber-600" />
              <h2 className="mt-3 text-lg font-bold text-slate-900">
                Link Google Form Tidak Tersedia
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Guru belum menempelkan link Google Form pada pengaturan ujian ini.
              </p>
            </div>
          </div>
        )}

        {/* Optional Bottom Submit Guard Overlay during lock countdown */}
        {examData.exam.enableBottomOverlayGuard && !submitUnlocked && (
          <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-between gap-4 border-t border-amber-300 bg-amber-50/95 px-6 py-4 backdrop-blur-xs">
            <div className="flex items-center gap-3">
              <Lock className="h-5 w-5 shrink-0 text-amber-700" />
              <div>
                <p className="text-sm font-semibold text-amber-950">
                  Area Tombol Kirim Terkunci Selama Pengerjaan
                </p>
                <p className="text-xs text-amber-800">
                  Periksa kembali jawabanmu dengan teliti. Area bawah otomatis terbuka saat waktu
                  selesai.
                </p>
              </div>
            </div>
            <span className="font-mono text-sm font-bold text-amber-900 tabular-nums whitespace-nowrap">
              Terbuka dalam {formatDuration(remainingLockSec)}
            </span>
          </div>
        )}
      </div>

      {/* Focus / Fullscreen Warning or Hard Lock Overlay */}
      {(isHardLocked || focusWarning) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 p-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-7 text-white shadow-xl">
            <div className="flex items-center gap-3 text-red-400">
              <ShieldAlert className="h-7 w-7 shrink-0" />
              <h2 className="text-xl font-bold text-white">
                {isHardLocked ? 'Ujian Terkunci Pengawas' : 'Peringatan Fokus Layar'}
              </h2>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              {isHardLocked
                ? `Kamu tercatat keluar dari fokus layar sebanyak ${activeViolations} kali. Akun ujianmu otomatis terkunci dan langsung masuk ke daftar pengawasan Guru. Silakan lapor kepada Guru agar dibuka melalui Panel Guru.`
                : `Terdeteksi: ${focusWarning}. Selama ulangan, Chromebook tidak boleh keluar dari layar penuh atau membuka halaman lain.`}
            </p>

            <div className="mt-5 rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-xs text-slate-300">
              Pelanggaran aktif:{' '}
              <span className="font-mono font-semibold text-red-400 tabular-nums">
                {activeViolations} dari {maxViolations} batas maksimal
              </span>
            </div>

            {isHardLocked ? (
              <div className="mt-6 space-y-3">
                <div className="rounded-lg border border-amber-500/30 bg-amber-950/40 px-4 py-3 text-xs leading-relaxed text-amber-200">
                  Menunggu Guru Pengawas menekan tombol <strong>Buka Kunci Siswa</strong> di
                  Panel Guru. Layar ini akan terbuka otomatis setelah diizinkan oleh Guru.
                </div>
                <button
                  type="button"
                  onClick={syncWithServer}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
                >
                  Periksa Status Pembukaan Kunci
                </button>
              </div>
            ) : (
              <div className="mt-6 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={handleReturnFullscreen}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-500"
                >
                  <Maximize2 className="h-4 w-4" />
                  Kembali ke Layar Penuh &amp; Lanjutkan
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Finish Confirmation Modal */}
      {showFinishConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-6">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 text-slate-900 shadow-xl">
            <h2 className="text-lg font-bold">Konfirmasi Selesai Ujian</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Pastikan kamu sudah menekan tombol <strong className="text-slate-900">Kirim</strong>{' '}
              di dalam halaman Google Form hingga muncul pesan jawaban telah direkam.
            </p>
            {finishError && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                {finishError}
              </p>
            )}
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowFinishConfirm(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Periksa Lagi
              </button>
              <button
                type="button"
                disabled={finishBusy}
                onClick={() => handleFinishExam()}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {finishBusy ? 'Menyimpan...' : 'Ya, Sudah Kirim & Selesai'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Proctor Override Modal (Emergency Early Finish or Unlock) */}
      {showProctorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-6">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 text-slate-900 shadow-xl">
            <h2 className="text-lg font-bold">Akses Guru Pengawas</h2>
            <p className="mt-1 text-sm text-slate-600">
              Khusus Guru Pengawas untuk mengakhiri sesi siswa lebih awal jika ada kendala teknis.
            </p>
            <div className="mt-4">
              <label
                htmlFor="overridePin"
                className="block text-xs font-medium text-slate-700"
              >
                PIN Pengawas
              </label>
              <input
                id="overridePin"
                type="password"
                inputMode="numeric"
                value={proctorPinInput}
                onChange={(e) => setProctorPinInput(e.target.value)}
                placeholder="Masukkan PIN Pengawas"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 font-mono text-sm focus:border-sky-600 focus:outline-none"
              />
            </div>
            {(proctorError || finishError) && (
              <p className="mt-2 text-xs font-medium text-red-600">
                {proctorError || finishError}
              </p>
            )}
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowProctorModal(false);
                  setProctorError(null);
                  setFinishError(null);
                  setProctorPinInput('');
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={finishBusy || !proctorPinInput.trim()}
                onClick={() => handleFinishExam(proctorPinInput.trim())}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                Akhiri Sesi Sekarang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
