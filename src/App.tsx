import { useEffect, useState, useCallback, useRef } from 'react';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { auth, db, onAuthStateChanged } from './firebase.ts';
import { getPortalConfigDocId, PRIMARY_TEACHER_EMAIL } from './services/firebaseSync.ts';
import { TopBar } from './components/TopBar.tsx';
import { StudentGate } from './components/StudentGate.tsx';
import { ExamKioskRoom } from './components/ExamKioskRoom.tsx';
import { ExamFinished } from './components/ExamFinished.tsx';
import { MonitorTab } from './components/MonitorTab.tsx';
import { ChromebookGuideTab } from './components/ChromebookGuideTab.tsx';
import { ProctorPanel } from './components/ProctorPanel.tsx';
import type { ActiveExamPayload, ExamItem, PortalPublicPayload, PortalSettings, PortalTab } from './types.ts';

const SESSION_STORAGE_KEY = 'cbt_5d_session_id';
const SESSION_TOKEN_STORAGE_KEY = 'cbt_5d_session_token';

export default function App() {
  const [activeTab, setActiveTab] = useState<PortalTab>('gate');
  const [portalData, setPortalData] = useState<PortalPublicPayload | null>(null);
  const [loadingPortal, setLoadingPortal] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [activeExam, setActiveExam] = useState<ActiveExamPayload | null>(null);
  const [finishedExam, setFinishedExam] = useState<ActiveExamPayload | null>(null);
  const [proctorOpen, setProctorOpen] = useState(false);
  const autoHydratedUidRef = useRef<string | null>(null);
  const cachedFirestoreSnapshotRef = useRef<{
    settings?: Partial<PortalSettings>;
    exams?: Partial<ExamItem>[];
  }>({});
  const rehydratingColdRef = useRef(false);

  const hydrateServerFromCachedFirestore = useCallback(async (): Promise<PortalPublicPayload | null> => {
    const snap = cachedFirestoreSnapshotRef.current;
    const user = auth.currentUser;
    if (!user || !user.emailVerified) return null;
    if (!snap.settings && (!snap.exams || snap.exams.length === 0)) return null;
    if (rehydratingColdRef.current) return null;

    rehydratingColdRef.current = true;
    try {
      const idToken = await user.getIdToken().catch(() => '');
      if (!idToken) return null;
      const res = await fetch('/api/exams/hydrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken,
          settings: snap.settings,
          exams: snap.exams,
        }),
      });
      if (!res.ok) return null;
      const hydrated = (await res.json()) as { publicPayload?: PortalPublicPayload };
      return hydrated.publicPayload || null;
    } catch {
      return null;
    } finally {
      rehydratingColdRef.current = false;
    }
  }, []);

  const fetchPortalData = useCallback(async () => {
    try {
      const res = await fetch('/api/exam/public');
      if (!res.ok) {
        throw new Error('Gagal memuat daftar jadwal ulangan.');
      }
      const data = (await res.json()) as PortalPublicPayload;
      if (
        data.exams.length === 0 &&
        (cachedFirestoreSnapshotRef.current.exams?.length || 0) > 0 &&
        auth.currentUser?.emailVerified
      ) {
        const rehydratedPublic = await hydrateServerFromCachedFirestore();
        if (rehydratedPublic) {
          setPortalData(rehydratedPublic);
          setLoadError(null);
          return;
        }
      }
      setPortalData(data);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Koneksi ke server terputus.');
    } finally {
      setLoadingPortal(false);
    }
  }, [hydrateServerFromCachedFirestore]);

  useEffect(() => {
    fetchPortalData();
    const timer = window.setInterval(fetchPortalData, 15000);
    return () => window.clearInterval(timer);
  }, [fetchPortalData]);

  // Auto-restore Firestore schedule on server restart for any verified teacher Google account
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user || !user.emailVerified) return;
      if (autoHydratedUidRef.current === user.uid) return;
      autoHydratedUidRef.current = user.uid;

      try {
        const isPrimary =
          user.email?.trim().toLowerCase() === PRIMARY_TEACHER_EMAIL;
        const configId = getPortalConfigDocId(user.uid, user.email);
        const examsQuery = isPrimary
          ? collection(db, 'exams')
          : query(collection(db, 'exams'), where('ownerUid', '==', user.uid));

        const [cfgSnap, examsSnap, idToken] = await Promise.all([
          getDoc(doc(db, 'portalConfig', configId)),
          getDocs(examsQuery),
          user.getIdToken(),
        ]);

        const settings: Partial<PortalSettings> | undefined = cfgSnap.exists()
          ? {
              className: String(cfgSnap.data().className || 'Kelas 5D'),
              defaultTeacherName: String(cfgSnap.data().defaultTeacherName || 'Guru Kelas 5D'),
              proctorPin: String(cfgSnap.data().proctorPin || '5555'),
            }
          : undefined;

        const exams: Partial<ExamItem>[] = examsSnap.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            examTitle: String(d.examTitle || ''),
            subject: String(d.subject || ''),
            teacherName: String(d.teacherName || 'Guru Kelas 5D'),
            googleFormUrl: String(d.googleFormUrl || ''),
            googleFormId: String(d.googleFormId || ''),
            entryToken: String(d.entryToken || ''),
            submitToken: String(d.submitToken || 'KIRIM5D'),
            durationMinutes: Number(d.durationMinutes) || 60,
            lockSubmitMinutes: Number(d.lockSubmitMinutes ?? 60),
            enableSubmitToken: Boolean(d.enableSubmitToken ?? true),
            enableBottomOverlayGuard: Boolean(d.enableBottomOverlayGuard ?? false),
            maxViolationsBeforeLock: Number(d.maxViolationsBeforeLock) || 3,
            availabilityMode: d.availabilityMode || 'scheduled',
            scheduledStart: String(d.scheduledStart || ''),
            scheduledEnd: String(d.scheduledEnd || ''),
            maxRawScore: Number(d.maxRawScore) || 40,
            questionCount: Number(d.questionCount) || 40,
            kkm: Number(d.kkm) || 75,
            webhookSecret: String(d.webhookSecret || ''),
            answerKey: Array.isArray(d.answerKey) ? d.answerKey.map(String) : [],
            updatedAt:
              d.updatedAt && typeof d.updatedAt.toDate === 'function'
                ? d.updatedAt.toDate().toISOString()
                : new Date().toISOString(),
          };
        });

        cachedFirestoreSnapshotRef.current = { settings, exams };

        if (settings || exams.length > 0) {
          const res = await fetch('/api/exams/hydrate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken, settings, exams }),
          });
          if (res.ok) {
            const hydrated = (await res.json().catch(() => null)) as {
              publicPayload?: PortalPublicPayload;
            } | null;
            if (hydrated?.publicPayload) {
              setPortalData(hydrated.publicPayload);
              setLoadError(null);
              setLoadingPortal(false);
            } else {
              void fetchPortalData();
            }
          }
        }
      } catch {
        // Non-blocking background restore
      }
    });
    return () => unsub();
  }, [fetchPortalData]);

  useEffect(() => {
    const savedSessionId = sessionStorage.getItem(SESSION_STORAGE_KEY);
    const savedSessionToken = sessionStorage.getItem(SESSION_TOKEN_STORAGE_KEY);
    if (savedSessionId) {
      fetch(`/api/sessions/${savedSessionId}`, {
        headers: savedSessionToken ? { 'x-session-token': savedSessionToken } : undefined,
      })
        .then(async (res) => {
          if (!res.ok) {
            sessionStorage.removeItem(SESSION_STORAGE_KEY);
            sessionStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
            return;
          }
          const payload = (await res.json()) as ActiveExamPayload;
          if (payload.sessionToken) {
            sessionStorage.setItem(SESSION_TOKEN_STORAGE_KEY, payload.sessionToken);
          }
          if (payload.session.status === 'finished') {
            sessionStorage.removeItem(SESSION_STORAGE_KEY);
            sessionStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
            setFinishedExam(payload);
          } else {
            setActiveExam(payload);
          }
        })
        .catch(() => {});
    }
  }, []);

  const handleAttemptStart = async (
    examId: string,
    studentName: string,
    absenNumber: string,
    token: string
  ) => {
    let res = await fetch('/api/sessions/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ examId, studentName, absenNumber, token }),
    });
    if (
      res.status === 404 &&
      (cachedFirestoreSnapshotRef.current.exams?.length || 0) > 0 &&
      auth.currentUser?.emailVerified
    ) {
      await hydrateServerFromCachedFirestore();
      res = await fetch('/api/sessions/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examId, studentName, absenNumber, token }),
      });
    }
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Token tidak valid atau sesi gagal dimulai.');
    }
    const payload = data as ActiveExamPayload;
    sessionStorage.setItem(SESSION_STORAGE_KEY, payload.session.id);
    if (payload.sessionToken) {
      sessionStorage.setItem(SESSION_TOKEN_STORAGE_KEY, payload.sessionToken);
    }
    setFinishedExam(null);
    setActiveExam(payload);
  };

  const handleExamFinished = (payload: ActiveExamPayload) => {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    sessionStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
    setActiveExam(null);
    setFinishedExam(payload);
  };

  const handleReturnToGate = () => {
    setFinishedExam(null);
    setActiveTab('gate');
    fetchPortalData();
  };

  if (activeExam) {
    return <ExamKioskRoom initialData={activeExam} onFinished={handleExamFinished} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <TopBar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setFinishedExam(null);
          setActiveTab(tab);
        }}
        onOpenProctor={() => setProctorOpen(true)}
      />

      <div className="flex-1">
        {loadingPortal ? (
          <div className="mx-auto max-w-6xl px-6 py-20 text-center text-sm text-slate-500">
            Menyiapkan Portal Ulangan Kelas 5D...
          </div>
        ) : loadError || !portalData ? (
          <div className="mx-auto max-w-md px-6 py-20 text-center">
            <p className="text-sm font-semibold text-red-700">
              {loadError || 'Konfigurasi tidak tersedia.'}
            </p>
            <button
              type="button"
              onClick={fetchPortalData}
              className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
            >
              Coba Lagi
            </button>
          </div>
        ) : finishedExam ? (
          <ExamFinished
            session={finishedExam.session}
            exam={finishedExam.exam}
            onReturnToGate={handleReturnToGate}
          />
        ) : activeTab === 'gate' ? (
          <StudentGate
            portal={portalData}
            onAttemptStart={handleAttemptStart}
            onOpenProctor={() => setProctorOpen(true)}
          />
        ) : activeTab === 'monitor' ? (
          <MonitorTab onOpenProctor={() => setProctorOpen(true)} />
        ) : (
          <ChromebookGuideTab />
        )}
      </div>

      <footer className="border-t border-slate-200 bg-white px-6 py-4 text-center text-xs text-slate-500">
        Portal Ulangan Kelas 5D · Mode Fokus Chromebook &amp; Google Form Terjadwal
      </footer>

      <ProctorPanel
        isOpen={proctorOpen}
        onClose={() => setProctorOpen(false)}
        onConfigUpdated={fetchPortalData}
      />
    </div>
  );
}
