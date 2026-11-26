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

export async function deleteExamFromFirestore(ownerUid: string, examId: string): Promise<void> {
  const safeExamId = sanitizeId(examId, 'exam');
  const examPath = `exams/${safeExamId}`;
  try {
    const resultsCol = collection(db, 'exams', safeExamId, 'results');
    const resultsSnap = await getDocs(query(resultsCol, where('ownerUid', '==', ownerUid)));
    if (!resultsSnap.empty) {
      const batch = writeBatch(db);
      resultsSnap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
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

export async function clearExamResultsFromFirestore(
  ownerUid: string,
  examId: string
): Promise<void> {
  const safeExamId = sanitizeId(examId, 'exam');
  const path = `exams/${safeExamId}/results`;
  try {
    const snap = await getDocs(
      query(collection(db, 'exams', safeExamId, 'results'), where('ownerUid', '==', ownerUid))
    );
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
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
