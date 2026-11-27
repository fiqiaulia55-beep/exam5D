import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase.ts';
import type { ExamItem, ExamStudentResult, PortalSettings, StudentSession } from '../types.ts';

const VALID_ID_REGEX = /^[a-zA-Z0-9_-]+$/;

function sanitizeId(raw: string, fallbackPrefix: string): string {
  const cleaned = raw.trim().replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  if (cleaned && VALID_ID_REGEX.test(cleaned)) return cleaned;
  return `${fallbackPrefix}-${Date.now()}`;
}

function clampStr(val: unknown, maxLen: number, fallback = ''): string {
  const s = String(val ?? fallback).trim();
  if (!s && fallback) return fallback.slice(0, maxLen);
  return s.slice(0, maxLen);
}

function clampNum(val: unknown, min: number, max: number, fallback: number): number {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export const PRIMARY_TEACHER_EMAIL = 'fiqi.aulia55@guru.sd.belajar.id';

export function getPortalConfigDocId(ownerUid: string, email?: string | null): string {
  if (email && email.trim().toLowerCase() === PRIMARY_TEACHER_EMAIL) {
    return 'default';
  }
  return sanitizeId(ownerUid, 'owner');
}

export async function savePortalConfigToFirestore(
  ownerUid: string,
  settings: PortalSettings,
  email?: string | null
): Promise<void> {
  const configId = getPortalConfigDocId(ownerUid, email);
  const path = `portalConfig/${configId}`;
  const ref = doc(db, 'portalConfig', configId);
  try {
    const existingSnap = await getDoc(ref);
    const editableFields = {
      className: clampStr(settings.className, 80, 'Kelas 5D'),
      defaultTeacherName: clampStr(settings.defaultTeacherName, 120, 'Guru Kelas 5D'),
      proctorPin: clampStr(settings.proctorPin, 32, '5555').length >= 4
        ? clampStr(settings.proctorPin, 32, '5555')
        : '5555',
      updatedAt: serverTimestamp(),
    };

    if (!existingSnap.exists()) {
      await setDoc(ref, {
        ...editableFields,
        ownerUid: sanitizeId(ownerUid, 'owner'),
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, editableFields);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

function isPermissionDeniedError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const code = (err as { code?: unknown }).code;
  return (
    code === 'permission-denied' ||
    err.message.toLowerCase().includes('missing or insufficient permissions')
  );
}

export async function saveExamToFirestore(
  ownerUid: string,
  exam: ExamItem,
  isPrimaryTeacher = false,
  options?: { skipIfForeignOwned?: boolean }
): Promise<boolean> {
  const examId = sanitizeId(exam.id, 'exam');
  const safeOwnerUid = sanitizeId(ownerUid, 'owner');
  const path = `exams/${examId}`;
  const ref = doc(db, 'exams', examId);

  try {
    let existingSnap;
    try {
      existingSnap = await getDoc(ref);
    } catch (readErr) {
      if (options?.skipIfForeignOwned && isPermissionDeniedError(readErr)) {
        return false;
      }
      throw readErr;
    }

    if (existingSnap.exists()) {
      const existingOwner = String(existingSnap.data()?.ownerUid || '');
      if (existingOwner && existingOwner !== safeOwnerUid && !isPrimaryTeacher) {
        return false;
      }
    }

    const answerKey = Array.isArray(exam.answerKey)
      ? exam.answerKey.slice(0, 100).map((k) => clampStr(k, 200))
      : [];

    const editableFields = {
      examTitle: clampStr(exam.examTitle, 160, 'Ulangan'),
      subject: clampStr(exam.subject, 100, 'Mata Pelajaran'),
      teacherName: clampStr(exam.teacherName, 120, 'Guru Kelas 5D'),
      googleFormUrl: clampStr(exam.googleFormUrl, 1000, ''),
      googleFormId: clampStr(exam.googleFormId, 128, ''),
      googleSheetUrl: clampStr(exam.googleSheetUrl, 1000, ''),
      entryToken: clampStr(exam.entryToken, 40, 'TOKEN5D'),
      submitToken: clampStr(exam.submitToken, 40, 'KIRIM5D'),
      durationMinutes: clampNum(exam.durationMinutes, 1, 240, 60),
      lockSubmitMinutes: clampNum(exam.lockSubmitMinutes, 0, 240, 60),
      enableSubmitToken: Boolean(exam.enableSubmitToken),
      enableBottomOverlayGuard: Boolean(exam.enableBottomOverlayGuard),
      maxViolationsBeforeLock: clampNum(exam.maxViolationsBeforeLock, 1, 10, 3),
      availabilityMode:
        exam.availabilityMode === 'manual_open' || exam.availabilityMode === 'closed'
          ? exam.availabilityMode
          : 'scheduled',
      scheduledStart: clampStr(exam.scheduledStart, 64, ''),
      scheduledEnd: clampStr(exam.scheduledEnd, 64, ''),
      maxRawScore: clampNum(exam.maxRawScore, 1, 500, 40),
      questionCount: clampNum(exam.questionCount, 1, 100, 40),
      kkm: clampNum(exam.kkm, 0, 100, 75),
      webhookSecret: clampStr(exam.webhookSecret, 128, `sec-${examId}`),
      answerKey,
      updatedAt: serverTimestamp(),
    };

    if (!existingSnap.exists()) {
      await setDoc(ref, {
        id: examId,
        ownerUid: safeOwnerUid,
        ...editableFields,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, editableFields);
    }
    return true;
  } catch (error) {
    if (options?.skipIfForeignOwned && isPermissionDeniedError(error)) {
      return false;
    }
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteExamFromFirestore(
  ownerUid: string,
  examId: string,
  isPrimaryTeacher = false
): Promise<void> {
  const safeExamId = sanitizeId(examId, 'exam');
  const examPath = `exams/${safeExamId}`;
  try {
    const resultsCol = collection(db, 'exams', safeExamId, 'results');
    const resultsQuery = isPrimaryTeacher
      ? resultsCol
      : query(resultsCol, where('ownerUid', '==', ownerUid));
    const resultsSnap = await getDocs(resultsQuery);
    if (!resultsSnap.empty) {
      for (let i = 0; i < resultsSnap.docs.length; i += 350) {
        const batch = writeBatch(db);
        resultsSnap.docs.slice(i, i + 350).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    }
    await deleteDoc(doc(db, 'exams', safeExamId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, examPath);
  }
}

export async function upsertExamResultToFirestore(
  ownerUid: string,
  result: ExamStudentResult,
  isPrimaryTeacher = false,
  options?: { skipIfForeignOwned?: boolean }
): Promise<boolean> {
  const examId = sanitizeId(result.examId, 'exam');
  const resultId = sanitizeId(result.id, 'res');
  const safeOwnerUid = sanitizeId(ownerUid, 'owner');
  const path = `exams/${examId}/results/${resultId}`;
  const ref = doc(db, 'exams', examId, 'results', resultId);

  try {
    let existingSnap;
    try {
      existingSnap = await getDoc(ref);
    } catch (readErr) {
      if (options?.skipIfForeignOwned && isPermissionDeniedError(readErr)) {
        return false;
      }
      throw readErr;
    }
    if (existingSnap.exists()) {
      const existingOwner = String(existingSnap.data()?.ownerUid || '');
      if (existingOwner && existingOwner !== safeOwnerUid && !isPrimaryTeacher) {
        return false;
      }
    }

    const itemScores = Array.isArray(result.itemScores)
      ? result.itemScores.slice(0, 100).map((v) => (Number(v) > 0 ? 1 : 0))
      : [];

    const editableFields: Record<string, unknown> = {
      studentName: clampStr(result.studentName, 120, 'Siswa'),
      absenNumber: clampStr(result.absenNumber, 24, '-'),
      rawScore: clampNum(result.rawScore, 0, 500, 0),
      finalScore: clampNum(result.finalScore, 0, 1000, 0),
      itemScores,
      submittedAt: clampNum(result.submittedAt, 0, 9999999999999, Date.now()),
      source:
        result.source === 'webhook' ||
        result.source === 'csv' ||
        result.source === 'manual' ||
        result.source === 'kiosk' ||
        result.source === 'google_forms'
          ? result.source
          : 'manual',
      updatedAt: serverTimestamp(),
    };

    if (Array.isArray(result.answers)) {
      editableFields.answers = result.answers.slice(0, 100).map((a) => clampStr(a, 500));
    }

    if (!existingSnap.exists()) {
      await setDoc(ref, {
        id: resultId,
        examId,
        ownerUid: safeOwnerUid,
        ...editableFields,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, editableFields);
    }
    return true;
  } catch (error) {
    if (options?.skipIfForeignOwned && isPermissionDeniedError(error)) {
      return false;
    }
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteExamResultFromFirestore(
  examId: string,
  resultId: string
): Promise<void> {
  const safeExamId = sanitizeId(examId, 'exam');
  const safeResultId = sanitizeId(resultId, 'res');
  const path = `exams/${safeExamId}/results/${safeResultId}`;
  try {
    await deleteDoc(doc(db, 'exams', safeExamId, 'results', safeResultId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function syncExamResultsBatchToFirestore(
  ownerUid: string,
  resultsList: ExamStudentResult[],
  isPrimaryTeacher = false,
  options?: { skipIfForeignOwned?: boolean }
): Promise<number> {
  if (resultsList.length === 0) return 0;
  const safeOwnerUid = sanitizeId(ownerUid, 'owner');
  const byExam = new Map<string, ExamStudentResult[]>();
  for (const r of resultsList) {
    const examId = sanitizeId(r.examId, 'exam');
    const list = byExam.get(examId) || [];
    list.push(r);
    byExam.set(examId, list);
  }

  let writtenCount = 0;
  for (const [examId, list] of byExam.entries()) {
    const resultsPath = `exams/${examId}/results`;
    try {
      const resultsCol = collection(db, 'exams', examId, 'results');
      const existingQuery = isPrimaryTeacher
        ? resultsCol
        : query(resultsCol, where('ownerUid', '==', safeOwnerUid));
      let existingSnap;
      try {
        existingSnap = await getDocs(existingQuery);
      } catch (readErr) {
        if (options?.skipIfForeignOwned && isPermissionDeniedError(readErr)) {
          continue;
        }
        throw readErr;
      }

      const existingMap = new Map<string, string>();
      existingSnap.docs.forEach((d) => {
        existingMap.set(d.id, String(d.data()?.ownerUid || ''));
      });

      for (let i = 0; i < list.length; i += 350) {
        const chunk = list.slice(i, i + 350);
        const batch = writeBatch(db);
        let opsInBatch = 0;

        for (const result of chunk) {
          const resultId = sanitizeId(result.id, 'res');
          const existingOwner = existingMap.get(resultId);
          if (existingOwner && existingOwner !== safeOwnerUid && !isPrimaryTeacher) {
            continue;
          }

          const itemScores = Array.isArray(result.itemScores)
            ? result.itemScores.slice(0, 100).map((v) => (Number(v) > 0 ? 1 : 0))
            : [];

          const editableFields: Record<string, unknown> = {
            studentName: clampStr(result.studentName, 120, 'Siswa'),
            absenNumber: clampStr(result.absenNumber, 24, '-'),
            rawScore: clampNum(result.rawScore, 0, 500, 0),
            finalScore: clampNum(result.finalScore, 0, 1000, 0),
            itemScores,
            submittedAt: clampNum(result.submittedAt, 0, 9999999999999, Date.now()),
            source:
              result.source === 'webhook' ||
              result.source === 'csv' ||
              result.source === 'manual' ||
              result.source === 'kiosk' ||
              result.source === 'google_forms'
                ? result.source
                : 'manual',
            updatedAt: serverTimestamp(),
          };

          if (Array.isArray(result.answers)) {
            editableFields.answers = result.answers.slice(0, 100).map((a) => clampStr(a, 500));
          }

          const ref = doc(db, 'exams', examId, 'results', resultId);
          if (!existingMap.has(resultId)) {
            batch.set(ref, {
              id: resultId,
              examId,
              ownerUid: safeOwnerUid,
              ...editableFields,
              createdAt: serverTimestamp(),
            });
          } else {
            batch.update(ref, editableFields);
          }
          opsInBatch++;
          writtenCount++;
        }

        if (opsInBatch > 0) {
          await batch.commit();
        }
      }
    } catch (error) {
      if (options?.skipIfForeignOwned && isPermissionDeniedError(error)) {
        continue;
      }
      handleFirestoreError(error, OperationType.WRITE, resultsPath);
    }
  }
  return writtenCount;
}

export async function clearExamResultsFromFirestore(
  ownerUid: string,
  examId: string,
  isPrimaryTeacher = false
): Promise<void> {
  const safeExamId = sanitizeId(examId, 'exam');
  const path = `exams/${safeExamId}/results`;
  try {
    const col = collection(db, 'exams', safeExamId, 'results');
    const q = isPrimaryTeacher ? col : query(col, where('ownerUid', '==', ownerUid));
    const snap = await getDocs(q);
    if (snap.empty) return;
    for (let i = 0; i < snap.docs.length; i += 350) {
      const batch = writeBatch(db);
      snap.docs.slice(i, i + 350).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function upsertSessionToFirestore(
  ownerUid: string,
  session: StudentSession,
  isPrimaryTeacher = false,
  options?: { skipIfForeignOwned?: boolean }
): Promise<boolean> {
  const sessionId = sanitizeId(session.id, 'sess');
  const examId = sanitizeId(session.examId, 'exam');
  const safeOwnerUid = sanitizeId(ownerUid, 'owner');
  const path = `sessions/${sessionId}`;
  const ref = doc(db, 'sessions', sessionId);

  try {
    let existingSnap;
    try {
      existingSnap = await getDoc(ref);
    } catch (readErr) {
      if (options?.skipIfForeignOwned && isPermissionDeniedError(readErr)) {
        return false;
      }
      throw readErr;
    }
    if (existingSnap.exists()) {
      const existingOwner = String(existingSnap.data()?.ownerUid || '');
      if (existingOwner && existingOwner !== safeOwnerUid && !isPrimaryTeacher) {
        return false;
      }
    }

    const editableFields = {
      status:
        session.status === 'locked' || session.status === 'finished' ? session.status : 'active',
      violationCount: clampNum(session.violations.length, 0, 1000, 0),
      endsAt: clampNum(session.endsAt, 0, 9999999999999, Date.now()),
      unlockAt: clampNum(session.unlockAt, 0, 9999999999999, Date.now()),
      finishedAt: clampNum(session.finishedAt ?? 0, 0, 9999999999999, 0),
      updatedAt: serverTimestamp(),
    };

    if (!existingSnap.exists()) {
      await setDoc(ref, {
        id: sessionId,
        examId,
        ownerUid: safeOwnerUid,
        examTitle: clampStr(session.examTitle, 160, 'Ulangan'),
        subject: clampStr(session.subject, 100, 'Mapel'),
        studentName: clampStr(session.studentName, 120, 'Siswa'),
        absenNumber: clampStr(session.absenNumber, 24, '-'),
        startedAt: clampNum(session.startedAt, 0, 9999999999999, Date.now()),
        ...editableFields,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, editableFields);
    }
    return true;
  } catch (error) {
    if (options?.skipIfForeignOwned && isPermissionDeniedError(error)) {
      return false;
    }
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export interface FullFirestoreSnapshot {
  settings?: PortalSettings;
  exams: ExamItem[];
  results: ExamStudentResult[];
  sessions: StudentSession[];
}

export async function pullAllFirestoreData(
  ownerUid: string,
  email?: string | null,
  isPrimaryTeacher = false
): Promise<FullFirestoreSnapshot> {
  const safeUid = sanitizeId(ownerUid, 'owner');
  const configId = getPortalConfigDocId(safeUid, email);

  let settings: PortalSettings | undefined;
  try {
    const cfgSnap = await getDoc(doc(db, 'portalConfig', configId));
    if (cfgSnap.exists()) {
      const d = cfgSnap.data();
      settings = {
        className: String(d.className || 'Kelas 5D'),
        defaultTeacherName: String(d.defaultTeacherName || 'Guru Kelas 5D'),
        proctorPin: String(d.proctorPin || '5555'),
      };
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `portalConfig/${configId}`);
  }

  let exams: ExamItem[] = [];
  try {
    const examsQuery = isPrimaryTeacher
      ? collection(db, 'exams')
      : query(collection(db, 'exams'), where('ownerUid', '==', safeUid));
    const examsSnap = await getDocs(examsQuery);
    exams = examsSnap.docs.map((docSnap) => {
      const d = docSnap.data();
      return {
        id: docSnap.id,
        examTitle: String(d.examTitle || ''),
        subject: String(d.subject || ''),
        teacherName: String(d.teacherName || 'Guru Kelas 5D'),
        googleFormUrl: String(d.googleFormUrl || ''),
        googleFormId: String(d.googleFormId || ''),
        googleSheetUrl: String(d.googleSheetUrl || ''),
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
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'exams');
  }

  const allResults: ExamStudentResult[] = [];
  await Promise.all(
    exams.map(async (ex) => {
      const resultsPath = `exams/${ex.id}/results`;
      try {
        const col = collection(db, 'exams', ex.id, 'results');
        const q = isPrimaryTeacher ? col : query(col, where('ownerUid', '==', safeUid));
        const snap = await getDocs(q);
        snap.docs.forEach((docSnap) => {
          const d = docSnap.data();
          allResults.push({
            id: docSnap.id,
            examId: ex.id,
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
          });
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, resultsPath);
      }
    })
  );

  let sessions: StudentSession[] = [];
  try {
    const sessQuery = isPrimaryTeacher
      ? collection(db, 'sessions')
      : query(collection(db, 'sessions'), where('ownerUid', '==', safeUid));
    const sessSnap = await getDocs(sessQuery);
    sessions = sessSnap.docs.map((docSnap) => {
      const d = docSnap.data();
      const vCount = Math.max(0, Number(d.violationCount) || 0);
      const startedAt = Number(d.startedAt) || Date.now();
      return {
        id: docSnap.id,
        examId: String(d.examId || ''),
        examTitle: String(d.examTitle || ''),
        subject: String(d.subject || ''),
        studentName: String(d.studentName || ''),
        absenNumber: String(d.absenNumber || '-'),
        startedAt,
        endsAt: Number(d.endsAt) || startedAt,
        unlockAt: Number(d.unlockAt) || startedAt,
        status: d.status === 'locked' || d.status === 'finished' ? d.status : 'active',
        violations: Array.from({ length: vCount }, (_, idx) => ({
          time: startedAt + idx * 1000,
          reason: 'Pelanggaran fokus',
          forgiven: d.status === 'active',
        })),
        lastHeartbeat: Number(d.finishedAt) || startedAt,
        finishedAt: Number(d.finishedAt) || undefined,
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'sessions');
  }

  return {
    settings,
    exams,
    results: allResults,
    sessions,
  };
}

