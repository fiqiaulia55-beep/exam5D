import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { normalizeGoogleFormUrl } from './src/utils/formUrl.ts';
import { calculateFinalScore } from './src/utils/itemAnalysis.ts';
import type {
  ExamComputedStatus,
  ExamItem,
  ExamPublicItem,
  ExamStudentResult,
  PortalSettings,
  StudentSession,
} from './src/types.ts';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const STATE_FILE = path.join(DATA_DIR, 'portal-state.json');

interface PortalState {
  settings: PortalSettings;
  exams: ExamItem[];
  sessions: StudentSession[];
  results: ExamStudentResult[];
}

const DEFAULT_SETTINGS: PortalSettings = {
  className: 'Kelas 5D',
  defaultTeacherName: 'Guru Kelas 5D',
  proctorPin: '5555',
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function normalizeExamRecord(raw: Partial<ExamItem>): ExamItem {
  return {
    id: raw.id || crypto.randomUUID(),
    examTitle: raw.examTitle || '',
    subject: raw.subject || '',
    teacherName: raw.teacherName || DEFAULT_SETTINGS.defaultTeacherName,
    googleFormUrl: raw.googleFormUrl || '',
    googleFormId: raw.googleFormId || '',
    entryToken: raw.entryToken || '',
    submitToken: raw.submitToken || 'KIRIM5D',
    durationMinutes: Number(raw.durationMinutes) || 60,
    lockSubmitMinutes: Number(raw.lockSubmitMinutes ?? 60),
    enableSubmitToken: Boolean(raw.enableSubmitToken ?? true),
    enableBottomOverlayGuard: Boolean(raw.enableBottomOverlayGuard ?? false),
    maxViolationsBeforeLock: Number(raw.maxViolationsBeforeLock) || 3,
    availabilityMode: raw.availabilityMode || 'scheduled',
    scheduledStart: raw.scheduledStart || '',
    scheduledEnd: raw.scheduledEnd || '',
    maxRawScore: Number(raw.maxRawScore) || 40,
    questionCount: Number(raw.questionCount) || 40,
    kkm: Number(raw.kkm) || 75,
    webhookSecret: raw.webhookSecret || crypto.randomBytes(12).toString('hex'),
    answerKey: Array.isArray(raw.answerKey) ? raw.answerKey : [],
    updatedAt: raw.updatedAt || new Date().toISOString(),
  };
}

function loadState(): PortalState {
  ensureDataDir();
  if (fs.existsSync(STATE_FILE)) {
    try {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<PortalState>;
      return {
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
        exams: Array.isArray(parsed.exams) ? parsed.exams.map(normalizeExamRecord) : [],
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
        results: Array.isArray(parsed.results) ? parsed.results : [],
      };
    } catch {
      return { settings: { ...DEFAULT_SETTINGS }, exams: [], sessions: [], results: [] };
    }
  }
  return { settings: { ...DEFAULT_SETTINGS }, exams: [], sessions: [], results: [] };
}

let state: PortalState = loadState();

function saveState() {
  ensureDataDir();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function computeExamStatus(exam: ExamItem, now: number): ExamComputedStatus {
  if (!exam.googleFormUrl.trim()) {
    return 'no_form';
  }
  if (exam.availabilityMode === 'closed') {
    return 'closed';
  }
  if (exam.availabilityMode === 'manual_open') {
    return 'open';
  }
  const startMs = exam.scheduledStart ? Date.parse(exam.scheduledStart) : NaN;
  const endMs = exam.scheduledEnd ? Date.parse(exam.scheduledEnd) : NaN;

  if (!Number.isNaN(startMs) && now < startMs) {
    return 'upcoming';
  }
  if (!Number.isNaN(endMs) && now > endMs) {
    return 'ended';
  }
  return 'open';
}

function toPublicExam(exam: ExamItem, now: number): ExamPublicItem {
  return {
    id: exam.id,
    examTitle: exam.examTitle,
    subject: exam.subject,
    className: state.settings.className,
    teacherName: exam.teacherName || state.settings.defaultTeacherName,
    durationMinutes: exam.durationMinutes,
    lockSubmitMinutes: exam.lockSubmitMinutes,
    enableSubmitToken: exam.enableSubmitToken,
    enableBottomOverlayGuard: exam.enableBottomOverlayGuard,
    maxViolationsBeforeLock: exam.maxViolationsBeforeLock,
    availabilityMode: exam.availabilityMode,
    scheduledStart: exam.scheduledStart,
    scheduledEnd: exam.scheduledEnd,
    hasFormUrl: Boolean(exam.googleFormUrl.trim()),
    computedStatus: computeExamStatus(exam, now),
    updatedAt: exam.updatedAt,
  };
}

function upsertStudentResult(
  exam: ExamItem,
  payload: {
    studentName: string;
    absenNumber: string;
    rawScore: number;
    itemScores: number[];
    answers?: string[];
    submittedAt?: number;
    source: 'webhook' | 'csv' | 'manual' | 'kiosk' | 'google_forms';
  }
): ExamStudentResult {
  const cleanName = payload.studentName.trim();
  const cleanAbsen = payload.absenNumber.trim();
  const maxRaw = exam.maxRawScore || 40;
  const rawScore = Math.max(0, Number(payload.rawScore) || 0);
  const finalScore = calculateFinalScore(rawScore, maxRaw);

  let existingIdx = state.results.findIndex(
    (r) =>
      r.examId === exam.id &&
      r.absenNumber.toLowerCase() === cleanAbsen.toLowerCase() &&
      r.studentName.toLowerCase() === cleanName.toLowerCase()
  );

  // If upgrading a kiosk submission where Google Form lacked Absen or exact casing, match by studentName or normalized absenNumber
  if (existingIdx < 0 && payload.source !== 'kiosk') {
    const normAbsen = cleanAbsen.replace(/^0+/, '').toLowerCase();
    existingIdx = state.results.findIndex((r) => {
      if (r.examId !== exam.id || r.source !== 'kiosk') return false;
      const rName = r.studentName.trim().toLowerCase();
      const qName = cleanName.toLowerCase();
      if (rName === qName) return true;
      if (qName.length >= 3 && rName.length >= 3 && (rName.includes(qName) || qName.includes(rName))) {
        return true;
      }
      const rAbsen = r.absenNumber.trim().replace(/^0+/, '').toLowerCase();
      return normAbsen !== '-' && normAbsen !== '' && rAbsen === normAbsen;
    });
  }

  // Never overwrite an already-graded result with an ungraded kiosk finish event
  if (existingIdx >= 0 && payload.source === 'kiosk' && state.results[existingIdx].source !== 'kiosk') {
    return state.results[existingIdx];
  }

  const record: ExamStudentResult = {
    id: existingIdx >= 0 ? state.results[existingIdx].id : crypto.randomUUID(),
    examId: exam.id,
    studentName: cleanName,
    absenNumber: cleanAbsen,
    rawScore,
    finalScore,
    itemScores: payload.itemScores.map((v) => (Number(v) > 0 ? 1 : 0)),
    answers: payload.answers,
    submittedAt: payload.submittedAt || Date.now(),
    source: payload.source,
  };

  if (existingIdx >= 0) {
    state.results[existingIdx] = record;
  } else {
    state.results.push(record);
  }
  return record;
}

function createApp() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  // Public exam schedule list (no tokens, PINs, or student scores leaked)
  app.get('/api/exam/public', (_req, res) => {
    const now = Date.now();
    const sortedExams = state.exams
      .slice()
      .sort((a, b) => {
        const aTime = a.scheduledStart ? Date.parse(a.scheduledStart) : Number.MAX_SAFE_INTEGER;
        const bTime = b.scheduledStart ? Date.parse(b.scheduledStart) : Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      })
      .map((ex) => toPublicExam(ex, now));

    res.json({
      settings: {
        className: state.settings.className,
        defaultTeacherName: state.settings.defaultTeacherName,
      },
      exams: sortedExams,
      serverTime: now,
    });
  });

  // Public live summary for monitor tab (no scores leaked to students)
  app.get('/api/sessions/summary', (_req, res) => {
    const now = Date.now();
    const list = state.sessions
      .slice()
      .sort((a, b) => b.startedAt - a.startedAt)
      .map((s) => ({
        id: s.id,
        examId: s.examId,
        examTitle: s.examTitle,
        subject: s.subject,
        studentName: s.studentName,
        absenNumber: s.absenNumber,
        startedAt: s.startedAt,
        endsAt: s.endsAt,
        unlockAt: s.unlockAt,
        status: s.status,
        violationCount: s.violations.length,
        lastViolation: s.violations.length > 0 ? s.violations[s.violations.length - 1] : null,
        finishedAt: s.finishedAt,
        remainingSeconds: Math.max(0, Math.floor((s.endsAt - now) / 1000)),
      }));
    res.json({ sessions: list, serverTime: now });
  });

  // Proctor authentication & full exam/session/results fetch
  app.post('/api/exam/verify-proctor', (req, res) => {
    const pin = String(req.body?.pin ?? '').trim();
    if (!pin || !safeEqual(pin, state.settings.proctorPin)) {
      res.status(401).json({ error: 'PIN Pengawas tidak sesuai.' });
      return;
    }
    res.json({
      settings: state.settings,
      exams: state.exams,
      sessions: state.sessions.slice().sort((a, b) => b.startedAt - a.startedAt),
      results: state.results.slice().sort((a, b) => b.submittedAt - a.submittedAt),
      serverTime: Date.now(),
    });
  });

  async function verifyTeacherIdToken(
    idToken: string
  ): Promise<{ ok: true; email: string; uid: string } | { ok: false; status: number; error: string }> {
    const cfgPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (!fs.existsSync(cfgPath)) {
      return { ok: false, status: 500, error: 'Konfigurasi Firebase belum tersedia.' };
    }
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8')) as { apiKey?: string };
    if (!cfg.apiKey) {
      return { ok: false, status: 500, error: 'API key Firebase tidak ditemukan.' };
    }

    const verifyRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(cfg.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    const verifyData = (await verifyRes.json().catch(() => ({}))) as {
      users?: Array<{ email?: string; emailVerified?: boolean; localId?: string }>;
    };

    const userRecord = verifyData.users?.[0];
    const email = String(userRecord?.email || '').trim().toLowerCase();
    const uid = String(userRecord?.localId || '').trim();
    if (!verifyRes.ok || !userRecord || !userRecord.emailVerified || !email) {
      return {
        ok: false,
        status: 401,
        error: 'Sesi Google tidak valid atau email belum terverifikasi.',
      };
    }

    return { ok: true, email, uid };
  }

  async function isAuthorizedTeacherRequest(req: express.Request): Promise<boolean> {
    const currentPin = String(req.body?.currentPin ?? req.body?.pin ?? '').trim();
    if (currentPin && safeEqual(currentPin, state.settings.proctorPin)) {
      return true;
    }
    const authHeader = String(req.headers.authorization || '');
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const idToken = String(req.body?.idToken ?? bearerToken).trim();
    if (!idToken) return false;
    try {
      const check = await verifyTeacherIdToken(idToken);
      return check.ok === true;
    } catch {
      return false;
    }
  }

  // Auto-unlock Panel Guru for any verified Google account (belajar.id, gmail.com, Google Workspace, etc.)
  app.post('/api/exam/verify-proctor-google', async (req, res) => {
    const authHeader = String(req.headers.authorization || '');
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const idToken = String(req.body?.idToken ?? bearerToken).trim();
    if (!idToken) {
      res.status(400).json({ error: 'Token login Google tidak tersedia.' });
      return;
    }

    try {
      const check = await verifyTeacherIdToken(idToken);
      if (check.ok === false) {
        res.status(check.status).json({ error: check.error });
        return;
      }

      res.json({
        proctorPin: state.settings.proctorPin,
        email: check.email,
        uid: check.uid,
        settings: state.settings,
        exams: state.exams,
        sessions: state.sessions.slice().sort((a, b) => b.startedAt - a.startedAt),
        results: state.results.slice().sort((a, b) => b.submittedAt - a.submittedAt),
        serverTime: Date.now(),
      });
    } catch {
      res.status(500).json({ error: 'Gagal memverifikasi akun Google Guru.' });
    }
  });

  async function resolveFormsGleUrl(rawUrl: string): Promise<string> {
    let parsed: URL;
    try {
      parsed = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`);
    } catch {
      throw new Error('Format URL tidak valid.');
    }
    if (parsed.protocol !== 'https:' || parsed.hostname.toLowerCase() !== 'forms.gle') {
      throw new Error('Hanya tautan https://forms.gle/... yang dapat diuraikan.');
    }
    const resp = await fetch(parsed.toString(), { method: 'GET', redirect: 'follow' });
    const finalUrl = resp.url || '';
    if (!finalUrl.startsWith('https://docs.google.com/forms/')) {
      throw new Error('Tautan forms.gle tidak mengarah ke Google Form yang valid.');
    }
    return finalUrl;
  }

  // SSRF-safe short URL resolver strictly limited to forms.gle -> docs.google.com/forms
  app.post('/api/forms/resolve-short-url', async (req, res) => {
    const rawUrl = String(req.body?.url ?? '').trim();
    try {
      const resolvedUrl = await resolveFormsGleUrl(rawUrl);
      res.json({ resolvedUrl });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal membuka tautan pendek forms.gle.';
      const status =
        msg.includes('Format URL') || msg.includes('Hanya tautan') || msg.includes('tidak mengarah')
          ? 400
          : 502;
      res.status(status).json({ error: msg });
    }
  });

  // Update global portal settings
  app.post('/api/portal/settings', (req, res) => {
    const currentPin = String(req.body?.currentPin ?? '').trim();
    if (!currentPin || !safeEqual(currentPin, state.settings.proctorPin)) {
      res.status(401).json({ error: 'PIN Pengawas tidak valid.' });
      return;
    }

    const incoming = req.body?.settings as Partial<PortalSettings> | undefined;
    if (!incoming) {
      res.status(400).json({ error: 'Data pengaturan tidak lengkap.' });
      return;
    }

    const nextPin = String(incoming.proctorPin ?? state.settings.proctorPin).trim();
    if (nextPin.length < 4) {
      res.status(400).json({ error: 'PIN Pengawas minimal 4 karakter.' });
      return;
    }

    state.settings = {
      className: String(incoming.className ?? state.settings.className).trim() || 'Kelas 5D',
      defaultTeacherName:
        String(incoming.defaultTeacherName ?? state.settings.defaultTeacherName).trim() ||
        'Guru Kelas 5D',
      proctorPin: nextPin,
    };

    saveState();
    res.json({ settings: state.settings });
  });

  // Hydrate server runtime state from Firebase Firestore (Proctor PIN or verified Teacher token)
  app.post('/api/exams/hydrate', async (req, res) => {
    const authorized = await isAuthorizedTeacherRequest(req);
    if (!authorized) {
      res.status(401).json({ error: 'PIN Pengawas atau sesi Google Guru tidak valid.' });
      return;
    }

    const incomingSettings = req.body?.settings as Partial<PortalSettings> | undefined;
    if (incomingSettings && typeof incomingSettings.className === 'string') {
      state.settings = {
        className: incomingSettings.className.trim() || state.settings.className,
        defaultTeacherName:
          String(incomingSettings.defaultTeacherName ?? state.settings.defaultTeacherName).trim() ||
          state.settings.defaultTeacherName,
        proctorPin:
          String(incomingSettings.proctorPin ?? state.settings.proctorPin).trim().length >= 4
            ? String(incomingSettings.proctorPin).trim()
            : state.settings.proctorPin,
      };
    }

    const incomingExams = Array.isArray(req.body?.exams) ? (req.body.exams as Partial<ExamItem>[]) : [];
    for (const rawEx of incomingExams) {
      if (!rawEx.id || !rawEx.examTitle) continue;
      const normalized = normalizeExamRecord(rawEx);
      const idx = state.exams.findIndex((e) => e.id === normalized.id);
      if (idx >= 0) {
        // Keep whichever has a newer updatedAt or merge missing fields
        const localTime = Date.parse(state.exams[idx].updatedAt || '') || 0;
        const remoteTime = Date.parse(normalized.updatedAt || '') || 0;
        if (remoteTime >= localTime) {
          state.exams[idx] = normalized;
        }
      } else {
        state.exams.push(normalized);
      }
    }

    const incomingResults = Array.isArray(req.body?.results)
      ? (req.body.results as ExamStudentResult[])
      : [];
    for (const r of incomingResults) {
      if (!r?.id || !r?.examId) continue;
      const idx = state.results.findIndex(
        (existing) =>
          existing.id === r.id ||
          (existing.examId === r.examId &&
            existing.absenNumber.toLowerCase() === r.absenNumber.toLowerCase() &&
            existing.studentName.toLowerCase() === r.studentName.toLowerCase())
      );
      if (idx < 0) {
        state.results.push(r);
      } else if (state.results[idx].source === 'kiosk' && r.source !== 'kiosk') {
        state.results[idx] = r;
      }
    }

    saveState();
    res.json({
      settings: state.settings,
      exams: state.exams,
      results: state.results,
    });
  });

  // Create or update a scheduled exam item
  app.post('/api/exams/save', async (req, res) => {
    const authorized = await isAuthorizedTeacherRequest(req);
    if (!authorized) {
      res.status(401).json({ error: 'PIN Pengawas atau sesi Google tidak valid.' });
      return;
    }

    const incoming = req.body?.exam as Partial<ExamItem> | undefined;
    if (!incoming) {
      res.status(400).json({ error: 'Data ulangan tidak lengkap.' });
      return;
    }

    const examTitle = String(incoming.examTitle ?? '').trim();
    const subject = String(incoming.subject ?? '').trim();
    if (!examTitle) {
      res.status(400).json({ error: 'Judul ulangan tidak boleh kosong.' });
      return;
    }
    if (!subject) {
      res.status(400).json({ error: 'Mata pelajaran tidak boleh kosong.' });
      return;
    }

    let rawUrl = String(incoming.googleFormUrl ?? '').trim();
    let normalized = rawUrl ? normalizeGoogleFormUrl(rawUrl) : null;
    if (normalized?.isShortLink) {
      try {
        rawUrl = await resolveFormsGleUrl(normalized.originalUrl);
        normalized = normalizeGoogleFormUrl(rawUrl);
      } catch {
        // Keep warning from normalizeGoogleFormUrl if short link resolution fails
      }
    }
    if (normalized && !normalized.isValid) {
      res.status(400).json({ error: normalized.warning || 'Link Google Form tidak valid.' });
      return;
    }

    const entryToken = String(incoming.entryToken ?? '').trim().toUpperCase();
    if (!entryToken) {
      res.status(400).json({ error: 'Token masuk ujian tidak boleh kosong.' });
      return;
    }

    const durationMinutes = Math.min(240, Math.max(1, Number(incoming.durationMinutes) || 60));
    const lockSubmitMinutes = Math.min(
      durationMinutes,
      Math.max(0, Number(incoming.lockSubmitMinutes ?? durationMinutes))
    );

    const availabilityMode =
      incoming.availabilityMode === 'manual_open' ||
      incoming.availabilityMode === 'closed' ||
      incoming.availabilityMode === 'scheduled'
        ? incoming.availabilityMode
        : 'scheduled';

    const scheduledStart = String(incoming.scheduledStart ?? '').trim();
    const scheduledEnd = String(incoming.scheduledEnd ?? '').trim();

    if (availabilityMode === 'scheduled' && (!scheduledStart || !scheduledEnd)) {
      res.status(400).json({
        error: 'Untuk mode terjadwal, isi waktu mulai dan waktu selesai ulangan.',
      });
      return;
    }

    if (scheduledStart && scheduledEnd && Date.parse(scheduledEnd) <= Date.parse(scheduledStart)) {
      res.status(400).json({
        error: 'Waktu selesai jadwal harus lebih lambat daripada waktu mulai.',
      });
      return;
    }

    const existingIdx = incoming.id
      ? state.exams.findIndex((ex) => ex.id === incoming.id)
      : -1;
    const prev = existingIdx >= 0 ? state.exams[existingIdx] : null;

    const maxRawScore = Math.max(1, Number(incoming.maxRawScore) || prev?.maxRawScore || 40);
    const questionCount = Math.min(
      100,
      Math.max(1, Number(incoming.questionCount) || prev?.questionCount || 40)
    );
    const kkm = Math.min(100, Math.max(0, Number(incoming.kkm ?? prev?.kkm ?? 75)));

    const savedExam: ExamItem = {
      id: prev ? prev.id : crypto.randomUUID(),
      examTitle,
      subject,
      teacherName:
        String(incoming.teacherName ?? '').trim() || state.settings.defaultTeacherName,
      googleFormUrl: normalized ? normalized.embedUrl : '',
      googleFormId: String(incoming.googleFormId ?? prev?.googleFormId ?? '').trim(),
      entryToken,
      submitToken:
        String(incoming.submitToken ?? '').trim().toUpperCase() || 'KIRIM5D',
      durationMinutes,
      lockSubmitMinutes,
      enableSubmitToken: Boolean(incoming.enableSubmitToken ?? true),
      enableBottomOverlayGuard: Boolean(incoming.enableBottomOverlayGuard ?? false),
      maxViolationsBeforeLock: Math.min(
        10,
        Math.max(1, Number(incoming.maxViolationsBeforeLock) || 3)
      ),
      availabilityMode,
      scheduledStart,
      scheduledEnd,
      maxRawScore,
      questionCount,
      kkm,
      webhookSecret: prev?.webhookSecret || crypto.randomBytes(12).toString('hex'),
      answerKey: Array.isArray(incoming.answerKey)
        ? incoming.answerKey
        : prev?.answerKey || [],
      updatedAt: new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      state.exams[existingIdx] = savedExam;
      // Recalculate existing results if maxRawScore changed
      state.results = state.results.map((r) =>
        r.examId === savedExam.id
          ? { ...r, finalScore: calculateFinalScore(r.rawScore, savedExam.maxRawScore) }
          : r
      );
    } else {
      state.exams.push(savedExam);
    }

    saveState();
    res.json({
      exam: savedExam,
      exams: state.exams,
      results: state.results,
      warning: normalized?.warning,
    });
  });

  // Delete an exam
  app.post('/api/exams/delete', (req, res) => {
    const currentPin = String(req.body?.currentPin ?? '').trim();
    if (!currentPin || !safeEqual(currentPin, state.settings.proctorPin)) {
      res.status(401).json({ error: 'PIN Pengawas tidak valid.' });
      return;
    }
    const examId = String(req.body?.examId ?? '').trim();
    state.exams = state.exams.filter((ex) => ex.id !== examId);
    state.results = state.results.filter((r) => r.examId !== examId);
    saveState();
    res.json({ exams: state.exams, results: state.results });
  });

  // Import batch results (CSV, Google Forms API, or batch update) - Proctor only
  app.post('/api/exams/:examId/results/import', async (req, res) => {
    const authorized = await isAuthorizedTeacherRequest(req);
    if (!authorized) {
      res.status(401).json({ error: 'PIN Pengawas atau sesi Google tidak valid.' });
      return;
    }

    let exam = state.exams.find((ex) => ex.id === req.params.examId);
    if (!exam && req.body?.examSnapshot && typeof req.body.examSnapshot === 'object') {
      const snap = normalizeExamRecord({
        ...(req.body.examSnapshot as Partial<ExamItem>),
        id: req.params.examId,
      });
      if (snap.examTitle) {
        state.exams.push(snap);
        exam = snap;
      }
    }
    if (!exam) {
      res.status(404).json({ error: 'Ulangan tidak ditemukan.' });
      return;
    }

    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    const hasMetaUpdates =
      Array.isArray(req.body?.answerKey) || typeof req.body?.googleFormId === 'string';

    if (rows.length === 0 && !hasMetaUpdates) {
      res.status(400).json({ error: 'Tidak ada data siswa yang diimpor.' });
      return;
    }

    if (Array.isArray(req.body?.answerKey)) {
      exam.answerKey = req.body.answerKey.map((k: unknown) => String(k ?? '').trim());
    }
    if (typeof req.body?.googleFormId === 'string' && req.body.googleFormId.trim()) {
      exam.googleFormId = req.body.googleFormId.trim();
    }

    const importSource =
      req.body?.source === 'google_forms' ? ('google_forms' as const) : ('csv' as const);

    for (const row of rows) {
      const itemScores = Array.isArray(row.itemScores)
        ? row.itemScores.map((v: unknown) => (Number(v) > 0 ? 1 : 0))
        : [];
      const rawScore =
        row.rawScore !== null && row.rawScore !== undefined
          ? Number(row.rawScore)
          : itemScores.reduce((acc: number, v: number) => acc + v, 0);

      upsertStudentResult(exam, {
        studentName: String(row.studentName ?? 'Siswa'),
        absenNumber: String(row.absenNumber ?? '-'),
        rawScore,
        itemScores,
        answers: Array.isArray(row.answers) ? row.answers.map(String) : undefined,
        submittedAt: Number(row.submittedAt) || Date.now(),
        source: importSource,
      });
    }

    saveState();
    res.json({
      results: state.results.filter((r) => r.examId === exam.id),
      exams: state.exams,
    });
  });

  // Add or update single student result manually - Proctor only
  app.post('/api/exams/:examId/results/upsert', (req, res) => {
    const currentPin = String(req.body?.currentPin ?? '').trim();
    if (!currentPin || !safeEqual(currentPin, state.settings.proctorPin)) {
      res.status(401).json({ error: 'PIN Pengawas tidak valid.' });
      return;
    }

    const exam = state.exams.find((ex) => ex.id === req.params.examId);
    if (!exam) {
      res.status(404).json({ error: 'Ulangan tidak ditemukan.' });
      return;
    }

    const studentName = String(req.body?.studentName ?? '').trim();
    const absenNumber = String(req.body?.absenNumber ?? '').trim();
    if (!studentName || !absenNumber) {
      res.status(400).json({ error: 'Nama siswa dan nomor absen wajib diisi.' });
      return;
    }

    const itemScores = Array.isArray(req.body?.itemScores)
      ? req.body.itemScores.map((v: unknown) => (Number(v) > 0 ? 1 : 0))
      : [];
    const rawScore =
      req.body?.rawScore !== undefined && req.body?.rawScore !== null
        ? Number(req.body.rawScore)
        : itemScores.reduce((acc: number, v: number) => acc + v, 0);

    upsertStudentResult(exam, {
      studentName,
      absenNumber,
      rawScore,
      itemScores,
      source: 'manual',
    });

    saveState();
    res.json({ results: state.results.filter((r) => r.examId === exam.id) });
  });

  // Delete single result or clear exam results - Proctor only
  app.post('/api/exams/:examId/results/delete', (req, res) => {
    const currentPin = String(req.body?.currentPin ?? '').trim();
    if (!currentPin || !safeEqual(currentPin, state.settings.proctorPin)) {
      res.status(401).json({ error: 'PIN Pengawas tidak valid.' });
      return;
    }
    const resultId = req.body?.resultId ? String(req.body.resultId) : null;
    if (resultId) {
      state.results = state.results.filter((r) => r.id !== resultId);
    } else {
      state.results = state.results.filter((r) => r.examId !== req.params.examId);
    }
    saveState();
    res.json({ results: state.results.filter((r) => r.examId === req.params.examId) });
  });

  // Real-time Webhook for Google Form Apps Script onFormSubmit (authenticated by per-exam webhookSecret)
  app.post('/api/webhook/form-response/:examId', (req, res) => {
    const exam = state.exams.find((ex) => ex.id === req.params.examId);
    if (!exam) {
      res.status(404).json({ error: 'Ulangan tidak ditemukan.' });
      return;
    }

    const providedSecret = String(
      req.headers['x-webhook-secret'] ?? req.body?.secret ?? ''
    ).trim();
    if (!providedSecret || !safeEqual(providedSecret, exam.webhookSecret)) {
      res.status(401).json({ error: 'Secret webhook tidak valid.' });
      return;
    }

    const studentName = String(req.body?.studentName ?? '').trim();
    const absenNumber = String(req.body?.absenNumber ?? '').trim();
    if (!studentName) {
      res.status(400).json({ error: 'studentName wajib dikirim.' });
      return;
    }

    const itemScores = Array.isArray(req.body?.itemScores)
      ? req.body.itemScores.map((v: unknown) => (Number(v) > 0 ? 1 : 0))
      : [];
    const answers = Array.isArray(req.body?.answers)
      ? req.body.answers.map(String)
      : undefined;

    const rawScore =
      req.body?.rawScore !== undefined && req.body?.rawScore !== null
        ? Number(req.body.rawScore)
        : itemScores.reduce((acc: number, v: number) => acc + v, 0);

    const saved = upsertStudentResult(exam, {
      studentName,
      absenNumber: absenNumber || '-',
      rawScore,
      itemScores,
      answers,
      submittedAt: Date.now(),
      source: 'webhook',
    });

    saveState();
    res.json({ ok: true, id: saved.id });
  });

  // Reset student session history
  app.post('/api/exam/reset-sessions', (req, res) => {
    const pin = String(req.body?.pin ?? '').trim();
    if (!pin || !safeEqual(pin, state.settings.proctorPin)) {
      res.status(401).json({ error: 'PIN Pengawas salah.' });
      return;
    }
    state.sessions = [];
    saveState();
    res.json({ ok: true });
  });

  // Start or resume student exam session
  app.post('/api/sessions/start', (req, res) => {
    const examId = String(req.body?.examId ?? '').trim();
    const studentName = String(req.body?.studentName ?? '').trim();
    const absenNumber = String(req.body?.absenNumber ?? '').trim();
    const token = String(req.body?.token ?? '').trim().toUpperCase();

    const exam = state.exams.find((ex) => ex.id === examId);
    if (!exam) {
      res.status(404).json({ error: 'Pilih jadwal ulangan terlebih dahulu.' });
      return;
    }

    const now = Date.now();
    const status = computeExamStatus(exam, now);

    if (status === 'no_form') {
      res.status(400).json({
        error: 'Link Google Form untuk ulangan ini belum diisi oleh Guru.',
      });
      return;
    }
    if (status === 'closed') {
      res.status(403).json({ error: 'Ulangan ini sedang ditutup oleh Guru Pengawas.' });
      return;
    }
    if (status === 'upcoming') {
      res.status(403).json({
        error: 'Ulangan ini belum memasuki jadwal waktu mulai.',
      });
      return;
    }
    if (status === 'ended') {
      res.status(403).json({
        error: 'Jadwal waktu ulangan ini sudah berakhir.',
      });
      return;
    }

    if (studentName.length < 2) {
      res.status(400).json({ error: 'Masukkan nama lengkap siswa.' });
      return;
    }
    if (!absenNumber) {
      res.status(400).json({ error: 'Masukkan nomor absen siswa.' });
      return;
    }
    if (!token || !safeEqual(token, exam.entryToken.toUpperCase())) {
      res.status(401).json({ error: 'Token Ujian salah. Periksa kembali token dari Guru.' });
      return;
    }

    let session = state.sessions.find(
      (s) =>
        s.examId === exam.id &&
        s.absenNumber.toLowerCase() === absenNumber.toLowerCase() &&
        s.studentName.toLowerCase() === studentName.toLowerCase() &&
        s.status !== 'finished'
    );

    if (!session) {
      const durationMs = exam.durationMinutes * 60 * 1000;
      const lockMs = exam.lockSubmitMinutes * 60 * 1000;
      session = {
        id: crypto.randomUUID(),
        examId: exam.id,
        examTitle: exam.examTitle,
        subject: exam.subject,
        studentName,
        absenNumber,
        startedAt: now,
        endsAt: now + durationMs,
        unlockAt: now + lockMs,
        status: 'active',
        violations: [],
        lastHeartbeat: now,
      };
      state.sessions.push(session);
      saveState();
    } else {
      session.lastHeartbeat = now;
      saveState();
    }

    const submitUnlocked = now >= session.unlockAt;
    res.json({
      session,
      googleFormUrl: exam.googleFormUrl,
      submitUnlocked,
      submitToken: submitUnlocked && exam.enableSubmitToken ? exam.submitToken : null,
      serverTime: now,
      exam: toPublicExam(exam, now),
    });
  });

  // Poll session state
  app.get('/api/sessions/:id', (req, res) => {
    const session = state.sessions.find((s) => s.id === req.params.id);
    if (!session) {
      res.status(404).json({ error: 'Sesi ujian tidak ditemukan.' });
      return;
    }

    const exam = state.exams.find((ex) => ex.id === session.examId);
    const now = Date.now();
    session.lastHeartbeat = now;
    const submitUnlocked = now >= session.unlockAt;

    const fallbackPublicExam: ExamPublicItem = exam
      ? toPublicExam(exam, now)
      : {
          id: session.examId,
          examTitle: session.examTitle,
          subject: session.subject,
          className: state.settings.className,
          teacherName: state.settings.defaultTeacherName,
          durationMinutes: 60,
          lockSubmitMinutes: 60,
          enableSubmitToken: false,
          enableBottomOverlayGuard: false,
          maxViolationsBeforeLock: 3,
          availabilityMode: 'manual_open',
          scheduledStart: '',
          scheduledEnd: '',
          hasFormUrl: true,
          computedStatus: 'open',
          updatedAt: new Date(session.startedAt).toISOString(),
        };

    res.json({
      session,
      googleFormUrl: exam?.googleFormUrl || '',
      submitUnlocked,
      submitToken:
        submitUnlocked && exam?.enableSubmitToken ? exam.submitToken : null,
      serverTime: now,
      exam: fallbackPublicExam,
    });
  });

  // Record lockdown violation
  app.post('/api/sessions/:id/violation', (req, res) => {
    const session = state.sessions.find((s) => s.id === req.params.id);
    if (!session) {
      res.status(404).json({ error: 'Sesi tidak ditemukan.' });
      return;
    }

    if (session.status === 'finished') {
      res.json({ session });
      return;
    }

    const exam = state.exams.find((ex) => ex.id === session.examId);
    const maxViolations = exam?.maxViolationsBeforeLock ?? 3;

    const reason = String(req.body?.reason ?? 'Keluar dari jendela ujian').trim();
    const now = Date.now();
    const last = session.violations[session.violations.length - 1];
    if (!last || now - last.time > 1500) {
      session.violations.push({ time: now, reason });
      const activeStrikes = session.violations.filter((v) => !v.forgiven).length;
      if (activeStrikes >= maxViolations) {
        session.status = 'locked';
      }
      saveState();
    }

    res.json({
      session,
      maxViolations,
    });
  });

  // Proctor unlock locked student session (called from Panel Guru!)
  app.post('/api/sessions/:id/unlock', async (req, res) => {
    const session = state.sessions.find((s) => s.id === req.params.id);
    if (!session) {
      res.status(404).json({ error: 'Sesi tidak ditemukan.' });
      return;
    }

    const authorized = await isAuthorizedTeacherRequest(req);
    if (!authorized) {
      res.status(401).json({ error: 'PIN Pengawas atau sesi Google tidak valid.' });
      return;
    }

    session.violations = session.violations.map((v) => ({ ...v, forgiven: true }));
    session.status = 'active';
    saveState();
    res.json({ session });
  });

  // Finish exam
  app.post('/api/sessions/:id/finish', (req, res) => {
    let session = state.sessions.find((s) => s.id === req.params.id);
    if (!session && req.body?.sessionSnapshot && typeof req.body.sessionSnapshot === 'object') {
      const snap = req.body.sessionSnapshot as Partial<StudentSession>;
      if (snap.examId && snap.studentName) {
        session = {
          id: req.params.id,
          examId: String(snap.examId),
          examTitle: String(snap.examTitle || 'Ulangan'),
          subject: String(snap.subject || 'Mapel'),
          studentName: String(snap.studentName),
          absenNumber: String(snap.absenNumber || '-'),
          startedAt: Number(snap.startedAt) || Date.now(),
          endsAt: Number(snap.endsAt) || Date.now(),
          unlockAt: Number(snap.unlockAt) || Date.now(),
          status: 'active',
          violations: Array.isArray(snap.violations) ? snap.violations : [],
          lastHeartbeat: Date.now(),
        };
        state.sessions.push(session);
      }
    }
    if (!session) {
      res.status(404).json({ error: 'Sesi tidak ditemukan.' });
      return;
    }

    const now = Date.now();
    const proctorPin = String(req.body?.proctorPin ?? '').trim();
    const isProctorOverride = proctorPin && safeEqual(proctorPin, state.settings.proctorPin);

    if (now < session.unlockAt && !isProctorOverride) {
      const remainingSec = Math.ceil((session.unlockAt - now) / 1000);
      const mins = Math.floor(remainingSec / 60);
      const secs = remainingSec % 60;
      res.status(403).json({
        error: `Belum bisa kirim/selesai. Waktu tunggu tersisa ${mins} menit ${secs} detik lagi.`,
      });
      return;
    }

    session.status = 'finished';
    session.finishedAt = now;

    // Immediately register student submission in results if not yet recorded via Google Form webhook
    const exam = state.exams.find((ex) => ex.id === session.examId);
    if (exam) {
      upsertStudentResult(exam, {
        studentName: session.studentName,
        absenNumber: session.absenNumber,
        rawScore: 0,
        itemScores: [],
        submittedAt: now,
        source: 'kiosk',
      });
    }

    saveState();
    res.json({ session });
  });

  // Force unlock submit timer for a student
  app.post('/api/sessions/:id/force-unlock-submit', async (req, res) => {
    const session = state.sessions.find((s) => s.id === req.params.id);
    if (!session) {
      res.status(404).json({ error: 'Sesi tidak ditemukan.' });
      return;
    }
    const authorized = await isAuthorizedTeacherRequest(req);
    if (!authorized) {
      res.status(401).json({ error: 'PIN Pengawas atau sesi Google tidak valid.' });
      return;
    }
    session.unlockAt = Date.now() - 1000;
    saveState();
    res.json({ session });
  });

  return app;
}

async function startServer() {
  const app = createApp();

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Portal Ulangan Kelas 5D running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
