/**
 * Security Rules Verification Suite (Dirty Dozen Adversarial Payloads)
 * Reference specification matching security_spec.md and firestore.rules.
 */

export const DIRTY_DOZEN_EXPECTATIONS = [
  { id: 1, name: 'Unauthenticated Score Read', path: '/exams/exam-1/results/res-1', expected: 'PERMISSION_DENIED' },
  { id: 2, name: 'Unverified Email Spoof', path: '/exams/exam-1', expected: 'PERMISSION_DENIED' },
  { id: 3, name: 'Cross-Teacher Read of Results', path: '/exams/exam-1/results/res-1', expected: 'PERMISSION_DENIED' },
  { id: 4, name: 'Privilege Escalation Self-Admin', path: '/admins/attacker-uid', expected: 'PERMISSION_DENIED' },
  { id: 5, name: 'Shadow Field Injection', path: '/exams/exam-1', expected: 'PERMISSION_DENIED' },
  { id: 6, name: 'Owner UID Spoofing', path: '/exams/exam-1', expected: 'PERMISSION_DENIED' },
  { id: 7, name: 'Orphaned Result Write', path: '/exams/missing-exam/results/res-1', expected: 'PERMISSION_DENIED' },
  { id: 8, name: 'ID Poisoning', path: '/exams/bad$id', expected: 'PERMISSION_DENIED' },
  { id: 9, name: 'Array Exhaustion (>100 itemScores)', path: '/exams/exam-1/results/res-1', expected: 'PERMISSION_DENIED' },
  { id: 10, name: 'Client Timestamp Forgery', path: '/exams/exam-1', expected: 'PERMISSION_DENIED' },
  { id: 11, name: 'Immutable Field Tampering', path: '/exams/exam-1', expected: 'PERMISSION_DENIED' },
  { id: 12, name: 'Blanket List Scraping', path: '/portalConfig', expected: 'PERMISSION_DENIED' },
] as const;
