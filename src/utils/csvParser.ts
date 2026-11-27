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

function normalizeAnswerText(val: string): string {
  return val.trim().toLowerCase().replace(/\s+/g, ' ');
}

function stripOptionPrefix(val: string): string {
  return val.replace(/^[a-e]\s*[.):\-]\s*/i, '').trim();
}

export function matchesAnswerText(studentAnswer: string, rawKey: string): boolean {
  const ans = normalizeAnswerText(studentAnswer);
  if (!ans || !rawKey.trim()) return false;

  const acceptableKeys = rawKey
    .split(/\s*\/\s*|\s*\|\s*/)
    .map(normalizeAnswerText)
    .filter(Boolean);

  for (const key of acceptableKeys) {
    if (ans === key) return true;

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

    const strippedKey = stripOptionPrefix(key);
    const strippedAns = stripOptionPrefix(ans);
    if (strippedKey && strippedAns && strippedKey === strippedAns) {
      return true;
    }

    const numKey = Number(key.replace(',', '.'));
    const numAns = Number(ans.replace(',', '.'));
    if (
      !Number.isNaN(numKey) &&
      !Number.isNaN(numAns) &&
      key !== '' &&
      ans !== '' &&
      numKey === numAns
    ) {
      return true;
    }
  }

  return false;
}

export function parseAnswerKeyText(rawText: string): string[] {
  const trimmed = rawText.trim();
  if (!trimmed) return [];
  const tokens = trimmed.includes('\n') || trimmed.includes(';') || trimmed.includes(',')
    ? trimmed.split(/[\n;,]+/)
    : trimmed.split(/\s+/);
  return tokens
    .map((entry) => entry.replace(/^\d+\s*[.):\-]\s*/, '').trim())
    .filter(Boolean);
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
    (h) =>
      h.includes('absen') ||
      h.includes('no.') ||
      h === 'no' ||
      h.startsWith('no ') ||
      h.includes('nomor urut') ||
      h.includes('no urut')
  );

  // Detect per-item "[Score]" or "[Skor]" columns (exported by Google Forms Quiz CSV)
  const itemScoreIndices: number[] = [];
  const questionIndices: number[] = [];

  lowerHeaders.forEach((h, idx) => {
    if (idx === timestampIdx || idx === scoreIdx || idx === nameIdx || idx === absenIdx) return;
    if (
      h.includes('email') ||
      h.includes('token') ||
      h.includes('kelas') ||
      h.includes('nisn') ||
      h === 'nis'
    ) {
      return;
    }

    if (h.includes('[score]') || h.includes('[skor]')) {
      itemScoreIndices.push(idx);
    } else if (!h.includes('[feedback]') && !h.includes('[masukan]')) {
      questionIndices.push(idx);
    }
  });

  const hasPerItemScoreColumns = itemScoreIndices.length > 0;
  const effectiveCols = hasPerItemScoreColumns ? itemScoreIndices : questionIndices;
  const detectedQuestions = Math.min(questionCount, effectiveCols.length);

  const hasAnswerKey = answerKey.some((k) => k.trim() !== '');

  const parsedRows: ParsedCsvRow[] = [];

  for (let r = 1; r < matrix.length; r++) {
    const line = matrix[r];
    const studentName =
      nameIdx >= 0 && line[nameIdx] ? line[nameIdx] : `Siswa ${r}`;
    const absenNumber =
      absenIdx >= 0 && line[absenIdx] ? line[absenIdx] : '-';

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
        const key = answerKey[qIdx] ?? '';
        if (!key.trim()) return 0;
        return matchesAnswerText(ans, key) ? 1 : 0;
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
