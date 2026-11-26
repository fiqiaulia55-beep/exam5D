# Security Specification — Portal Ulangan Kelas 5D

## 1. Data Invariants
1. **Strict Teacher-Only Firestore Access (Zero Student Score Leaks)**: Student scores, item-level correctness arrays (`itemScores`), proctor PINs, and webhook secrets must NEVER be readable by unauthenticated requests or unverified accounts.
2. **Verified Google Account Requirement (All Domains Supported)**: Every Firestore read and write requires `request.auth != null` AND `request.auth.token.email_verified == true` (supporting both `@belajar.id` and personal/school Google accounts such as `@gmail.com`).
3. **Owner & Primary Admin Isolation**: Every verified teacher owns and isolates their own `/portalConfig/{configId}`, `/exams/{examId}`, `/exams/{examId}/results/{resultId}`, and `/sessions/{sessionId}` via `ownerUid == request.auth.uid` (while `fiqi.aulia55@guru.sd.belajar.id` retains primary admin oversight). `ownerUid` must match `request.auth.uid` on create and remain immutable across updates.
4. **Master Gate Relational Sync**: `/exams/{examId}/results/{resultId}` cannot be created unless the parent `/exams/{examId}` document exists and belongs to the authenticated owner/admin, and `incoming().examId == examId`.
5. **Strict Schema & Bounds**: All strings enforce `.size()` bounds, all IDs match `^[a-zA-Z0-9_\-]+$` with max 128 chars, arrays (`itemScores`, `answers`, `answerKey`) are bounded `<= 100`, and `keys().hasAll(...)` + `keys().hasOnly(...)` block shadow fields.
6. **Temporal Integrity**: `createdAt` is immutable and must equal `request.time` on creation; `updatedAt` must equal `request.time` on both create and update.
7. **Terminal State Locking**: Once an `ExamSession` reaches `status == 'finished'`, status cannot be reverted except by the owner/admin.
8. **Query Enforcement**: Every `allow list` validates `resource.data.ownerUid == request.auth.uid` or verified primary admin email directly without calling `get()` or `exists()`.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Score Read**: Unauthenticated `getDoc` or `getDocs` on `/exams/exam1/results/res1`.
2. **Unverified Email Admin Spoof**: Auth token with `email: "fiqi.aulia55@guru.sd.belajar.id"` and `email_verified: false` attempting `setDoc` on `/exams/exam1`.
3. **Cross-Teacher Read of Results**: Verified teacher B (`teacherB@gmail.com`) attempting `getDoc` on teacher A's `/exams/exam1/results/res1`.
4. **Privilege Escalation Self-Admin**: Verified user attempting `setDoc` on `/admins/{theirUid}` to grant themselves global primary admin privileges.
5. **Shadow / Ghost Field Injection**: Verified teacher attempting to create `/exams/exam1` with an extra unlisted key `isBypassed: true`.
6. **Owner UID Spoofing**: User attempting to create `/exams/exam1` with `ownerUid: "another_uid"`.
7. **Orphaned Result Write**: Teacher attempting to create `/exams/nonexistent_exam/results/res1` when parent `/exams/nonexistent_exam` does not exist.
8. **ID Poisoning**: Attempting to create `/exams/bad$id!!with..invalidchars` violating `^[a-zA-Z0-9_\-]+$`.
9. **Resource Exhaustion Array (>100 items)**: Attempting to create `/exams/exam1/results/res1` with `itemScores` containing 101 elements or a non-integer element `"hacked"`.
10. **Client Timestamp Forgery**: Attempting to create `/exams/exam1` with `createdAt: new Date('2020-01-01')` instead of `serverTimestamp()`.
11. **Immutable `createdAt` / `ownerUid` Tampering**: Attempting `updateDoc` on `/exams/exam1` changing `ownerUid` or `createdAt`.
12. **Blanket List Query Scraping**: Unauthenticated or non-owner user running `getDocs(collection(db, 'exams'))` or `getDocs(collection(db, 'portalConfig'))`.
