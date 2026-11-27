export type ExamAvailabilityMode = 'scheduled' | 'manual_open' | 'closed';

export type ExamComputedStatus = 'open' | 'upcoming' | 'ended' | 'closed' | 'no_form';

export interface PortalSettings {
  className: string;
  defaultTeacherName: string;
  proctorPin: string;
}

export interface ExamItem {
  id: string;
  examTitle: string;
  subject: string;
  teacherName: string;
  googleFormUrl: string;
  googleFormId?: string;
  googleSheetUrl?: string;
  entryToken: string;
  submitToken: string;
  durationMinutes: number;
  lockSubmitMinutes: number;
  enableSubmitToken: boolean;
  enableBottomOverlayGuard: boolean;
  maxViolationsBeforeLock: number;
  availabilityMode: ExamAvailabilityMode;
  scheduledStart: string;
  scheduledEnd: string;
  // Grading & Item Analysis config (Proctor only)
  maxRawScore: number; // default 40: (rawScore / 40) * 100
  questionCount: number; // default 40
  kkm: number; // default 75
  webhookSecret: string;
  answerKey: string[];
  updatedAt: string;
}

export interface ExamPublicItem {
  id: string;
  examTitle: string;
  subject: string;
  className: string;
  teacherName: string;
  durationMinutes: number;
  lockSubmitMinutes: number;
  enableSubmitToken: boolean;
  enableBottomOverlayGuard: boolean;
  maxViolationsBeforeLock: number;
  availabilityMode: ExamAvailabilityMode;
  scheduledStart: string;
  scheduledEnd: string;
  hasFormUrl: boolean;
  computedStatus: ExamComputedStatus;
  updatedAt: string;
}

export interface PortalPublicPayload {
  settings: {
    className: string;
    defaultTeacherName: string;
  };
  exams: ExamPublicItem[];
  serverTime: number;
}

export interface ViolationEvent {
  time: number;
  reason: string;
  forgiven?: boolean;
}

export type SessionStatus = 'active' | 'locked' | 'finished';

export interface StudentSession {
  id: string;
  examId: string;
  examTitle: string;
  subject: string;
  studentName: string;
  absenNumber: string;
  startedAt: number;
  endsAt: number;
  unlockAt: number;
  status: SessionStatus;
  violations: ViolationEvent[];
  lastHeartbeat: number;
  finishedAt?: number;
}

export interface ExamStudentResult {
  id: string;
  examId: string;
  studentName: string;
  absenNumber: string;
  rawScore: number;
  finalScore: number;
  itemScores: number[]; // 1 = benar, 0 = salah per question
  answers?: string[];
  submittedAt: number;
  source: 'webhook' | 'csv' | 'manual' | 'kiosk' | 'google_forms';
}

export interface ActiveExamPayload {
  session: StudentSession;
  googleFormUrl: string;
  submitUnlocked: boolean;
  submitToken: string | null;
  serverTime: number;
  exam: ExamPublicItem;
  sessionToken?: string;
}

export type PortalTab = 'gate' | 'monitor' | 'guide';
