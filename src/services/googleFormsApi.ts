import type { StudentSession } from '../types.ts';

export interface DriveFormFile {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
}

export class GoogleFormApiError extends Error {
  status?: number;
  isAuthError: boolean;

  constructor(message: string, status?: number, isAuthError = false) {
    super(message);
    this.name = 'GoogleFormApiError';
    this.status = status;
    this.isAuthError = isAuthError;
  }
}

interface GoogleFormCorrectAnswer {
  value?: string;
}

interface GoogleFormQuestion {
  questionId?: string;
  grading?: {
    pointValue?: number;
    correctAnswers?: {
      answers?: GoogleFormCorrectAnswer[];
    };
  };
}

interface GoogleFormItem {
  itemId?: string;
  title?: string;
  questionItem?: {
    question?: GoogleFormQuestion;
  };
  questionGroupItem?: {
    questions?: Array<GoogleFormQuestion & { rowQuestion?: { title?: string } }>;
  };
}

interface GoogleFormBody {
  formId?: string;
  info?: {
    title?: string;
  };
  responderUri?: string;
  items?: GoogleFormItem[];
}

interface GoogleFormAnswer {
  questionId?: string;
  grade?: {
    score?: number;
    correct?: boolean;
  };
  textAnswers?: {
    answers?: Array<{ value?: string }>;
  };
}

interface GoogleFormResponseItem {
  responseId?: string;
  createTime?: string;
  lastSubmittedTime?: string;
  respondentEmail?: string;
  totalScore?: number;
  answers?: Record<string, GoogleFormAnswer>;
}

export interface ExtractedFormQuestion {
  questionId: string;
  title: string;
  pointValue: number;
  correctValues: string[];
  isGraded: boolean;
}

export interface GradedFormRow {
  studentName: string;
  absenNumber: string;
  rawScore: number;
  itemScores: number[];
  answers: string[];
  submittedAt: number;
}

export interface GoogleFormSyncOutput {
  formId: string;
  formTitle: string;
  responderUri: string;
  questionCountDetected: number;
  keyedQuestionCount: number;
  answerKey: string[];
  totalPossiblePoints: number;
  rows: GradedFormRow[];
}

export function extractDirectFormIdFromUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  // Edit/direct URL: https://docs.google.com/forms/d/<FORM_ID>/edit (NOT /d/e/<PUBLISHED_ID>/)
  const directMatch = trimmed.match(/docs\.google\.com\/forms\/d\/(?!e\/)([a-zA-Z0-9_-]{10,})/);
  if (directMatch) return directMatch[1];
  return null;
}

export function extractPublishedFormIdFromUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  const pubMatch = trimmed.match(/docs\.google\.com\/forms\/d\/e\/([a-zA-Z0-9_-]{10,})/);
  return pubMatch ? pubMatch[1] : null;
}

async function resolveShortFormUrlIfNeeded(rawUrl: string): Promise<string> {
  const trimmed = rawUrl.trim();
  if (!trimmed) return trimmed;
  let parsed: URL;
  try {
    parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return trimmed;
  }
  if (parsed.hostname.toLowerCase() !== 'forms.gle') {
    return trimmed;
  }
  try {
    const res = await fetch('/api/forms/resolve-short-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: parsed.toString() }),
    });
    if (!res.ok) return trimmed;
    const data = (await res.json()) as { resolvedUrl?: string };
    return data.resolvedUrl || trimmed;
  } catch {
    return trimmed;
  }
}

async function googleApiFetch<T>(url: string, accessToken: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const data = (await res.json().catch(() => ({}))) as T & {
    error?: { message?: string; status?: string; code?: number };
  };
  if (!res.ok) {
    const rawMsg = data?.error?.message || `Google API error (${res.status})`;
    if (res.status === 401) {
      throw new GoogleFormApiError(
        'Sesi akses Google Forms habis. Silakan klik tombol Hubungkan Google Form kembali.',
        401,
        true
      );
    }
    if (res.status === 403) {
      const lower = rawMsg.toLowerCase();
      if (lower.includes('insufficient') || lower.includes('scope') || lower.includes('permission')) {
        throw new GoogleFormApiError(
          `Izin akses Google Forms/Drive belum lengkap (${rawMsg}). Klik ulang Hubungkan Google Form dan centang semua kotak izin Google Forms & Drive.`,
          403,
          true
        );
      }
      if (lower.includes('has not been used') || lower.includes('is disabled')) {
        throw new GoogleFormApiError(
          `Layanan Google Forms/Drive API belum aktif pada proyek (${rawMsg}).`,
          403,
          false
        );
      }
      throw new GoogleFormApiError(
        `Akses ditolak oleh Google (${rawMsg}). Pastikan akun Google Anda memiliki akses sebagai pemilik/editor Google Form tersebut.`,
        403,
        false
      );
    }
    throw new GoogleFormApiError(rawMsg, res.status, false);
  }
  return data;
}

export async function listTeacherFormsFromDrive(accessToken: string): Promise<DriveFormFile[]> {
  const q = encodeURIComponent("mimeType='application/vnd.google-apps.form' and trashed=false");
  const fields = encodeURIComponent('files(id,name,modifiedTime,webViewLink)');
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=modifiedTime desc&pageSize=100&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=${fields}`;
  const data = await googleApiFetch<{ files?: DriveFormFile[] }>(url, accessToken);
  return data.files || [];
}

export async function fetchGoogleFormBody(
  accessToken: string,
  formId: string
): Promise<GoogleFormBody> {
  const safeId = encodeURIComponent(formId.trim());
  return googleApiFetch<GoogleFormBody>(
    `https://forms.googleapis.com/v1/forms/${safeId}`,
    accessToken
  );
}

export async function resolveGoogleFormId(
  accessToken: string,
  googleFormUrl: string,
  knownFormId?: string
): Promise<{ formId: string; formBody: GoogleFormBody }> {
  const expandedUrl = await resolveShortFormUrlIfNeeded(googleFormUrl);
  const directId = extractDirectFormIdFromUrl(expandedUrl);
  const publishedId = extractPublishedFormIdFromUrl(expandedUrl);

  if (knownFormId && knownFormId.trim()) {
    try {
      const body = await fetchGoogleFormBody(accessToken, knownFormId.trim());
      const matchesUrl =
        (!directId && !publishedId) ||
        knownFormId.trim() === directId ||
        (publishedId && (body.responderUri || '').includes(publishedId));
      if (matchesUrl) {
        return { formId: knownFormId.trim(), formBody: body };
      }
    } catch (err) {
      if (err instanceof GoogleFormApiError && err.isAuthError) {
        throw err;
      }
      // Fall through to URL/Drive lookup if stale knownFormId returned 404
    }
  }

  if (directId) {
    const body = await fetchGoogleFormBody(accessToken, directId);
    return { formId: directId, formBody: body };
  }

  const forms = await listTeacherFormsFromDrive(accessToken);
  if (forms.length === 0) {
    throw new GoogleFormApiError(
      'Tidak ditemukan file Google Form di Google Drive akun ini. Pastikan Anda login dengan akun Google pembuat/editor Form tersebut.'
    );
  }

  // Check up to 60 recent forms to match responderUri against the pasted /d/e/<publishedId>/viewform link
  const candidates = forms.slice(0, 60);
  for (let i = 0; i < candidates.length; i += 8) {
    const chunk = candidates.slice(i, i + 8);
    const results = await Promise.allSettled(
      chunk.map(async (f) => {
        const body = await fetchGoogleFormBody(accessToken, f.id);
        return { formId: f.id, body };
      })
    );
    for (const r of results) {
      if (r.status === 'fulfilled') {
        const respUri = r.value.body.responderUri || '';
        if (publishedId && respUri.includes(publishedId)) {
          return { formId: r.value.formId, formBody: r.value.body };
        }
      } else if (r.reason instanceof GoogleFormApiError && r.reason.isAuthError) {
        throw r.reason;
      }
    }
  }

  throw new GoogleFormApiError(
    'Form tidak ditemukan otomatis dari link tersebut di Google Drive akun ini. Silakan pilih langsung Google Form Anda lewat tombol "Pilih dari Google Drive" di tab Jadwal Ulangan.'
  );
}

function normalizeAnswerText(val: string): string {
  return val.trim().toLowerCase().replace(/\s+/g, ' ');
}

function stripOptionPrefix(val: string): string {
  return val.replace(/^[a-e]\s*[.):\-]\s*/i, '').trim();
}

function matchesAnswerKey(studentValues: string[], keyValues: string[]): boolean {
  if (keyValues.length === 0 || studentValues.length === 0) return false;

  const normKeys = keyValues.map(normalizeAnswerText).filter(Boolean);
  const normStudent = studentValues.map(normalizeAnswerText).filter(Boolean);
  if (normKeys.length === 0 || normStudent.length === 0) return false;

  // Multi-answer checkbox exact set match
  if (normKeys.length > 1) {
    if (normKeys.length !== normStudent.length) return false;
    return normKeys.every((k) => normStudent.includes(k));
  }

  const key = normKeys[0];
  const ans = normStudent[0];
  if (ans === key) return true;

  // Handle single-letter keys ("A") against full option text ("A. Jakarta", "A) Jakarta", "A - Jakarta")
  if (
    key.length === 1 &&
    /^[a-e]$/.test(key) &&
    (ans.startsWith(`${key}.`) ||
      ans.startsWith(`${key})`) ||
      ans.startsWith(`${key} -`) ||
      ans.startsWith(`${key}:`) ||
      ans.startsWith(`${key} `))
  ) {
    return true;
  }

  // Handle full option key ("A. Jakarta") vs stripped answer or vice versa
  const strippedKey = stripOptionPrefix(key);
  const strippedAns = stripOptionPrefix(ans);
  if (strippedKey && strippedAns && strippedKey === strippedAns) {
    return true;
  }

  // Numeric equivalence (e.g. "40" vs "40.0")
  const numKey = Number(key.replace(',', '.'));
  const numAns = Number(ans.replace(',', '.'));
  if (!Number.isNaN(numKey) && !Number.isNaN(numAns) && key !== '' && ans !== '' && numKey === numAns) {
    return true;
  }

  return false;
}

const IDENTITY_OR_META_PATTERNS = [
  'token',
  'kelas',
  'class',
  'tanggal',
  'date',
  'sekolah',
  'school',
  'email',
  'nisn',
  'nis',
  'identitas',
  'petunjuk',
];

export async function fetchAndGradeGoogleFormResponses(params: {
  accessToken: string;
  googleFormUrl: string;
  knownFormId?: string;
  questionCountLimit: number;
  sessions: StudentSession[];
  fallbackAnswerKey?: string[];
}): Promise<GoogleFormSyncOutput> {
  const {
    accessToken,
    googleFormUrl,
    knownFormId,
    questionCountLimit,
    sessions,
    fallbackAnswerKey = [],
  } = params;

  const { formId, formBody } = await resolveGoogleFormId(accessToken, googleFormUrl, knownFormId);

  // Fetch all responses (paginated)
  const allResponses: GoogleFormResponseItem[] = [];
  let pageToken: string | undefined;
  do {
    const safeId = encodeURIComponent(formId);
    const url = `https://forms.googleapis.com/v1/forms/${safeId}/responses${
      pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : ''
    }`;
    const page = await googleApiFetch<{
      responses?: GoogleFormResponseItem[];
      nextPageToken?: string;
    }>(url, accessToken);
    if (Array.isArray(page.responses)) {
      allResponses.push(...page.responses);
    }
    pageToken = page.nextPageToken;
  } while (pageToken);

  // Classify items into identity fields vs quiz questions
  let nameQuestionId: string | null = null;
  let absenQuestionId: string | null = null;
  const quizQuestions: ExtractedFormQuestion[] = [];

  for (const item of formBody.items || []) {
    const rawTitle = (item.title || '').trim();
    const lowerTitle = rawTitle.toLowerCase();

    const pushQuestion = (q: GoogleFormQuestion, qTitle: string) => {
      if (!q.questionId) return;
      const correctValues =
        q.grading?.correctAnswers?.answers
          ?.map((a) => String(a.value ?? '').trim())
          .filter(Boolean) || [];
      const pointValue = Number(q.grading?.pointValue ?? 0);
      const isGraded = correctValues.length > 0 || pointValue > 0;

      if (
        !nameQuestionId &&
        !isGraded &&
        (lowerTitle.includes('nama') || lowerTitle.includes('name'))
      ) {
        nameQuestionId = q.questionId;
        return;
      }
      if (
        !absenQuestionId &&
        !isGraded &&
        (lowerTitle.includes('absen') ||
          lowerTitle.includes('no.') ||
          lowerTitle === 'no' ||
          lowerTitle.startsWith('no ') ||
          lowerTitle.includes('nomor') ||
          lowerTitle.includes('urut'))
      ) {
        absenQuestionId = q.questionId;
        return;
      }
      if (!isGraded && IDENTITY_OR_META_PATTERNS.some((kw) => lowerTitle.includes(kw))) {
        return;
      }

      quizQuestions.push({
        questionId: q.questionId,
        title: qTitle,
        pointValue,
        correctValues,
        isGraded,
      });
    };

    if (item.questionItem?.question) {
      pushQuestion(item.questionItem.question, rawTitle);
    } else if (item.questionGroupItem?.questions) {
      for (const subQ of item.questionGroupItem.questions) {
        const subTitle = subQ.rowQuestion?.title
          ? `${rawTitle} (${subQ.rowQuestion.title})`
          : rawTitle;
        pushQuestion(subQ, subTitle);
      }
    }
  }

  const gradedOnly = quizQuestions.filter((q) => q.isGraded);
  // If the Form has exact graded question count matching configured questionCountLimit,
  // exclude ungraded stray fields so question numbering stays 1-to-1 aligned.
  const baseQuestions =
    gradedOnly.length > 0 && gradedOnly.length === questionCountLimit
      ? gradedOnly
      : quizQuestions;

  const effectiveQuestions = baseQuestions.slice(0, Math.max(1, questionCountLimit));
  if (effectiveQuestions.length === 0) {
    throw new GoogleFormApiError(
      'Tidak ditemukan butir pertanyaan soal pada Google Form ini. Pastikan formulir sudah berisi soal.'
    );
  }

  const answerKey = effectiveQuestions.map((q, idx) => {
    if (q.correctValues.length > 0) return q.correctValues.join(' / ');
    return fallbackAnswerKey[idx] || '';
  });
  const keyedQuestionCount = answerKey.filter((k) => k.trim() !== '').length;
  const totalPossiblePoints = effectiveQuestions.reduce(
    (sum, q) => sum + (q.pointValue > 0 ? q.pointValue : 1),
    0
  );

  const rows: GradedFormRow[] = allResponses.map((resp, idx) => {
    const ansMap = resp.answers || {};

    const rawName = nameQuestionId
      ? ansMap[nameQuestionId]?.textAnswers?.answers?.[0]?.value?.trim() || ''
      : '';
    const rawAbsen = absenQuestionId
      ? ansMap[absenQuestionId]?.textAnswers?.answers?.[0]?.value?.trim() || ''
      : '';

    const studentName = rawName || resp.respondentEmail || `Siswa ${idx + 1}`;

    // If Form didn't ask Absen, try matching studentName against active/finished Kiosk sessions
    let absenNumber = rawAbsen;
    if (!absenNumber && rawName) {
      const lowerName = rawName.toLowerCase();
      const matchedSession = sessions.find((s) => {
        const sLower = s.studentName.trim().toLowerCase();
        return (
          sLower === lowerName ||
          (lowerName.length >= 3 && sLower.length >= 3 && (sLower.includes(lowerName) || lowerName.includes(sLower)))
        );
      });
      if (matchedSession) {
        absenNumber = matchedSession.absenNumber;
      }
    }
    if (!absenNumber) absenNumber = '-';

    const studentAnswers: string[] = [];
    const itemScores: number[] = [];
    let computedRawScore = 0;

    effectiveQuestions.forEach((q, qIdx) => {
      const ans = ansMap[q.questionId];
      const studentVals =
        ans?.textAnswers?.answers?.map((a) => String(a.value ?? '').trim()).filter(Boolean) || [];
      studentAnswers.push(studentVals.join(', '));

      const keyList =
        q.correctValues.length > 0
          ? q.correctValues
          : fallbackAnswerKey[qIdx]
            ? [fallbackAnswerKey[qIdx]]
            : [];

      if (ans?.grade && typeof ans.grade.correct === 'boolean') {
        const ok = ans.grade.correct ? 1 : 0;
        itemScores.push(ok);
        const sc =
          typeof ans.grade.score === 'number' && (ans.grade.score > 0 || !ans.grade.correct)
            ? Number(ans.grade.score)
            : ok * (q.pointValue > 0 ? q.pointValue : 1);
        computedRawScore += sc;
      } else if (
        q.pointValue > 0 &&
        ans?.grade &&
        typeof ans.grade.score === 'number' &&
        ans.grade.score > 0
      ) {
        const sc = Number(ans.grade.score);
        itemScores.push(1);
        computedRawScore += sc;
      } else if (keyList.length > 0) {
        const ok = matchesAnswerKey(studentVals, keyList) ? 1 : 0;
        itemScores.push(ok);
        computedRawScore += ok * (q.pointValue > 0 ? q.pointValue : 1);
      } else if (ans?.grade && typeof ans.grade.score === 'number') {
        const sc = Number(ans.grade.score);
        itemScores.push(sc > 0 ? 1 : 0);
        computedRawScore += sc;
      } else {
        itemScores.push(0);
      }
    });

    const finalRawScore =
      typeof resp.totalScore === 'number' && resp.totalScore >= computedRawScore
        ? resp.totalScore
        : computedRawScore;

    const timeStr = resp.lastSubmittedTime || resp.createTime || '';
    const submittedAt =
      timeStr && !Number.isNaN(Date.parse(timeStr)) ? Date.parse(timeStr) : Date.now();

    return {
      studentName,
      absenNumber,
      rawScore: finalRawScore,
      itemScores,
      answers: studentAnswers,
      submittedAt,
    };
  });

  return {
    formId,
    formTitle: formBody.info?.title || 'Google Form',
    responderUri: formBody.responderUri || googleFormUrl,
    questionCountDetected: effectiveQuestions.length,
    keyedQuestionCount,
    answerKey,
    totalPossiblePoints,
    rows,
  };
}
