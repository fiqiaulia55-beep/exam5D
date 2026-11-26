export interface ParsedCsvRow {
  studentName: string;
  absenNumber: string;
  rawScore: number | null;
  itemScores: number[];
  answers: string[];
  submittedAt: number;
}

export interface ParsedCsvSummary {
  rows: ParsedCsvRow[];
  detectedQuestions: number;
  hasScoreColumn: boolean;
  hasPerItemScoreColumns: boolean;
}

/**
 * RFC-4180 compliant CSV parser handling quoted commas and newlines.
 */
function parseCsvMatrix(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(cell.trim());
        cell = '';
      } else if (ch === '\r' && next === '\n') {
        row.push(cell.trim());
        rows.push(row);
        row = [];
        cell = '';
        i++;
      } else if (ch === '\n' || ch === '\r') {
        row.push(cell.trim());
        rows.push(row);
        row = [];
        cell = '';
      } else {
        cell += ch;
      }
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    rows.push(row);
  }

  return rows.filter((r) => r.some((c) => c !== ''));
}

function parseScoreString(val: string): number | null {
  if (!val) return null;
  // Handles Google Form formats like "34 / 40", "34/40", "34.5", "34,5"
  const slashMatch = val.match(/^(\d+(?:[.,]\d+)?)\s*\/\s*\d+(?:[.,]\d+)?$/);
  if (slashMatch) {
    return Number(slashMatch[1].replace(',', '.'));
  }
  const num = Number(val.replace(',', '.'));
  return Number.isFinite(num) ? num : null;
}

export function parseGoogleFormCsv(
  csvText: string,
  questionCount: number,
  answerKey: string[] = []
): ParsedCsvSummary {
  const matrix = parseCsvMatrix(csvText);
  if (matrix.length < 2) {
    return {
      rows: [],
      detectedQuestions: 0,
      hasScoreColumn: false,
      hasPerItemScoreColumns: false,
    };
  }

  const headers = matrix[0];
  const lowerHeaders = headers.map((h) => h.toLowerCase());

  const timestampIdx = lowerHeaders.findIndex(
    (h) => h.includes('timestamp') || h.includes('cap waktu') || h.includes('waktu')
  );
  const scoreIdx = lowerHeaders.findIndex(
    (h) => h === 'score' || h === 'skor' || h.includes('total score') || h.includes('skor total')
  );
  const nameIdx = lowerHeaders.findIndex(
    (h) => h.includes('nama') || h.includes('name')
  );
  const absenIdx = lowerHeaders.findIndex(
    (h) => h.includes('absen') || h.includes('no.') || h === 'no' || h.includes('nomor')
  );

  // Detect per-item "[Score]" or "[Skor]" columns (exported by Google Forms Quiz CSV)
  const itemScoreIndices: number[] = [];
  const questionIndices: number[] = [];

  lowerHeaders.forEach((h, idx) => {
    if (idx === timestampIdx || idx === scoreIdx || idx === nameIdx || idx === absenIdx) return;
    if (h.includes('email') || h.includes('token kirim') || h.includes('kelas')) return;

    if (h.includes('[score]') || h.includes('[skor]')) {
      itemScoreIndices.push(idx);
    } else if (!h.includes('[feedback]') && !h.includes('[masukan]')) {
      questionIndices.push(idx);
    }
  });

  const hasPerItemScoreColumns = itemScoreIndices.length > 0;
  const effectiveCols = hasPerItemScoreColumns ? itemScoreIndices : questionIndices;
  const detectedQuestions = Math.min(questionCount, effectiveCols.length);

  const normalizedKey = answerKey.map((k) => k.trim().toLowerCase());
  const hasAnswerKey = normalizedKey.some((k) => k !== '');

  const parsedRows: ParsedCsvRow[] = [];

  for (let r = 1; r < matrix.length; r++) {
    const line = matrix[r];
    const studentName =
      nameIdx >= 0 && line[nameIdx] ? line[nameIdx] : `Siswa ${r}`;
    const absenNumber =
      absenIdx >= 0 && line[absenIdx] ? line[absenIdx] : String(r);

    const submittedAt =
      timestampIdx >= 0 && line[timestampIdx] && !Number.isNaN(Date.parse(line[timestampIdx]))
        ? Date.parse(line[timestampIdx])
        : Date.now();

    const answers = questionIndices.slice(0, questionCount).map((idx) => line[idx] ?? '');
    let itemScores: number[] = [];

    if (hasPerItemScoreColumns) {
      itemScores = itemScoreIndices.slice(0, questionCount).map((idx) => {
        const s = parseScoreString(line[idx] ?? '');
        return s !== null && s > 0 ? 1 : 0;
      });
    } else if (hasAnswerKey) {
      itemScores = answers.map((ans, qIdx) => {
        const key = normalizedKey[qIdx] ?? '';
        if (!key) return 0;
        const cleanAns = ans.trim().toLowerCase();
        // Match exact answer OR leading choice letter like "A. ..." matching key "A"
        if (cleanAns === key) return 1;
        if (key.length === 1 && cleanAns.startsWith(`${key}.`)) return 1;
        if (key.length === 1 && cleanAns.startsWith(`${key})`)) return 1;
        return 0;
      });
    }

    let rawScore: number | null = scoreIdx >= 0 ? parseScoreString(line[scoreIdx] ?? '') : null;
    if (rawScore === null && itemScores.length > 0) {
      rawScore = itemScores.reduce((acc, v) => acc + v, 0);
    }

    parsedRows.push({
      studentName,
      absenNumber,
      rawScore,
      itemScores,
      answers,
      submittedAt,
    });
  }

  return {
    rows: parsedRows,
    detectedQuestions,
    hasScoreColumn: scoreIdx >= 0,
    hasPerItemScoreColumns,
  };
}
