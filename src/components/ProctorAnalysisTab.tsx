import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  FileDown,
  Upload,
  Copy,
  Check,
  Plus,
  Trash2,
  Code2,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  Pencil,
  RefreshCw,
  KeyRound,
} from 'lucide-react';
import type { ExamItem, ExamStudentResult, StudentSession } from '../types.ts';
import {
  calculateFinalScore,
  computeClassStats,
  computeItemAnalysis,
} from '../utils/itemAnalysis.ts';
import { parseGoogleFormCsv } from '../utils/csvParser.ts';
import { exportExamAnalysisDocx } from '../utils/exportWord.ts';
import { auth, clearWorkspaceAccessToken } from '../firebase.ts';
import {
  clearExamResultsFromFirestore,
  deleteExamResultFromFirestore,
  saveExamToFirestore,
  upsertExamResultToFirestore,
} from '../services/firebaseSync.ts';
import {
  fetchAndGradeGoogleFormResponses,
  GoogleFormApiError,
} from '../services/googleFormsApi.ts';

interface ProctorAnalysisTabProps {
  exams: ExamItem[];
  results: ExamStudentResult[];
  sessions: StudentSession[];
  className: string;
  authenticatedPin: string;
  firebaseUserUid: string | null;
  isPrimaryTeacher?: boolean;
  workspaceToken: string | null;
  onConnectGoogle: () => Promise<string | null>;
  onWorkspaceAuthInvalidated?: () => void;
  onExamUpdated: (exam: ExamItem) => void;
  onResultsUpdated: (examId: string, nextResults: ExamStudentResult[]) => void;
}

export function ProctorAnalysisTab({
  exams,
  results,
  sessions,
  className,
  authenticatedPin,
  firebaseUserUid,
  isPrimaryTeacher = false,
  workspaceToken,
  onConnectGoogle,
  onWorkspaceAuthInvalidated,
  onExamUpdated,
  onResultsUpdated,
}: ProctorAnalysisTabProps) {
  const [selectedExamId, setSelectedExamId] = useState<string>(exams[0]?.id || '');

  useEffect(() => {
    if (exams.length === 0) {
      if (selectedExamId) setSelectedExamId('');
      return;
    }
    if (!exams.some((e) => e.id === selectedExamId)) {
      setSelectedExamId(exams[0].id);
    }
  }, [exams, selectedExamId]);

  const selectedExam = exams.find((e) => e.id === selectedExamId) || exams[0] || null;

  const [showWebhookScript, setShowWebhookScript] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  // Google Forms API direct sync state
  const [syncingGoogleForm, setSyncingGoogleForm] = useState(false);
  const [showDetectedKey, setShowDetectedKey] = useState(false);

  // CSV Import & Answer Key state
  const [answerKeyText, setAnswerKeyText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );

  // Manual quick entry / edit
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualAbsen, setManualAbsen] = useState('');
  const [manualRawScore, setManualRawScore] = useState('');
  const [manualItemChecks, setManualItemChecks] = useState<number[]>([]);
  const [exportingDocx, setExportingDocx] = useState(false);

  const lastAutoSyncSignatureRef = useRef<string>('');

  const examResults = useMemo(() => {
    if (!selectedExam) return [];
    return results
      .filter((r) => r.examId === selectedExam.id)
      .slice()
      .sort(
        (a, b) =>
          Number(a.absenNumber) - Number(b.absenNumber) ||
          a.studentName.localeCompare(b.studentName)
      );
  }, [results, selectedExam]);

  const scoredResults = useMemo(
    () => examResults.filter((r) => r.source !== 'kiosk' || r.rawScore > 0 || r.itemScores.length > 0),
    [examResults]
  );

  const violationCounts = useMemo(() => {
    const map: Record<string, number> = {};
    if (!selectedExam) return map;
    for (const s of sessions) {
      if (s.examId === selectedExam.id) {
        const key = `${s.absenNumber}::${s.studentName.toLowerCase()}`;
        map[key] = s.violations.length;
      }
    }
    return map;
  }, [sessions, selectedExam]);

  const stats = useMemo(
    () => computeClassStats(scoredResults, selectedExam?.kkm ?? 75),
    [scoredResults, selectedExam]
  );

  const itemAnalysis = useMemo(
    () => computeItemAnalysis(scoredResults, selectedExam?.questionCount ?? 40),
    [scoredResults, selectedExam]
  );

  const handleSyncFromGoogleForm = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!selectedExam) return;
      if (!selectedExam.googleFormUrl && !selectedExam.googleFormId) {
        if (!options?.silent) {
          setImportMessage({
            type: 'err',
            text: 'Link Google Form untuk ulangan ini belum diisi di Jadwal Ulangan.',
          });
        }
        return;
      }

      let token = workspaceToken;
      if (!token) {
        if (options?.silent) return;
        token = await onConnectGoogle();
        if (!token) return;
      }

      setSyncingGoogleForm(true);
      if (!options?.silent) setImportMessage(null);

      try {
        const manualFallbackKey = answerKeyText
          .split(/[\s,;]+/)
          .map((k) => k.trim())
          .filter(Boolean);

        const graded = await fetchAndGradeGoogleFormResponses({
          accessToken: token,
          googleFormUrl: selectedExam.googleFormUrl,
          knownFormId: selectedExam.googleFormId,
          questionCountLimit: selectedExam.questionCount || 40,
          sessions,
          fallbackAnswerKey:
            manualFallbackKey.length > 0 ? manualFallbackKey : selectedExam.answerKey,
        });

        const idToken = await auth.currentUser?.getIdToken().catch(() => '');
        const res = await fetch(`/api/exams/${selectedExam.id}/results/import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            currentPin: authenticatedPin,
            idToken: idToken || undefined,
            examSnapshot: selectedExam,
            rows: graded.rows,
            answerKey: graded.answerKey,
            googleFormId: graded.formId,
            source: 'google_forms',
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Gagal menyimpan hasil sinkronisasi Google Form.');
        }

        const nextList = (data.results || []) as ExamStudentResult[];
        const updatedExamFromServer = (data.exams as ExamItem[] | undefined)?.find(
          (ex) => ex.id === selectedExam.id
        );
        const nextExam: ExamItem = updatedExamFromServer || {
          ...selectedExam,
          googleFormId: graded.formId,
          answerKey: graded.answerKey,
        };

        if (firebaseUserUid) {
          await saveExamToFirestore(firebaseUserUid, nextExam, isPrimaryTeacher);
          await Promise.all(
            nextList.map((item) => upsertExamResultToFirestore(firebaseUserUid, item, isPrimaryTeacher))
          );
        }

        onExamUpdated(nextExam);
        onResultsUpdated(selectedExam.id, nextList);

        const maxRaw = selectedExam.maxRawScore || 40;
        if (!options?.silent || graded.rows.length > 0) {
          setImportMessage({
            type: 'ok',
            text:
              graded.rows.length > 0
                ? `Sinkronisasi Google Form "${graded.formTitle}" berhasil: ${graded.rows.length} siswa dinilai otomatis (${graded.keyedQuestionCount} kunci jawaban terbaca). Nilai akhir dihitung dengan rumus (Skor ÷ ${maxRaw}) × 100${firebaseUserUid ? ' dan tersimpan ke Firebase' : ''}.`
                : `Kunci jawaban terbaca dari Google Form "${graded.formTitle}" (${graded.keyedQuestionCount} dari ${graded.questionCountDetected} soal memiliki kunci). Belum ada siswa yang menekan Kirim di Google Form.`,
          });
        }
      } catch (err) {
        if (err instanceof GoogleFormApiError && err.isAuthError) {
          clearWorkspaceAccessToken();
          onWorkspaceAuthInvalidated?.();
        }
        if (!options?.silent) {
          setImportMessage({
            type: 'err',
            text:
              err instanceof Error
                ? err.message
                : 'Gagal mengambil kunci jawaban dan respon dari Google Form.',
          });
        }
      } finally {
        setSyncingGoogleForm(false);
      }
    },
    [
      selectedExam,
      workspaceToken,
      onConnectGoogle,
      onWorkspaceAuthInvalidated,
      answerKeyText,
      sessions,
      authenticatedPin,
      firebaseUserUid,
      isPrimaryTeacher,
      onExamUpdated,
      onResultsUpdated,
    ]
  );

  // Auto-sync from Google Form when teacher has Workspace access and either opens exam or a student finishes via kiosk
  const kioskPendingCount = examResults.filter((r) => r.source === 'kiosk').length;
  useEffect(() => {
    if (!selectedExam || !workspaceToken) return;
    if (!selectedExam.googleFormUrl && !selectedExam.googleFormId) return;
    const sig = `${selectedExam.id}::${kioskPendingCount}`;
    if (lastAutoSyncSignatureRef.current === sig) return;
    lastAutoSyncSignatureRef.current = sig;
    void handleSyncFromGoogleForm({ silent: true });
  }, [selectedExam, workspaceToken, kioskPendingCount, handleSyncFromGoogleForm]);

  if (!selectedExam) {
    return (
      <div className="rounded-xl border border-slate-200 py-12 text-center text-sm text-slate-500">
        Buat jadwal ulangan terlebih dahulu di tab Jadwal Ulangan untuk melihat nilai dan analisis
        butir soal.
      </div>
    );
  }

  const maxRawScore = selectedExam.maxRawScore || 40;
  const questionCount = selectedExam.questionCount || 40;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const webhookUrl = `${origin}/api/webhook/form-response/${selectedExam.id}`;
  const activeKeyCount = (selectedExam.answerKey || []).filter((k) => k.trim() !== '').length;

  const appsScriptSnippet = `function onFormSubmit(e) {
  var itemResponses = e.response.getItemResponses();
  var studentName = "";
  var absenNumber = "";
  var itemScores = [];
  var answers = [];
  var totalScore = 0;

  // Cek apakah form mode Kuis memiliki method getScore()
  var gradable = (typeof e.response.getGradableItemResponses === "function")
    ? e.response.getGradableItemResponses()
    : [];

  var scoreMap = {};
  for (var g = 0; g < gradable.length; g++) {
    var gr = gradable[g];
    var itemId = String(gr.getItem().getId());
    var sc = Number(gr.getScore() || 0);
    scoreMap[itemId] = sc;
  }

  for (var i = 0; i < itemResponses.length; i++) {
    var ir = itemResponses[i];
    var qId = String(ir.getItem().getId());
    var qTitle = ir.getItem().getTitle();
    var lower = qTitle.toLowerCase();
    var ans = String(ir.getResponse() || "");

    if (lower.indexOf("nama") !== -1 && !studentName && !(qId in scoreMap)) {
      studentName = ans;
    } else if ((lower.indexOf("absen") !== -1 || lower.indexOf("no.") !== -1) && !absenNumber && !(qId in scoreMap)) {
      absenNumber = ans;
    } else if (lower.indexOf("token") === -1 && lower.indexOf("kelas") === -1) {
      answers.push(ans);
      var itemSc = Number(scoreMap[qId] || 0);
      itemScores.push(itemSc > 0 ? 1 : 0);
      totalScore += itemSc;
    }
  }

  var payload = {
    secret: "${selectedExam.webhookSecret}",
    studentName: studentName || "Siswa",
    absenNumber: absenNumber || "-",
    rawScore: totalScore,
    itemScores: itemScores,
    answers: answers
  };

  UrlFetchApp.fetch("${webhookUrl}", {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
}`;

  const handleCopyScript = () => {
    navigator.clipboard.writeText(appsScriptSnippet).catch(() => {});
    setCopiedScript(true);
    window.setTimeout(() => setCopiedScript(false), 2000);
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportMessage(null);
    try {
      const text = await file.text();
      const parsedKey = answerKeyText
        .split(/[\s,;]+/)
        .map((k) => k.trim())
        .filter(Boolean);
      const effectiveKey = parsedKey.length > 0 ? parsedKey : selectedExam.answerKey || [];

      const parsed = parseGoogleFormCsv(text, questionCount, effectiveKey);
      if (parsed.rows.length === 0) {
        throw new Error('File CSV kosong atau format kolom tidak terbaca.');
      }

      const idToken = await auth.currentUser?.getIdToken().catch(() => '');
      const res = await fetch(`/api/exams/${selectedExam.id}/results/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPin: authenticatedPin,
          idToken: idToken || undefined,
          examSnapshot: selectedExam,
          rows: parsed.rows,
          answerKey: effectiveKey.length > 0 ? effectiveKey : undefined,
          source: 'csv',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengimpor CSV.');
      }

      const nextList = (data.results || []) as ExamStudentResult[];
      if (firebaseUserUid) {
        if (effectiveKey.length > 0) {
          await saveExamToFirestore(firebaseUserUid, { ...selectedExam, answerKey: effectiveKey });
        }
        await Promise.all(nextList.map((item) => upsertExamResultToFirestore(firebaseUserUid, item)));
      }

      onResultsUpdated(selectedExam.id, nextList);
      setImportMessage({
        type: 'ok',
        text: `Berhasil mengimpor ${parsed.rows.length} data siswa (${parsed.detectedQuestions} kolom soal terdeteksi)${firebaseUserUid ? ' dan tersimpan ke Firebase' : ''}.`,
      });
    } catch (err) {
      setImportMessage({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal membaca file CSV.',
      });
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const handleOpenManualForm = () => {
    setManualItemChecks(Array.from({ length: questionCount }, () => 1));
    setManualRawScore(String(questionCount));
    setManualName('');
    setManualAbsen('');
    setShowManualForm(true);
  };

  const handleEditExistingResult = (result: ExamStudentResult) => {
    const checks = Array.from({ length: questionCount }, (_, idx) =>
      idx < result.itemScores.length ? (result.itemScores[idx] > 0 ? 1 : 0) : 0
    );
    setManualItemChecks(checks);
    setManualRawScore(String(result.rawScore));
    setManualName(result.studentName);
    setManualAbsen(result.absenNumber);
    setShowManualForm(true);
  };

  const toggleManualItem = (index: number) => {
    setManualItemChecks((prev) => {
      const next = prev.slice();
      next[index] = next[index] > 0 ? 0 : 1;
      const sum = next.reduce((acc, v) => acc + v, 0);
      setManualRawScore(String(sum));
      return next;
    });
  };

  const handleSaveManualResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim() || !manualAbsen.trim()) return;
    setImportMessage(null);
    try {
      const idToken = await auth.currentUser?.getIdToken().catch(() => '');
      const res = await fetch(`/api/exams/${selectedExam.id}/results/upsert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPin: authenticatedPin,
          idToken: idToken || undefined,
          studentName: manualName.trim(),
          absenNumber: manualAbsen.trim(),
          rawScore: Number(manualRawScore) || 0,
          itemScores: manualItemChecks,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menyimpan nilai siswa.');
      }

      const nextList = (data.results || []) as ExamStudentResult[];
      if (firebaseUserUid) {
        const savedItem = nextList.find(
          (r) =>
            r.absenNumber.toLowerCase() === manualAbsen.trim().toLowerCase() &&
            r.studentName.toLowerCase() === manualName.trim().toLowerCase()
        );
        if (savedItem) {
          await upsertExamResultToFirestore(firebaseUserUid, savedItem);
        }
      }

      onResultsUpdated(selectedExam.id, nextList);
      setShowManualForm(false);
      setImportMessage({
        type: 'ok',
        text: `Nilai untuk ${manualName.trim()} berhasil disimpan${firebaseUserUid ? ' ke Firebase' : ''}.`,
      });
    } catch (err) {
      setImportMessage({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal menyimpan nilai.',
      });
    }
  };

  const handleDeleteResult = async (resultId?: string) => {
    const idToken = await auth.currentUser?.getIdToken().catch(() => '');
    const res = await fetch(`/api/exams/${selectedExam.id}/results/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPin: authenticatedPin,
        idToken: idToken || undefined,
        resultId: resultId || null,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      if (firebaseUserUid) {
        if (resultId) {
          await deleteExamResultFromFirestore(selectedExam.id, resultId);
        } else {
          await clearExamResultsFromFirestore(firebaseUserUid, selectedExam.id);
        }
      }
      onResultsUpdated(selectedExam.id, data.results || []);
    }
  };

  const handleDownloadWord = async () => {
    setExportingDocx(true);
    try {
      await exportExamAnalysisDocx({
        exam: selectedExam,
        className,
        results: examResults,
        violationCounts,
      });
    } finally {
      setExportingDocx(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Exam Selector + Word Export */}
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1">
          <label htmlFor="analysisExamSelect" className="block text-xs font-semibold text-slate-600">
            Pilih Ulangan yang Dianalisis
          </label>
          <select
            id="analysisExamSelect"
            value={selectedExam.id}
            onChange={(e) => {
              setSelectedExamId(e.target.value);
              setImportMessage(null);
            }}
            className="mt-1 w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 focus:border-sky-600 focus:outline-none"
          >
            {exams.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.subject} — {ex.examTitle}
              </option>
            ))}
          </select>
          <p className="mt-1.5 font-mono text-xs text-slate-600">
            Rumus Nilai Akhir: (Skor Diperoleh ÷ {maxRawScore}) × 100 · {questionCount} Butir · KKM{' '}
            {selectedExam.kkm}
          </p>
        </div>

        <button
          type="button"
          disabled={exportingDocx || examResults.length === 0}
          onClick={handleDownloadWord}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 whitespace-nowrap"
        >
          <FileDown className="h-4 w-4" />
          {exportingDocx ? 'Menyusun Word...' : 'Download Word (.docx)'}
        </button>
      </div>

      {/* Data Source Actions: Direct Google Forms Sync, Apps Script, CSV, Manual */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-bold text-slate-900">
          Sumber Data Kunci Jawaban &amp; Skor Google Form (Khusus Panel Guru)
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">
          Sistem membaca kunci jawaban langsung dari Google Form Anda, menghitung skor setiap butir
          soal, lalu menghitung Nilai Akhir dengan rumus{' '}
          <code className="font-mono font-semibold text-slate-800">
            (Skor ÷ {maxRawScore}) × 100
          </code>
          .
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={syncingGoogleForm}
            onClick={() => handleSyncFromGoogleForm({ silent: false })}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${syncingGoogleForm ? 'animate-spin' : ''}`} />
            {syncingGoogleForm
              ? 'Membaca Kunci & Nilai Form...'
              : workspaceToken
                ? 'Ambil Nilai & Kunci dari Google Form'
                : 'Hubungkan Google Form & Hitung Nilai'}
          </button>

          <button
            type="button"
            onClick={() => setShowWebhookScript((v) => !v)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Code2 className="h-4 w-4" />
            {showWebhookScript ? 'Tutup Skrip Apps Script' : 'Skrip Otomatis Apps Script'}
          </button>

          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            <Upload className="h-4 w-4" />
            <span>{importing ? 'Mengimpor...' : 'Import CSV Google Form'}</span>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleCsvUpload}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={handleOpenManualForm}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Plus className="h-4 w-4" />
            Input / Koreksi Manual
          </button>
        </div>

        {/* Detected Answer Key from Google Form */}
        {activeKeyCount > 0 && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-xs text-emerald-950">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-semibold">
                <KeyRound className="h-4 w-4 text-emerald-700" />
                <span>
                  Kunci Jawaban Terbaca dari Google Form: {activeKeyCount} butir soal aktif
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowDetectedKey((v) => !v)}
                className="font-semibold text-emerald-800 hover:underline"
              >
                {showDetectedKey ? 'Sembunyikan Kunci' : 'Lihat Daftar Kunci'}
              </button>
            </div>
            {showDetectedKey && (
              <div className="mt-2.5 flex flex-wrap gap-2 border-t border-emerald-200 pt-2.5 font-mono text-[11px]">
                {(selectedExam.answerKey || []).map((k, idx) => (
                  <span key={idx} className="text-emerald-900">
                    {idx + 1}. {k || '—'}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Optional Answer Key override/fallback */}
        <div className="mt-4">
          <label htmlFor="answerKeyInput" className="block text-xs font-medium text-slate-700">
            Kunci Jawaban Tambahan Opsional (hanya jika ada soal tanpa kunci di Google Form / CSV
            non-kuis)
          </label>
          <input
            id="answerKeyInput"
            type="text"
            placeholder="Kosongkan jika kunci jawaban sudah disetel di Google Form (Mode Kuis)"
            value={answerKeyText}
            onChange={(e) => setAnswerKeyText(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs text-slate-800 placeholder:font-sans placeholder:text-slate-400 focus:border-sky-600 focus:outline-none"
          />
        </div>

        {showWebhookScript && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-900 p-4 text-slate-100">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-sky-300">
                Tempel skrip ini di Google Form &rarr; Titik Tiga &rarr; Editor Skrip (Apps Script),
                lalu buat Pemicu &ldquo;Saat mengirim formulir&rdquo;
              </span>
              <button
                type="button"
                onClick={handleCopyScript}
                className="inline-flex items-center gap-1.5 rounded-md bg-slate-800 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-700"
              >
                {copiedScript ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    Skrip Disalin
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Salin Skrip
                  </>
                )}
              </button>
            </div>
            <pre className="mt-3 max-h-48 overflow-auto rounded bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-slate-300">
              {appsScriptSnippet}
            </pre>
          </div>
        )}

        {importMessage && (
          <div
            className={`mt-4 flex items-start gap-2 rounded-lg border px-3.5 py-2.5 text-xs font-medium ${
              importMessage.type === 'ok'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-red-200 bg-red-50 text-red-900'
            }`}
          >
            {importMessage.type === 'ok' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span>{importMessage.text}</span>
          </div>
        )}

        {showManualForm && (
          <form
            onSubmit={handleSaveManualResult}
            className="mt-4 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Nama Siswa</label>
                <input
                  type="text"
                  required
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Nomor Absen</label>
                <input
                  type="text"
                  required
                  value={manualAbsen}
                  onChange={(e) => setManualAbsen(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Skor Diperoleh (/{maxRawScore})
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={maxRawScore}
                    step="0.5"
                    value={manualRawScore}
                    onChange={(e) => setManualRawScore(e.target.value)}
                    className="w-24 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-mono text-sm"
                  />
                  <span className="font-mono text-xs font-semibold text-sky-700 tabular-nums">
                    = {calculateFinalScore(Number(manualRawScore) || 0, maxRawScore)}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-700">
                Checklist Butir Soal Benar (Klik nomor untuk ubah Benar/Salah)
              </span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {manualItemChecks.map((val, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleManualItem(idx)}
                    className={`h-7 w-8 rounded border font-mono text-xs font-semibold transition-colors ${
                      val > 0
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-slate-300 bg-white text-slate-500'
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowManualForm(false)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
              >
                Batal
              </button>
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white"
              >
                Simpan Nilai Siswa
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Class Summary KPIs */}
      <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-5">
        <div>
          <span className="text-xs text-slate-500">Peserta Dinilai</span>
          <p className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums">
            {stats.totalStudents}
          </p>
        </div>
        <div>
          <span className="text-xs text-slate-500">Rata-Rata</span>
          <p className="mt-1 font-mono text-xl font-bold text-sky-700 tabular-nums">
            {stats.averageScore}
          </p>
        </div>
        <div>
          <span className="text-xs text-slate-500">Tertinggi</span>
          <p className="mt-1 font-mono text-xl font-bold text-emerald-700 tabular-nums">
            {stats.highestScore}
          </p>
        </div>
        <div>
          <span className="text-xs text-slate-500">Terendah</span>
          <p className="mt-1 font-mono text-xl font-bold text-amber-700 tabular-nums">
            {stats.lowestScore}
          </p>
        </div>
        <div>
          <span className="text-xs text-slate-500">Ketuntasan</span>
          <p className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums">
            {stats.passRatePercent}%
          </p>
        </div>
      </div>

      {/* Student Scores Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <h4 className="text-sm font-bold text-slate-900">
            Daftar Nilai Akhir Siswa ({examResults.length})
          </h4>
          {examResults.length > 0 && (
            <button
              type="button"
              onClick={() => handleDeleteResult()}
              className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Kosongkan Nilai
            </button>
          )}
        </div>

        {examResults.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Belum ada nilai masuk untuk ulangan ini. Klik &ldquo;Ambil Nilai &amp; Kunci dari
            Google Form&rdquo; atau tunggu siswa menekan Kirim &amp; Selesai.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-3">Absen</th>
                  <th className="px-4 py-3">Nama Siswa</th>
                  <th className="px-4 py-3 text-center">Benar</th>
                  <th className="px-4 py-3 text-center">Skor (/{maxRawScore})</th>
                  <th className="px-4 py-3 text-center">Nilai Akhir</th>
                  <th className="px-4 py-3">Ketuntasan</th>
                  <th className="px-4 py-3">Sumber</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {examResults.map((r) => {
                  const awaitingScore =
                    r.source === 'kiosk' && r.rawScore === 0 && r.itemScores.length === 0;
                  const passed = r.finalScore >= selectedExam.kkm;
                  const correctItems = r.itemScores.filter((v) => v > 0).length;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-mono font-semibold text-slate-900 tabular-nums">
                        {r.absenNumber}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">{r.studentName}</td>
                      <td className="px-4 py-3 text-center font-mono text-slate-600 tabular-nums">
                        {awaitingScore || r.itemScores.length === 0
                          ? '—'
                          : `${correctItems}/${r.itemScores.length}`}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-slate-700 tabular-nums">
                        {awaitingScore ? '—' : r.rawScore}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-sm font-bold text-slate-900 tabular-nums">
                        {awaitingScore ? '—' : r.finalScore}
                      </td>
                      <td className="px-4 py-3">
                        {awaitingScore ? (
                          <span className="font-medium text-amber-700">
                            Terkirim · Klik Ambil Nilai Form
                          </span>
                        ) : (
                          <span
                            className={`font-semibold ${
                              passed ? 'text-emerald-700' : 'text-red-700'
                            }`}
                          >
                            {passed ? 'Tuntas' : 'Belum Tuntas'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 uppercase font-mono text-[11px]">
                        {r.source === 'google_forms' ? 'G-FORM' : r.source}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditExistingResult(r)}
                            className="text-slate-500 hover:text-sky-700"
                            title="Input / koreksi skor & rincian soal"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteResult(r.id)}
                            className="text-slate-400 hover:text-red-600"
                            title="Hapus data siswa"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Item Analysis Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-sky-600" />
            <h4 className="text-sm font-bold text-slate-900">
              Analisis Butir Soal (Butir 1 s.d. {questionCount})
            </h4>
          </div>
          <span className="text-xs text-slate-500">Siap diunduh lengkap ke Word (.docx)</span>
        </div>

        <div className="max-h-96 overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
              <tr>
                <th className="px-4 py-3 text-center">No. Soal</th>
                <th className="px-4 py-3 text-center">Benar</th>
                <th className="px-4 py-3 text-center">Salah</th>
                <th className="px-4 py-3 text-center">Kesukaran (P)</th>
                <th className="px-4 py-3">Kategori P</th>
                <th className="px-4 py-3 text-center">Daya Pembeda (DP)</th>
                <th className="px-4 py-3">Kategori DP</th>
                <th className="px-4 py-3">Keputusan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {itemAnalysis.map((row) => (
                <tr key={row.questionNumber} className="hover:bg-slate-50/70">
                  <td className="px-4 py-2.5 text-center font-mono font-semibold text-slate-900 tabular-nums">
                    {row.questionNumber}
                  </td>
                  <td className="px-4 py-2.5 text-center font-mono text-emerald-700 tabular-nums">
                    {row.correctCount}
                  </td>
                  <td className="px-4 py-2.5 text-center font-mono text-red-700 tabular-nums">
                    {row.wrongCount}
                  </td>
                  <td className="px-4 py-2.5 text-center font-mono text-slate-800 tabular-nums">
                    {row.difficultyIndex.toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-slate-700">
                    {row.difficultyCategory}
                  </td>
                  <td className="px-4 py-2.5 text-center font-mono text-slate-800 tabular-nums">
                    {row.discriminationIndex.toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-slate-700">
                    {row.discriminationCategory}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{row.recommendation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
