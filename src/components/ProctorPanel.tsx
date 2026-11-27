import { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  Lock,
  Save,
  ExternalLink,
  Copy,
  Check,
  Unlock,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Timer,
  Plus,
  Pencil,
  CalendarClock,
  ArrowLeft,
  Cloud,
  LogOut,
  FolderOpen,
} from 'lucide-react';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import type {
  ExamAvailabilityMode,
  ExamItem,
  ExamStudentResult,
  PortalSettings,
  StudentSession,
} from '../types.ts';
import { normalizeGoogleFormUrl } from '../utils/formUrl.ts';
import { ProctorAnalysisTab } from './ProctorAnalysisTab.tsx';
import {
  auth,
  clearWorkspaceAccessToken,
  db,
  getWorkspaceAccessToken,
  handleFirestoreError,
  onAuthStateChanged,
  OperationType,
  signInTeacherWithGoogle,
  signOutTeacher,
} from '../firebase.ts';
import {
  deleteExamFromFirestore,
  getPortalConfigDocId,
  PRIMARY_TEACHER_EMAIL,
  saveExamToFirestore,
  savePortalConfigToFirestore,
  upsertExamResultToFirestore,
  upsertSessionToFirestore,
} from '../services/firebaseSync.ts';
import {
  fetchAndGradeGoogleFormResponses,
  fetchGoogleFormBody,
  GoogleFormApiError,
  listTeacherFormsFromDrive,
  type DriveFormFile,
} from '../services/googleFormsApi.ts';

interface ProctorPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigUpdated: () => void;
}

function toLocalDateTimeInput(isoString: string): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalDateTimeInput(localVal: string): string {
  if (!localVal) return '';
  const d = new Date(localVal);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString();
}

function createBlankExamDraft(defaultTeacherName: string): ExamItem {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const end = new Date(start.getTime() + 90 * 60 * 1000);

  return {
    id: '',
    examTitle: '',
    subject: '',
    teacherName: defaultTeacherName,
    googleFormUrl: '',
    entryToken: '',
    submitToken: 'KIRIM5D',
    durationMinutes: 60,
    lockSubmitMinutes: 60,
    enableSubmitToken: true,
    enableBottomOverlayGuard: false,
    maxViolationsBeforeLock: 3,
    availabilityMode: 'scheduled',
    scheduledStart: start.toISOString(),
    scheduledEnd: end.toISOString(),
    maxRawScore: 40,
    questionCount: 40,
    kkm: 75,
    webhookSecret: '',
    answerKey: [],
    updatedAt: '',
  };
}

function formatExamScheduleLabel(exam: ExamItem): string {
  if (exam.availabilityMode === 'manual_open') return 'Dibuka Manual';
  if (exam.availabilityMode === 'closed') return 'Ditutup';
  if (!exam.scheduledStart || !exam.scheduledEnd) return 'Jadwal belum diisi';
  const s = new Date(exam.scheduledStart);
  const e = new Date(exam.scheduledEnd);
  const dStr = s.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const sTime = s.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const eTime = e.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  return `${dStr} · ${sTime} — ${eTime}`;
}

function formatFirebaseNoticeError(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;
  try {
    const parsed = JSON.parse(err.message) as { error?: string; path?: string };
    if (parsed && parsed.error) {
      if (parsed.error.includes('Missing or insufficient permissions')) {
        return 'Sebagian data milik akun guru lain di server tidak dapat ditimpa dari akun ini. Buat atau duplikasi jadwal ulangan baru dari akun Google Anda untuk menyimpannya di Firebase.';
      }
      return parsed.error;
    }
  } catch {
    // Plain error string
  }
  return err.message || fallback;
}

export function ProctorPanel({ isOpen, onClose, onConfigUpdated }: ProctorPanelProps) {
  const [pin, setPin] = useState('');
  const [authenticatedPin, setAuthenticatedPin] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [panelTab, setPanelTab] = useState<'exams' | 'analysis' | 'sessions' | 'portal'>('exams');
  const [portalSettings, setPortalSettings] = useState<PortalSettings | null>(null);
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [sessions, setSessions] = useState<StudentSession[]>([]);
  const [results, setResults] = useState<ExamStudentResult[]>([]);

  // Exam editor sub-view (null = list view, object = adding/editing)
  const [editingExam, setEditingExam] = useState<ExamItem | null>(null);
  const [startLocalInput, setStartLocalInput] = useState('');
  const [endLocalInput, setEndLocalInput] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'warn' | 'err'; text: string } | null>(
    null
  );
  const [copiedLink, setCopiedLink] = useState(false);

  // Firebase Auth & Firestore sync state
  const [firebaseUser, setFirebaseUser] = useState<User | null>(auth.currentUser);
  const [authReady, setAuthReady] = useState(false);
  const [firebaseAuthBusy, setFirebaseAuthBusy] = useState(false);
  const [firebaseNotice, setFirebaseNotice] = useState<string | null>(null);
  const [workspaceToken, setWorkspaceToken] = useState<string | null>(() =>
    getWorkspaceAccessToken()
  );

  // Google Drive Form picker state
  const [driveForms, setDriveForms] = useState<DriveFormFile[]>([]);
  const [loadingDriveForms, setLoadingDriveForms] = useState(false);
  const [showDrivePicker, setShowDrivePicker] = useState(false);

  const syncedExamSigsRef = useRef<Record<string, string>>({});
  const syncedResultSigsRef = useRef<Record<string, string>>({});
  const syncedSessionSigsRef = useRef<Record<string, string>>({});
  const syncedConfigSigRef = useRef<string>('');
  const knownFirestoreExamIdsRef = useRef<Set<string>>(new Set());
  const autoUnlockTriedUidRef = useRef<string | null>(null);
  const bgFormSyncRunningRef = useRef(false);
  const authenticatedPinRef = useRef<string | null>(authenticatedPin);
  authenticatedPinRef.current = authenticatedPin;
  const [offerBasicGoogleFallback, setOfferBasicGoogleFallback] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
      if (!user) {
        setWorkspaceToken(null);
      } else {
        setWorkspaceToken(getWorkspaceAccessToken());
      }
    });
    return () => unsub();
  }, []);

  const verifiedUid =
    authReady && firebaseUser && firebaseUser.emailVerified ? firebaseUser.uid : null;
  const teacherEmail = firebaseUser?.email ?? null;
  const isPrimaryTeacher =
    Boolean(verifiedUid) &&
    teacherEmail?.trim().toLowerCase() === PRIMARY_TEACHER_EMAIL;
  const portalConfigDocId = verifiedUid
    ? getPortalConfigDocId(verifiedUid, teacherEmail)
    : null;

  const reportSnapshotError = useCallback(
    (error: unknown, operationType: OperationType, path: string | null) => {
      try {
        handleFirestoreError(error, operationType, path);
      } catch (wrapped) {
        setFirebaseNotice(
          formatFirebaseNoticeError(wrapped, 'Gagal menyinkronkan data dengan Firebase Firestore.')
        );
      }
    },
    []
  );

  const pushServerUpdatesToFirestore = useCallback(
    async (
      uid: string,
      email: string | null,
      isPrimary: boolean,
      serverSettings: PortalSettings,
      serverExams: ExamItem[],
      serverResults: ExamStudentResult[],
      serverSessions: StudentSession[]
    ) => {
      try {
        // Only seed portalConfig doc if Firestore does not already have one for this teacher
        const cfgDocId = getPortalConfigDocId(uid, email);
        if (syncedConfigSigRef.current === '') {
          const existingCfg = await getDoc(doc(db, 'portalConfig', cfgDocId));
          if (!existingCfg.exists()) {
            syncedConfigSigRef.current = JSON.stringify(serverSettings);
            await savePortalConfigToFirestore(uid, serverSettings, email);
          } else {
            syncedConfigSigRef.current = 'exists';
          }
        }

        for (const ex of serverExams) {
          const sig = `${ex.updatedAt}::${ex.availabilityMode}::${ex.examTitle}`;
          if (!knownFirestoreExamIdsRef.current.has(ex.id) && syncedExamSigsRef.current[ex.id] !== sig) {
            syncedExamSigsRef.current[ex.id] = sig;
            const saved = await saveExamToFirestore(uid, ex, isPrimary, {
              skipIfForeignOwned: true,
            });
            if (saved) {
              knownFirestoreExamIdsRef.current.add(ex.id);
            }
          }
        }

        for (const r of serverResults) {
          if (!knownFirestoreExamIdsRef.current.has(r.examId)) continue;
          const sig = `${r.source}::${r.rawScore}::${r.finalScore}::${r.submittedAt}::${r.itemScores.length}`;
          if (syncedResultSigsRef.current[r.id] !== sig) {
            syncedResultSigsRef.current[r.id] = sig;
            await upsertExamResultToFirestore(uid, r, isPrimary, {
              skipIfForeignOwned: true,
            });
          }
        }

        for (const s of serverSessions) {
          if (!knownFirestoreExamIdsRef.current.has(s.examId)) continue;
          const sig = `${s.status}::${s.violations.length}::${s.finishedAt || 0}::${s.unlockAt}`;
          if (syncedSessionSigsRef.current[s.id] !== sig) {
            syncedSessionSigsRef.current[s.id] = sig;
            await upsertSessionToFirestore(uid, s, isPrimary, {
              skipIfForeignOwned: true,
            });
          }
        }
      } catch (err) {
        setFirebaseNotice(
          formatFirebaseNoticeError(err, 'Gagal menyinkronkan data ke Firebase.')
        );
      }
    },
    []
  );

  const fetchProctorData = useCallback(
    async (activePin: string, options?: { syncAll?: boolean }) => {
      const idToken = await auth.currentUser?.getIdToken().catch(() => '');
      const res = await fetch('/api/exam/verify-proctor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: activePin, idToken: idToken || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'PIN Pengawas tidak valid.');
      }
      const serverExams = (data.exams || []) as ExamItem[];
      const serverResults = (data.results || []) as ExamStudentResult[];

      if (options?.syncAll) {
        setPortalSettings((prev) => prev || (data.settings as PortalSettings));
        setExams((prev) => {
          if (prev.length === 0) return serverExams;
          const byId = new Map(prev.map((e) => [e.id, e]));
          for (const sx of serverExams) {
            const existing = byId.get(sx.id);
            if (!existing || Date.parse(sx.updatedAt || '') > Date.parse(existing.updatedAt || '')) {
              byId.set(sx.id, sx);
            }
          }
          return Array.from(byId.values());
        });
      }
      setSessions(data.sessions || []);
      setResults((prev) => {
        if (prev.length === 0) return serverResults;
        const map = new Map(prev.map((r) => [r.id, r]));
        for (const sr of serverResults) {
          const cur = map.get(sr.id);
          if (!cur || cur.source === 'kiosk' || sr.source !== 'kiosk') {
            map.set(sr.id, sr);
          }
        }
        return Array.from(map.values());
      });

      if (verifiedUid) {
        void pushServerUpdatesToFirestore(
          verifiedUid,
          teacherEmail,
          isPrimaryTeacher,
          data.settings as PortalSettings,
          serverExams,
          serverResults,
          (data.sessions || []) as StudentSession[]
        );
      }
    },
    [verifiedUid, teacherEmail, isPrimaryTeacher, pushServerUpdatesToFirestore]
  );

  const unlockPanelWithGoogleUser = useCallback(async (user: User): Promise<{ ok: boolean; error?: string }> => {
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/exam/verify-proctor-google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const data = await res.json();
      if (!res.ok || !data.proctorPin) {
        return { ok: false, error: data.error };
      }
      setPortalSettings((prev) => prev || (data.settings as PortalSettings));
      setExams((prev) => {
        const serverExams = (data.exams || []) as ExamItem[];
        if (prev.length === 0) return serverExams;
        const byId = new Map(prev.map((e) => [e.id, e]));
        for (const sx of serverExams) {
          if (!byId.has(sx.id)) byId.set(sx.id, sx);
        }
        return Array.from(byId.values());
      });
      setSessions(data.sessions || []);
      setResults((prev) => (prev.length === 0 ? (data.results || []) : prev));
      setAuthenticatedPin(String(data.proctorPin));
      setAuthError(null);
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }, []);

  // Automatically open Panel Guru if teacher Google account is already signed in
  useEffect(() => {
    if (!isOpen) {
      autoUnlockTriedUidRef.current = null;
      return;
    }
    if (authenticatedPin || !authReady || !firebaseUser || !firebaseUser.emailVerified) return;
    if (autoUnlockTriedUidRef.current === firebaseUser.uid) return;
    autoUnlockTriedUidRef.current = firebaseUser.uid;
    void unlockPanelWithGoogleUser(firebaseUser);
  }, [isOpen, authenticatedPin, authReady, firebaseUser, unlockPanelWithGoogleUser]);

  const syncExamWithGoogleForm = useCallback(
    async (
      exam: ExamItem,
      token: string,
      activePin: string,
      activeUid: string | null,
      isPrimary: boolean,
      activeSessions: StudentSession[]
    ) => {
      if (!exam.googleFormUrl && !exam.googleFormId) return;
      const graded = await fetchAndGradeGoogleFormResponses({
        accessToken: token,
        googleFormUrl: exam.googleFormUrl,
        knownFormId: exam.googleFormId,
        questionCountLimit: exam.questionCount || 40,
        sessions: activeSessions,
        fallbackAnswerKey: exam.answerKey,
      });

      const idToken = await auth.currentUser?.getIdToken().catch(() => '');
      const res = await fetch(`/api/exams/${exam.id}/results/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPin: activePin,
          idToken: idToken || undefined,
          examSnapshot: exam,
          rows: graded.rows,
          answerKey: graded.answerKey,
          googleFormId: graded.formId,
          source: 'google_forms',
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      const nextList = (data.results || []) as ExamStudentResult[];
      const updatedExamFromServer = (data.exams as ExamItem[] | undefined)?.find(
        (ex) => ex.id === exam.id
      );
      const nextExam: ExamItem = updatedExamFromServer || {
        ...exam,
        googleFormId: graded.formId,
        answerKey: graded.answerKey,
      };

      if (activeUid) {
        const saved = await saveExamToFirestore(activeUid, nextExam, isPrimary, {
          skipIfForeignOwned: true,
        });
        if (saved) {
          await Promise.all(
            nextList.map((item) =>
              upsertExamResultToFirestore(activeUid, item, isPrimary, {
                skipIfForeignOwned: true,
              })
            )
          );
        }
      }

      setExams((prev) => prev.map((e) => (e.id === nextExam.id ? nextExam : e)));
      setResults((prev) => [...prev.filter((r) => r.examId !== exam.id), ...nextList]);
    },
    []
  );

  // Only poll sessions & new student submissions from server in background; NEVER overwrite forms while typing!
  useEffect(() => {
    if (!isOpen || !authenticatedPin) return;
    const poll = window.setInterval(() => {
      fetchProctorData(authenticatedPin, { syncAll: false }).catch(() => {});
    }, 4000);
    return () => window.clearInterval(poll);
  }, [isOpen, authenticatedPin, fetchProctorData]);

  const examsRef = useRef<ExamItem[]>(exams);
  examsRef.current = exams;
  const sessionsRef = useRef<StudentSession[]>(sessions);
  sessionsRef.current = sessions;

  // Automatic background Google Forms sync whenever workspaceToken is active
  const kioskResultTotal = results.filter((r) => r.source === 'kiosk').length;
  useEffect(() => {
    if (!isOpen || !authenticatedPin || !workspaceToken) return;

    const runAutoSync = async () => {
      if (bgFormSyncRunningRef.current) return;
      const targetExams = examsRef.current.filter((ex) =>
        Boolean(ex.googleFormUrl || ex.googleFormId)
      );
      if (targetExams.length === 0) return;
      bgFormSyncRunningRef.current = true;
      try {
        for (const ex of targetExams) {
          try {
            await syncExamWithGoogleForm(
              ex,
              workspaceToken,
              authenticatedPin,
              verifiedUid,
              isPrimaryTeacher,
              sessionsRef.current
            );
          } catch (err) {
            if (err instanceof GoogleFormApiError && err.isAuthError) {
              clearWorkspaceAccessToken();
              setWorkspaceToken(null);
              setFirebaseNotice(err.message);
              break;
            }
          }
        }
      } finally {
        bgFormSyncRunningRef.current = false;
      }
    };

    void runAutoSync();
    const timer = window.setInterval(() => {
      void runAutoSync();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [isOpen, authenticatedPin, workspaceToken, verifiedUid, isPrimaryTeacher, kioskResultTotal, syncExamWithGoogleForm]);

  // Real-time Firestore listeners (only attached when Firebase Auth is ready & verified)
  useEffect(() => {
    if (!isOpen || !authenticatedPin || !verifiedUid) return;

    const hydrateServer = async (payload: {
      settings?: PortalSettings;
      exams?: ExamItem[];
      results?: ExamStudentResult[];
    }) => {
      try {
        const idToken = await auth.currentUser?.getIdToken().catch(() => '');
        const res = await fetch('/api/exams/hydrate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            currentPin: authenticatedPinRef.current || authenticatedPin,
            idToken: idToken || undefined,
            ...payload,
          }),
        });
        if (res.ok) {
          onConfigUpdated();
        }
      } catch {
        // Ignore transient hydration error
      }
    };

    // 1. Portal config listener (per teacher UID, or 'default' for primary teacher)
    const cfgId = portalConfigDocId || 'default';
    const configPath = `portalConfig/${cfgId}`;
    const unsubConfig = onSnapshot(
      doc(db, 'portalConfig', cfgId),
      (snap) => {
        if (!snap.exists()) return;
        const d = snap.data();
        const remoteSettings: PortalSettings = {
          className: String(d.className || 'Kelas 5D'),
          defaultTeacherName: String(d.defaultTeacherName || 'Guru Kelas 5D'),
          proctorPin: String(d.proctorPin || authenticatedPin),
        };
        syncedConfigSigRef.current = JSON.stringify(remoteSettings);
        setPortalSettings(remoteSettings);
        void hydrateServer({ settings: remoteSettings }).then(() => {
          if (remoteSettings.proctorPin && remoteSettings.proctorPin !== authenticatedPinRef.current) {
            setAuthenticatedPin(remoteSettings.proctorPin);
          }
        });
      },
      (error) => {
        reportSnapshotError(error, OperationType.GET, configPath);
      }
    );

    // 2. Exams collection listener (all exams for primary teacher, owner-scoped otherwise)
    const examsPath = 'exams';
    const examsQuery = isPrimaryTeacher
      ? collection(db, 'exams')
      : query(collection(db, 'exams'), where('ownerUid', '==', verifiedUid));
    const unsubExams = onSnapshot(
      examsQuery,
      (snap) => {
        const remoteExams: ExamItem[] = snap.docs.map((docSnap) => {
          const d = docSnap.data();
          const ex: ExamItem = {
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
          knownFirestoreExamIdsRef.current.add(ex.id);
          syncedExamSigsRef.current[ex.id] = `${ex.updatedAt}::${ex.availabilityMode}::${ex.examTitle}`;
          return ex;
        });

        if (remoteExams.length > 0) {
          setExams((prev) => {
            const byId = new Map(prev.map((e) => [e.id, e]));
            for (const rx of remoteExams) {
              byId.set(rx.id, rx);
            }
            return Array.from(byId.values());
          });
          void hydrateServer({ exams: remoteExams });
        }
      },
      (error) => {
        reportSnapshotError(error, OperationType.LIST, examsPath);
      }
    );

    // Initial push of any existing local server state to Firestore on connect
    void fetchProctorData(authenticatedPin, { syncAll: true });

    return () => {
      unsubConfig();
      unsubExams();
    };
  }, [
    isOpen,
    authenticatedPin,
    verifiedUid,
    portalConfigDocId,
    isPrimaryTeacher,
    fetchProctorData,
    onConfigUpdated,
    reportSnapshotError,
  ]);

  // Real-time Firestore listeners for results subcollection across known exams
  const examIdKey = exams.map((e) => e.id).sort().join('|');
  useEffect(() => {
    if (!isOpen || !authenticatedPin || !verifiedUid || !examIdKey) return;
    const examIds = examIdKey.split('|').filter(Boolean);
    const unsubs = examIds.map((exId) => {
      const resultsPath = `exams/${exId}/results`;
      const q = isPrimaryTeacher
        ? collection(db, 'exams', exId, 'results')
        : query(collection(db, 'exams', exId, 'results'), where('ownerUid', '==', verifiedUid));
      return onSnapshot(
        q,
        (snap) => {
          const remoteResults: ExamStudentResult[] = snap.docs.map((docSnap) => {
            const d = docSnap.data();
            const r: ExamStudentResult = {
              id: docSnap.id,
              examId: exId,
              studentName: String(d.studentName || ''),
              absenNumber: String(d.absenNumber || ''),
              rawScore: Number(d.rawScore) || 0,
              finalScore: Number(d.finalScore) || 0,
              itemScores: Array.isArray(d.itemScores)
                ? d.itemScores.map((v: unknown) => (Number(v) > 0 ? 1 : 0))
                : [],
              answers: Array.isArray(d.answers) ? d.answers.map(String) : undefined,
              submittedAt: Number(d.submittedAt) || Date.now(),
              source: d.source || 'manual',
            };
            syncedResultSigsRef.current[r.id] =
              `${r.source}::${r.rawScore}::${r.finalScore}::${r.submittedAt}::${r.itemScores.length}`;
            return r;
          });

          if (remoteResults.length > 0) {
            setResults((prev) => {
              const map = new Map(prev.map((item) => [item.id, item]));
              for (const rr of remoteResults) {
                const cur = map.get(rr.id);
                if (!cur || cur.source === 'kiosk' || rr.source !== 'kiosk') {
                  map.set(rr.id, rr);
                }
              }
              return Array.from(map.values());
            });
            void auth.currentUser
              ?.getIdToken()
              .catch(() => '')
              .then((idToken) =>
                fetch('/api/exams/hydrate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    currentPin: authenticatedPinRef.current || authenticatedPin,
                    idToken: idToken || undefined,
                    results: remoteResults,
                  }),
                })
              )
              .catch(() => {});
          }
        },
        (error) => {
          reportSnapshotError(error, OperationType.LIST, resultsPath);
        }
      );
    });

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [isOpen, authenticatedPin, verifiedUid, isPrimaryTeacher, examIdKey, reportSnapshotError]);

  if (!isOpen) return null;

  const handleGoogleSignIn = async (includeWorkspaceScopes = true): Promise<string | null> => {
    setFirebaseAuthBusy(true);
    setFirebaseNotice(null);
    setAuthError(null);
    try {
      const { user, accessToken, workspaceWarning } = await signInTeacherWithGoogle(
        includeWorkspaceScopes
      );
      setOfferBasicGoogleFallback(false);
      setWorkspaceToken(accessToken);
      if (!authenticatedPin && user.emailVerified) {
        const unlocked = await unlockPanelWithGoogleUser(user);
        if (!unlocked.ok) {
          setAuthError(
            unlocked.error ||
              `Akun ${user.email || ''} berhasil masuk, silakan masukkan PIN Pengawas jika akses otomatis tertunda.`
          );
        }
      }
      if (workspaceWarning) {
        setFirebaseNotice(workspaceWarning);
      }
      return accessToken;
    } catch (err) {
      const msg = formatFirebaseNoticeError(err, 'Login Google dibatalkan atau gagal.');
      setFirebaseNotice(msg);
      if (includeWorkspaceScopes) {
        setOfferBasicGoogleFallback(true);
      }
      if (!authenticatedPin) {
        setAuthError(msg);
      }
      return null;
    } finally {
      setFirebaseAuthBusy(false);
    }
  };

  const handleGoogleSignOut = async () => {
    await signOutTeacher();
    setWorkspaceToken(null);
    setDriveForms([]);
    setShowDrivePicker(false);
    syncedConfigSigRef.current = '';
    syncedExamSigsRef.current = {};
    syncedResultSigsRef.current = {};
    syncedSessionSigsRef.current = {};
    knownFirestoreExamIdsRef.current.clear();
  };

  const handleOpenDriveFormPicker = async () => {
    setFirebaseNotice(null);
    let token = workspaceToken || getWorkspaceAccessToken();
    if (!token) {
      token = await handleGoogleSignIn();
    }
    if (!token) return;

    setLoadingDriveForms(true);
    setShowDrivePicker(true);
    try {
      const files = await listTeacherFormsFromDrive(token);
      setDriveForms(files);
    } catch (err) {
      if (err instanceof GoogleFormApiError && err.isAuthError) {
        clearWorkspaceAccessToken();
        setWorkspaceToken(null);
      }
      setFirebaseNotice(
        err instanceof Error ? err.message : 'Gagal memuat daftar Google Form dari Drive.'
      );
      setShowDrivePicker(false);
    } finally {
      setLoadingDriveForms(false);
    }
  };

  const handlePickDriveForm = async (file: DriveFormFile) => {
    const token = workspaceToken || getWorkspaceAccessToken();
    if (!token || !editingExam) return;
    setLoadingDriveForms(true);
    try {
      const body = await fetchGoogleFormBody(token, file.id);
      const urlToUse = body.responderUri || file.webViewLink || '';
      setEditingExam({
        ...editingExam,
        googleFormId: file.id,
        googleFormUrl: urlToUse,
      });
      setShowDrivePicker(false);
    } catch (err) {
      if (err instanceof GoogleFormApiError && err.isAuthError) {
        clearWorkspaceAccessToken();
        setWorkspaceToken(null);
      }
      setFirebaseNotice(
        err instanceof Error ? err.message : 'Gagal membaca detail Google Form.'
      );
    } finally {
      setLoadingDriveForms(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      await fetchProctorData(pin.trim(), { syncAll: true });
      setAuthenticatedPin(pin.trim());
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Gagal masuk Panel Guru.');
    } finally {
      setAuthLoading(false);
    }
  };

  const openNewExamEditor = () => {
    const draft = createBlankExamDraft(portalSettings?.defaultTeacherName || 'Guru Kelas 5D');
    setEditingExam(draft);
    setStartLocalInput(toLocalDateTimeInput(draft.scheduledStart));
    setEndLocalInput(toLocalDateTimeInput(draft.scheduledEnd));
    setShowPreview(false);
    setFeedback(null);
  };

  const openEditExam = (exam: ExamItem) => {
    setEditingExam({ ...exam });
    setStartLocalInput(toLocalDateTimeInput(exam.scheduledStart));
    setEndLocalInput(toLocalDateTimeInput(exam.scheduledEnd));
    setShowPreview(false);
    setFeedback(null);
  };

  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExam || !authenticatedPin) return;

    setSaving(true);
    setFeedback(null);
    try {
      const payloadExam: ExamItem = {
        ...editingExam,
        scheduledStart: fromLocalDateTimeInput(startLocalInput),
        scheduledEnd: fromLocalDateTimeInput(endLocalInput),
      };

      const idToken = await auth.currentUser?.getIdToken().catch(() => '');
      const res = await fetch('/api/exams/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPin: authenticatedPin,
          idToken: idToken || undefined,
          exam: payloadExam,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menyimpan ulangan.');
      }

      const savedExam = data.exam as ExamItem;
      if (verifiedUid) {
        knownFirestoreExamIdsRef.current.add(savedExam.id);
        await saveExamToFirestore(verifiedUid, savedExam, isPrimaryTeacher);
      }

      setExams(data.exams || []);
      setEditingExam(null);
      onConfigUpdated();
      setFeedback({
        type: data.warning ? 'warn' : 'ok',
        text: data.warning
          ? `Ulangan tersimpan dengan catatan: ${data.warning}`
          : `Jadwal ulangan "${savedExam.examTitle} (${savedExam.subject})" berhasil disimpan${verifiedUid ? ' ke Firebase' : ''}.`,
      });

      const activeToken = workspaceToken || getWorkspaceAccessToken();
      if (activeToken && (savedExam.googleFormUrl || savedExam.googleFormId)) {
        void syncExamWithGoogleForm(
          savedExam,
          activeToken,
          authenticatedPin,
          verifiedUid,
          isPrimaryTeacher,
          sessions
        ).catch((err) => {
          if (err instanceof GoogleFormApiError && err.isAuthError) {
            clearWorkspaceAccessToken();
            setWorkspaceToken(null);
          }
          if (err instanceof Error) {
            setFirebaseNotice(err.message);
          }
        });
      }
    } catch (err) {
      setFeedback({
        type: 'err',
        text: formatFirebaseNoticeError(err, 'Gagal menyimpan jadwal ulangan.'),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExam = async (examId: string) => {
    if (!authenticatedPin) return;
    setFeedback(null);
    const idToken = await auth.currentUser?.getIdToken().catch(() => '');
    const res = await fetch('/api/exams/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPin: authenticatedPin,
        idToken: idToken || undefined,
        examId,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      if (verifiedUid) {
        knownFirestoreExamIdsRef.current.delete(examId);
        await deleteExamFromFirestore(verifiedUid, examId);
      }
      setExams(data.exams || []);
      onConfigUpdated();
    }
  };

  const handleQuickModeChange = async (exam: ExamItem, mode: ExamAvailabilityMode) => {
    if (!authenticatedPin) return;
    const idToken = await auth.currentUser?.getIdToken().catch(() => '');
    const res = await fetch('/api/exams/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPin: authenticatedPin,
        idToken: idToken || undefined,
        exam: { ...exam, availabilityMode: mode },
      }),
    });
    const data = await res.json();
    if (res.ok) {
      if (verifiedUid && data.exam) {
        await saveExamToFirestore(verifiedUid, data.exam as ExamItem, isPrimaryTeacher);
      }
      setExams(data.exams || []);
      onConfigUpdated();
    }
  };

  const handleSavePortalSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portalSettings || !authenticatedPin) return;
    setSaving(true);
    setFeedback(null);
    try {
      const idToken = await auth.currentUser?.getIdToken().catch(() => '');
      const res = await fetch('/api/portal/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPin: authenticatedPin,
          idToken: idToken || undefined,
          settings: portalSettings,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menyimpan pengaturan portal.');
      }

      const nextSettings = data.settings as PortalSettings;
      if (verifiedUid) {
        syncedConfigSigRef.current = JSON.stringify(nextSettings);
        await savePortalConfigToFirestore(verifiedUid, nextSettings, teacherEmail);
      }

      setPortalSettings(nextSettings);
      setAuthenticatedPin(nextSettings.proctorPin);
      onConfigUpdated();
      setFeedback({
        type: 'ok',
        text: `Pengaturan kelas dan PIN Pengawas berhasil diperbarui${verifiedUid ? ' di Firebase' : ''}.`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal menyimpan pengaturan.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUnlockStudent = async (sessionId: string) => {
    if (!authenticatedPin) return;
    const idToken = await auth.currentUser?.getIdToken().catch(() => '');
    const res = await fetch(`/api/sessions/${sessionId}/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: authenticatedPin, idToken: idToken || undefined }),
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data?.session) {
        setSessions((prev) => prev.map((s) => (s.id === sessionId ? data.session : s)));
      }
      fetchProctorData(authenticatedPin, { syncAll: false }).catch(() => {});
    }
  };

  const handleForceUnlockSubmit = async (sessionId: string) => {
    if (!authenticatedPin) return;
    const idToken = await auth.currentUser?.getIdToken().catch(() => '');
    const res = await fetch(`/api/sessions/${sessionId}/force-unlock-submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: authenticatedPin, idToken: idToken || undefined }),
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data?.session) {
        setSessions((prev) => prev.map((s) => (s.id === sessionId ? data.session : s)));
      }
      fetchProctorData(authenticatedPin, { syncAll: false }).catch(() => {});
    }
  };

  const handleResetSessions = async () => {
    if (!authenticatedPin) return;
    const idToken = await auth.currentUser?.getIdToken().catch(() => '');
    const res = await fetch('/api/exam/reset-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pin: authenticatedPin,
        idToken: idToken || undefined,
      }),
    });
    if (res.ok) {
      setSessions([]);
    }
  };

  const handleCopyStudentLink = () => {
    navigator.clipboard.writeText(window.location.origin).catch(() => {});
    setCopiedLink(true);
    window.setTimeout(() => setCopiedLink(false), 2000);
  };

  const urlCheck = editingExam?.googleFormUrl
    ? normalizeGoogleFormUrl(editingExam.googleFormUrl)
    : null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Panel Guru &amp; Pengawas</h2>
            <p className="text-xs text-slate-500">
              Kelola daftar jadwal ulangan, judul &amp; mapel custom, link Google Form, dan pantau
              siswa.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup Panel Guru"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        {!authenticatedPin || !portalSettings ? (
          <div className="mx-auto my-8 w-full max-w-sm px-6">
            <div className="flex items-center gap-2.5 text-slate-900">
              <Lock className="h-5 w-5 text-sky-600" />
              <h3 className="text-base font-bold">Masuk Panel Guru</h3>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
              Masuk sekali dengan akun Google (Gmail biasa maupun Belajar.id) untuk membuka Panel
              Guru dan sinkronisasi Firebase.
            </p>

            <button
              type="button"
              disabled={firebaseAuthBusy}
              onClick={() => handleGoogleSignIn(true)}
              className="mt-4 flex w-full items-center justify-center gap-2.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-2xs hover:bg-slate-50 disabled:opacity-60"
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              {firebaseAuthBusy ? 'Menghubungkan...' : 'Sign in with Google (Penuh: Firebase + Form)'}
            </button>

            <button
              type="button"
              disabled={firebaseAuthBusy}
              onClick={() => handleGoogleSignIn(false)}
              className={`mt-2 w-full rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-60 ${
                offerBasicGoogleFallback
                  ? 'border-sky-300 bg-sky-50 text-sky-900 hover:bg-sky-100'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Masuk Gmail / Google (Mode Firebase)
            </button>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-[11px] font-medium text-slate-400">atau gunakan PIN</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <form onSubmit={handleLogin}>
              <div>
                <label htmlFor="proctorPin" className="block text-xs font-medium text-slate-700">
                  PIN Pengawas (Default:{' '}
                  <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-slate-900">
                    5555
                  </code>
                  )
                </label>
                <input
                  id="proctorPin"
                  type="password"
                  inputMode="numeric"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Masukkan PIN Pengawas"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 font-mono text-sm focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
                />
              </div>

              {authError && <p className="mt-3 text-xs font-medium text-red-600">{authError}</p>}

              <button
                type="submit"
                disabled={authLoading}
                className="mt-4 w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {authLoading ? 'Memverifikasi...' : 'Masuk dengan PIN'}
              </button>
            </form>
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Locked Student Alert Banner */}
            {sessions.some((s) => s.status === 'locked') && panelTab !== 'sessions' && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-red-200 bg-red-50 px-6 py-2.5 text-xs text-red-900">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
                  <span>
                    Ada {sessions.filter((s) => s.status === 'locked').length} siswa terkunci karena
                    melanggar batas fokus.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPanelTab('sessions');
                    setEditingExam(null);
                  }}
                  className="rounded-md bg-red-700 px-3 py-1 font-semibold text-white hover:bg-red-800"
                >
                  Buka Kunci di Kontrol Siswa
                </button>
              </div>
            )}

            {/* Internal Segmented Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-slate-50 px-6 py-3">
              <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-200/70 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setPanelTab('exams');
                    setFeedback(null);
                  }}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                    panelTab === 'exams'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Jadwal Ulangan ({exams.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPanelTab('analysis');
                    setEditingExam(null);
                    setFeedback(null);
                  }}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                    panelTab === 'analysis'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Nilai &amp; Analisis Butir ({results.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPanelTab('sessions');
                    setEditingExam(null);
                    setFeedback(null);
                  }}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                    panelTab === 'sessions'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Kontrol Siswa ({sessions.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPanelTab('portal');
                    setEditingExam(null);
                    setFeedback(null);
                  }}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                    panelTab === 'portal'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Kelas &amp; PIN
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {verifiedUid ? (
                  <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-900">
                    <Cloud className="h-3.5 w-3.5 text-emerald-700" />
                    <span className="max-w-[160px] truncate font-medium">
                      {firebaseUser?.email}
                    </span>
                    {!workspaceToken && (
                      <button
                        type="button"
                        disabled={firebaseAuthBusy}
                        onClick={() => handleGoogleSignIn(true)}
                        className="font-semibold text-sky-800 hover:underline"
                      >
                        Sinkron Form
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleGoogleSignOut}
                      className="inline-flex items-center gap-1 font-semibold text-emerald-800 hover:underline"
                      title="Keluar akun Google"
                    >
                      <LogOut className="h-3 w-3" />
                      Keluar
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={firebaseAuthBusy}
                      onClick={() => handleGoogleSignIn(true)}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-2xs hover:bg-slate-50 disabled:opacity-60 whitespace-nowrap"
                    >
                      <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 48 48" aria-hidden="true">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                      </svg>
                      {firebaseAuthBusy ? 'Menghubungkan...' : 'Sign in with Google'}
                    </button>
                    <button
                      type="button"
                      disabled={firebaseAuthBusy}
                      onClick={() => handleGoogleSignIn(false)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-900 hover:bg-sky-100 disabled:opacity-60 whitespace-nowrap"
                    >
                      <Cloud className="h-3.5 w-3.5 text-sky-700" />
                      Masuk Gmail (Firebase)
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={handleCopyStudentLink}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                >
                  {copiedLink ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      Link Portal Disalin
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Salin Link untuk Siswa
                    </>
                  )}
                </button>
              </div>
            </div>

            {firebaseNotice && (
              <div className="flex items-center justify-between gap-2 border-b border-red-200 bg-red-50 px-6 py-2 text-xs font-medium text-red-800">
                <span>{firebaseNotice}</span>
                <button
                  type="button"
                  onClick={() => setFirebaseNotice(null)}
                  className="font-semibold underline"
                >
                  Tutup
                </button>
              </div>
            )}

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {panelTab === 'exams' && !editingExam && (
                <div className="space-y-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        Daftar Jadwal Ulangan
                      </h3>
                      <p className="text-xs text-slate-600">
                        Tambahkan satu atau beberapa ulangan sekaligus lengkap dengan jadwal tanggal,
                        jam, mapel, token, dan link Google Form masing-masing.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={openNewExamEditor}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-sky-700 whitespace-nowrap"
                    >
                      <Plus className="h-4 w-4" />
                      Tambah Ulangan Baru
                    </button>
                  </div>

                  {feedback && (
                    <div
                      className={`flex items-start gap-2.5 rounded-lg border px-4 py-3 text-xs font-medium ${
                        feedback.type === 'ok'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                          : feedback.type === 'warn'
                            ? 'border-amber-200 bg-amber-50 text-amber-900'
                            : 'border-red-200 bg-red-50 text-red-900'
                      }`}
                    >
                      {feedback.type === 'ok' ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                      ) : (
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      )}
                      <span>{feedback.text}</span>
                    </div>
                  )}

                  {exams.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-6 py-12 text-center">
                      <CalendarClock className="mx-auto h-9 w-9 text-slate-400" />
                      <p className="mt-3 text-sm font-semibold text-slate-800">
                        Belum ada ulangan dalam daftar jadwal
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Klik tombol &ldquo;Tambah Ulangan Baru&rdquo; untuk memasukkan jadwal ulangan
                        pertama.
                      </p>
                      <button
                        type="button"
                        onClick={openNewExamEditor}
                        className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                      >
                        <Plus className="h-4 w-4" />
                        Tambah Ulangan Pertama
                      </button>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-200 rounded-xl border border-slate-200">
                      {exams.map((exam) => (
                        <div
                          key={exam.id}
                          className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                              <span className="font-semibold text-sky-700">{exam.subject}</span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono">Token: {exam.entryToken}</span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums">
                                {exam.durationMinutes}m (Kunci {exam.lockSubmitMinutes}m)
                              </span>
                            </div>
                            <h4 className="mt-1 text-sm font-bold text-slate-900">
                              {exam.examTitle}
                            </h4>
                            <p className="mt-1 text-xs text-slate-600">
                              {formatExamScheduleLabel(exam)}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <select
                              aria-label={`Status akses ${exam.examTitle}`}
                              value={exam.availabilityMode}
                              onChange={(e) =>
                                handleQuickModeChange(
                                  exam,
                                  e.target.value as ExamAvailabilityMode
                                )
                              }
                              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-sky-600 focus:outline-none"
                            >
                              <option value="scheduled">Sesuai Jadwal</option>
                              <option value="manual_open">Buka Sekarang</option>
                              <option value="closed">Tutup</option>
                            </select>

                            <button
                              type="button"
                              onClick={() => openEditExam(exam)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteExam(exam.id)}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                              title="Hapus Ulangan"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {panelTab === 'exams' && editingExam && (
                <form onSubmit={handleSaveExam} className="space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingExam(null);
                        setFeedback(null);
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Kembali ke Daftar Jadwal
                    </button>
                    <h3 className="text-sm font-bold text-slate-900">
                      {editingExam.id ? 'Edit Jadwal Ulangan' : 'Tambah Ulangan Baru'}
                    </h3>
                  </div>

                  {/* Custom Title & Subject */}
                  <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 p-5 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label
                        htmlFor="editExamTitle"
                        className="block text-xs font-semibold text-slate-700"
                      >
                        Judul Ulangan (Custom)
                      </label>
                      <input
                        id="editExamTitle"
                        type="text"
                        placeholder="Ketik judul ulangan (misal: Sumatif Tengah Semester Genap)"
                        value={editingExam.examTitle}
                        onChange={(e) =>
                          setEditingExam({ ...editingExam, examTitle: e.target.value })
                        }
                        className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="editSubject"
                        className="block text-xs font-semibold text-slate-700"
                      >
                        Mata Pelajaran (Custom)
                      </label>
                      <input
                        id="editSubject"
                        type="text"
                        placeholder="Ketik mata pelajaran (misal: Matematika)"
                        value={editingExam.subject}
                        onChange={(e) =>
                          setEditingExam({ ...editingExam, subject: e.target.value })
                        }
                        className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="editTeacher"
                        className="block text-xs font-semibold text-slate-700"
                      >
                        Guru Pengampu
                      </label>
                      <input
                        id="editTeacher"
                        type="text"
                        value={editingExam.teacherName}
                        onChange={(e) =>
                          setEditingExam({ ...editingExam, teacherName: e.target.value })
                        }
                        className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Google Form URL */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label
                        htmlFor="googleFormUrl"
                        className="text-sm font-bold text-slate-900"
                      >
                        Link Google Form Ulangan Ini
                      </label>
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={handleOpenDriveFormPicker}
                          disabled={loadingDriveForms}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          <FolderOpen className="h-3.5 w-3.5 text-sky-700" />
                          {loadingDriveForms ? 'Memuat Drive...' : 'Pilih dari Google Drive'}
                        </button>
                        {urlCheck?.isValid && (
                          <button
                            type="button"
                            onClick={() => setShowPreview((p) => !p)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:text-sky-800"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            {showPreview ? 'Tutup Pratinjau Form' : 'Uji Tampilan Form'}
                          </button>
                        )}
                      </div>
                    </div>
                    <input
                      id="googleFormUrl"
                      type="text"
                      inputMode="url"
                      placeholder="Tempelkan link https://docs.google.com/forms/d/e/.../viewform"
                      value={editingExam.googleFormUrl}
                      onChange={(e) =>
                        setEditingExam({
                          ...editingExam,
                          googleFormUrl: e.target.value,
                          googleFormId: '',
                        })
                      }
                      className="mt-2.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
                    />

                    {showDrivePicker && (
                      <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <span className="text-xs font-semibold text-slate-800">
                            Pilih Google Form dari Google Drive Anda
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowDrivePicker(false)}
                            className="text-xs font-medium text-slate-500 hover:text-slate-900"
                          >
                            Tutup
                          </button>
                        </div>
                        {loadingDriveForms ? (
                          <p className="py-4 text-center text-xs text-slate-500">
                            Mengambil daftar Google Form...
                          </p>
                        ) : driveForms.length === 0 ? (
                          <p className="py-4 text-center text-xs text-slate-500">
                            Tidak ditemukan file Google Form di Google Drive akun ini.
                          </p>
                        ) : (
                          <div className="mt-2 max-h-44 divide-y divide-slate-100 overflow-y-auto">
                            {driveForms.map((f) => (
                              <button
                                key={f.id}
                                type="button"
                                onClick={() => handlePickDriveForm(f)}
                                className="flex w-full items-center justify-between px-2 py-2 text-left text-xs hover:bg-sky-50"
                              >
                                <span className="font-medium text-slate-800">{f.name}</span>
                                <span className="font-mono text-[11px] text-sky-700">Pilih</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {urlCheck?.warning && (
                      <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-800">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>{urlCheck.warning}</span>
                      </p>
                    )}

                    {showPreview && urlCheck?.embedUrl && (
                      <div className="mt-4 overflow-hidden rounded-lg border border-slate-300 bg-white">
                        <div className="border-b border-slate-200 bg-slate-100 px-3 py-1.5 text-[11px] font-medium text-slate-600">
                          Pratinjau Embed Google Form
                        </div>
                        <iframe
                          title="Pratinjau Google Form"
                          src={urlCheck.embedUrl}
                          className="h-64 w-full border-0"
                        />
                      </div>
                    )}
                  </div>

                  {/* Schedule Window */}
                  <div className="rounded-xl border border-slate-200 p-5">
                    <span className="block text-sm font-bold text-slate-900">
                      Jadwal &amp; Waktu Akses Siswa
                    </span>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(
                        [
                          { id: 'scheduled', label: 'Sesuai Jadwal (Tanggal & Jam)' },
                          { id: 'manual_open', label: 'Buka Sekarang (Manual)' },
                          { id: 'closed', label: 'Tutup Sementara' },
                        ] as const
                      ).map((mode) => (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() =>
                            setEditingExam({ ...editingExam, availabilityMode: mode.id })
                          }
                          className={`rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors ${
                            editingExam.availabilityMode === mode.id
                              ? 'border-sky-600 bg-sky-50 text-sky-800'
                              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {mode.label}
                        </button>
                      ))}
                    </div>

                    {editingExam.availabilityMode === 'scheduled' && (
                      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label
                            htmlFor="scheduledStart"
                            className="block text-xs font-semibold text-slate-700"
                          >
                            Waktu Mulai Dibuka
                          </label>
                          <input
                            id="scheduledStart"
                            type="datetime-local"
                            value={startLocalInput}
                            onChange={(e) => setStartLocalInput(e.target.value)}
                            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 font-mono text-xs focus:border-sky-600 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="scheduledEnd"
                            className="block text-xs font-semibold text-slate-700"
                          >
                            Batas Akhir Masuk Ujian
                          </label>
                          <input
                            id="scheduledEnd"
                            type="datetime-local"
                            value={endLocalInput}
                            onChange={(e) => setEndLocalInput(e.target.value)}
                            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 font-mono text-xs focus:border-sky-600 focus:outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Token & 1-Hour Lock */}
                  <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 p-5 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Token Masuk Ujian
                      </label>
                      <input
                        type="text"
                        placeholder="Misal: MTK5D"
                        value={editingExam.entryToken}
                        onChange={(e) =>
                          setEditingExam({
                            ...editingExam,
                            entryToken: e.target.value.toUpperCase(),
                          })
                        }
                        className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 font-mono text-sm font-bold uppercase focus:border-sky-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Token Kirim (Muncul Setelah Waktu Kunci)
                      </label>
                      <input
                        type="text"
                        value={editingExam.submitToken}
                        onChange={(e) =>
                          setEditingExam({
                            ...editingExam,
                            submitToken: e.target.value.toUpperCase(),
                          })
                        }
                        className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 font-mono text-sm font-bold uppercase focus:border-sky-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Durasi Total Ujian (Menit)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={240}
                        value={editingExam.durationMinutes}
                        onChange={(e) => {
                          const v = Math.max(1, Number(e.target.value) || 60);
                          setEditingExam({
                            ...editingExam,
                            durationMinutes: v,
                            lockSubmitMinutes: Math.min(editingExam.lockSubmitMinutes, v),
                          });
                        }}
                        className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 font-mono text-sm tabular-nums focus:border-sky-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Kunci Tombol Kirim Selama (Menit)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={editingExam.durationMinutes}
                        value={editingExam.lockSubmitMinutes}
                        onChange={(e) =>
                          setEditingExam({
                            ...editingExam,
                            lockSubmitMinutes: Math.min(
                              editingExam.durationMinutes,
                              Math.max(0, Number(e.target.value) || 0)
                            ),
                          })
                        }
                        className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 font-mono text-sm tabular-nums focus:border-sky-600 focus:outline-none"
                      />
                    </div>

                    <div className="sm:col-span-2 flex flex-wrap items-center gap-2 pt-1">
                      <span className="text-xs font-medium text-slate-500">Durasi cepat:</span>
                      <button
                        type="button"
                        onClick={() =>
                          setEditingExam({
                            ...editingExam,
                            durationMinutes: 60,
                            lockSubmitMinutes: 60,
                          })
                        }
                        className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        1 Jam Penuh (60 Menit)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setEditingExam({
                            ...editingExam,
                            durationMinutes: 90,
                            lockSubmitMinutes: 60,
                          })
                        }
                        className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        90 Menit (Kunci Kirim 60 Menit)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setEditingExam({
                            ...editingExam,
                            durationMinutes: 2,
                            lockSubmitMinutes: 1,
                          })
                        }
                        className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Uji Coba (1 Menit)
                      </button>
                    </div>
                  </div>

                  {/* Grading & Item Analysis Formula Settings */}
                  <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 p-5 sm:grid-cols-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Skor Maksimal (Pembagi Rumus)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={200}
                        value={editingExam.maxRawScore}
                        onChange={(e) =>
                          setEditingExam({
                            ...editingExam,
                            maxRawScore: Math.max(1, Number(e.target.value) || 40),
                          })
                        }
                        className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm tabular-nums focus:border-sky-600 focus:outline-none"
                      />
                      <span className="mt-1 block text-[11px] text-slate-500">
                        Rumus: (Skor ÷ {editingExam.maxRawScore}) × 100
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Jumlah Butir Soal
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={editingExam.questionCount}
                        onChange={(e) =>
                          setEditingExam({
                            ...editingExam,
                            questionCount: Math.max(1, Number(e.target.value) || 40),
                          })
                        }
                        className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm tabular-nums focus:border-sky-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        KKM Ketuntasan
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={editingExam.kkm}
                        onChange={(e) =>
                          setEditingExam({
                            ...editingExam,
                            kkm: Math.min(100, Math.max(0, Number(e.target.value) || 75)),
                          })
                        }
                        className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm tabular-nums focus:border-sky-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Security Toggles */}
                  <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                    <div className="mb-2">
                      <label className="block text-xs font-semibold text-slate-700">
                        Batas Pelanggaran Keluar Layar Sebelum Terkunci Otomatis ke Panel Guru
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={editingExam.maxViolationsBeforeLock}
                        onChange={(e) =>
                          setEditingExam({
                            ...editingExam,
                            maxViolationsBeforeLock: Math.max(1, Number(e.target.value) || 3),
                          })
                        }
                        className="mt-1.5 w-32 rounded-lg border border-slate-300 px-3 py-1.5 font-mono text-sm tabular-nums focus:border-sky-600 focus:outline-none"
                      />
                    </div>

                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingExam.enableSubmitToken}
                        onChange={(e) =>
                          setEditingExam({ ...editingExam, enableSubmitToken: e.target.checked })
                        }
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-600"
                      />
                      <span className="text-xs leading-relaxed text-slate-700">
                        <strong className="block text-slate-900">
                          Tampilkan Token Kirim Otomatis Setelah Waktu Kunci Selesai
                        </strong>
                        Token otomatis muncul setelah waktu tunggu selesai untuk validasi form.
                      </span>
                    </label>

                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingExam.enableBottomOverlayGuard}
                        onChange={(e) =>
                          setEditingExam({
                            ...editingExam,
                            enableBottomOverlayGuard: e.target.checked,
                          })
                        }
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-600"
                      />
                      <span className="text-xs leading-relaxed text-slate-700">
                        <strong className="block text-slate-900">
                          Tutup Area Bawah Layar Form Selama Waktu Berjalan
                        </strong>
                        Menampilkan bilah pelindung di bagian bawah layar agar tombol Kirim tidak
                        terklik lebih awal.
                      </span>
                    </label>
                  </div>

                  {feedback && (
                    <div
                      className={`flex items-start gap-2.5 rounded-lg border px-4 py-3 text-xs font-medium ${
                        feedback.type === 'err'
                          ? 'border-red-200 bg-red-50 text-red-900'
                          : 'border-amber-200 bg-amber-50 text-amber-900'
                      }`}
                    >
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{feedback.text}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
                    <button
                      type="button"
                      onClick={() => setEditingExam(null)}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
                    >
                      <Save className="h-4 w-4" />
                      {saving ? 'Menyimpan...' : 'Simpan ke Daftar Jadwal'}
                    </button>
                  </div>
                </form>
              )}

              {panelTab === 'portal' && (
                <form onSubmit={handleSavePortalSettings} className="max-w-lg space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Nama Kelas
                    </label>
                    <input
                      type="text"
                      value={portalSettings.className}
                      onChange={(e) =>
                        setPortalSettings({ ...portalSettings, className: e.target.value })
                      }
                      className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-sky-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Nama Wali Kelas / Guru Default
                    </label>
                    <input
                      type="text"
                      value={portalSettings.defaultTeacherName}
                      onChange={(e) =>
                        setPortalSettings({
                          ...portalSettings,
                          defaultTeacherName: e.target.value,
                        })
                      }
                      className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-sky-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      PIN Pengawas (Minimal 4 Karakter)
                    </label>
                    <input
                      type="text"
                      value={portalSettings.proctorPin}
                      onChange={(e) =>
                        setPortalSettings({ ...portalSettings, proctorPin: e.target.value })
                      }
                      className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 font-mono text-sm focus:border-sky-600 focus:outline-none"
                    />
                  </div>

                  {feedback && (
                    <div
                      className={`flex items-start gap-2.5 rounded-lg border px-4 py-3 text-xs font-medium ${
                        feedback.type === 'ok'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                          : 'border-red-200 bg-red-50 text-red-900'
                      }`}
                    >
                      <span>{feedback.text}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" />
                    {saving ? 'Menyimpan...' : 'Simpan Pengaturan Kelas'}
                  </button>
                </form>
              )}

              {panelTab === 'analysis' && (
                <ProctorAnalysisTab
                  exams={exams}
                  results={results}
                  sessions={sessions}
                  className={portalSettings.className}
                  authenticatedPin={authenticatedPin}
                  firebaseUserUid={verifiedUid}
                  isPrimaryTeacher={isPrimaryTeacher}
                  workspaceToken={workspaceToken}
                  onConnectGoogle={handleGoogleSignIn}
                  onWorkspaceAuthInvalidated={() => setWorkspaceToken(null)}
                  onExamUpdated={(updatedExam) => {
                    setExams((prev) =>
                      prev.map((e) => (e.id === updatedExam.id ? updatedExam : e))
                    );
                  }}
                  onResultsUpdated={(examId, nextExamResults) => {
                    setResults((prev) => [
                      ...prev.filter((r) => r.examId !== examId),
                      ...nextExamResults,
                    ]);
                  }}
                />
              )}

              {panelTab === 'sessions' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-600">
                      Siswa yang melanggar 3 kali otomatis terkunci dan muncul di sini untuk Anda
                      buka kuncinya langsung dari Panel Guru.
                    </p>
                    {sessions.length > 0 && (
                      <button
                        type="button"
                        onClick={handleResetSessions}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Hapus Riwayat Sesi
                      </button>
                    )}
                  </div>

                  {sessions.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 py-12 text-center text-sm text-slate-500">
                      Belum ada siswa yang memulai sesi ujian.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-200 rounded-xl border border-slate-200">
                      {sessions
                        .slice()
                        .sort((a, b) => {
                          if (a.status === 'locked' && b.status !== 'locked') return -1;
                          if (a.status !== 'locked' && b.status === 'locked') return 1;
                          return b.startedAt - a.startedAt;
                        })
                        .map((s) => {
                          const activeStrikes = s.violations.filter((v) => !v.forgiven).length;
                          const isUnlocked = Date.now() >= s.unlockAt;
                          return (
                            <div
                              key={s.id}
                              className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between ${
                                s.status === 'locked' ? 'bg-red-50/60' : ''
                              }`}
                            >
                              <div>
                                <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                                  <span className="font-mono text-sky-700">#{s.absenNumber}</span>
                                  <span>{s.studentName}</span>
                                  <span className="text-xs font-normal text-slate-500">
                                    · {s.subject} ({s.examTitle})
                                  </span>
                                </div>
                                <p className="mt-0.5 text-xs text-slate-500">
                                  Status:{' '}
                                  <strong
                                    className={
                                      s.status === 'locked'
                                        ? 'text-red-700'
                                        : s.status === 'finished'
                                          ? 'text-emerald-700'
                                          : 'text-sky-700'
                                    }
                                  >
                                    {s.status === 'locked'
                                      ? 'Terkunci (Menunggu Guru)'
                                      : s.status === 'finished'
                                        ? 'Selesai'
                                        : 'Aktif'}
                                  </strong>{' '}
                                  · Pelanggaran aktif: {activeStrikes} (total {s.violations.length})
                                </p>
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                {s.status === 'locked' && (
                                  <button
                                    type="button"
                                    onClick={() => handleUnlockStudent(s.id)}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-800"
                                  >
                                    <Unlock className="h-3.5 w-3.5" />
                                    Buka Kunci Siswa
                                  </button>
                                )}
                                {s.status !== 'finished' && !isUnlocked && (
                                  <button
                                    type="button"
                                    onClick={() => handleForceUnlockSubmit(s.id)}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                  >
                                    <Timer className="h-3.5 w-3.5" />
                                    Buka Tombol Kirim
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
