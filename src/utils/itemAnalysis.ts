import type { ExamStudentResult } from '../types.ts';

export interface ItemAnalysisRow {
  questionNumber: number;
  correctCount: number;
  wrongCount: number;
  difficultyIndex: number;
  difficultyCategory: 'Mudah' | 'Sedang' | 'Sukar';
  discriminationIndex: number;
  discriminationCategory: 'Sangat Baik' | 'Baik' | 'Cukup' | 'Kurang';
  recommendation: string;
}

export interface ExamClassStats {
  totalStudents: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  passedCount: number;
  passRatePercent: number;
}

export function calculateFinalScore(rawScore: number, maxRawScore = 40): number {
  const divisor = maxRawScore > 0 ? maxRawScore : 40;
  const score = (rawScore / divisor) * 100;
  return Math.round(score * 100) / 100;
}

export function computeClassStats(
  results: ExamStudentResult[],
  kkm: number
): ExamClassStats {
  if (results.length === 0) {
    return {
      totalStudents: 0,
      averageScore: 0,
      highestScore: 0,
      lowestScore: 0,
      passedCount: 0,
      passRatePercent: 0,
    };
  }

  const scores = results.map((r) => r.finalScore);
  const sum = scores.reduce((acc, s) => acc + s, 0);
  const passedCount = scores.filter((s) => s >= kkm).length;

  return {
    totalStudents: results.length,
    averageScore: Math.round((sum / results.length) * 100) / 100,
    highestScore: Math.max(...scores),
    lowestScore: Math.min(...scores),
    passedCount,
    passRatePercent: Math.round((passedCount / results.length) * 1000) / 10,
  };
}

export function computeItemAnalysis(
  results: ExamStudentResult[],
  questionCount: number
): ItemAnalysisRow[] {
  const analyzable = results.filter((r) => r.itemScores.length > 0);
  const pool = analyzable.length > 0 ? analyzable : results.filter((r) => r.source !== 'kiosk');
  const n = pool.length;
  const rows: ItemAnalysisRow[] = [];

  if (questionCount <= 0) return rows;

  const sorted = pool.slice().sort((a, b) => b.rawScore - a.rawScore);
  const groupSize = n >= 20 ? Math.max(1, Math.round(n * 0.27)) : Math.max(1, Math.floor(n / 2));
  const upperGroup = sorted.slice(0, groupSize);
  const lowerGroup = sorted.slice(n - groupSize);

  for (let i = 0; i < questionCount; i++) {
    let correctCount = 0;
    for (const r of pool) {
      if ((r.itemScores[i] ?? 0) > 0) {
        correctCount++;
      }
    }
    const wrongCount = Math.max(0, n - correctCount);
    const p = n > 0 ? Math.round((correctCount / n) * 100) / 100 : 0;

    let difficultyCategory: ItemAnalysisRow['difficultyCategory'] = 'Sedang';
    if (p > 0.7) difficultyCategory = 'Mudah';
    else if (p < 0.3) difficultyCategory = 'Sukar';

    let dp = 0;
    if (n >= 2 && groupSize > 0) {
      const upperCorrect = upperGroup.filter((r) => (r.itemScores[i] ?? 0) > 0).length;
      const lowerCorrect = lowerGroup.filter((r) => (r.itemScores[i] ?? 0) > 0).length;
      dp = Math.round(((upperCorrect - lowerCorrect) / groupSize) * 100) / 100;
    }

    let discriminationCategory: ItemAnalysisRow['discriminationCategory'] = 'Kurang';
    if (dp >= 0.4) discriminationCategory = 'Sangat Baik';
    else if (dp >= 0.3) discriminationCategory = 'Baik';
    else if (dp >= 0.2) discriminationCategory = 'Cukup';

    let recommendation = 'Revisi / Ganti Soal';
    if (n < 2) {
      recommendation = 'Menunggu minimal 2 siswa';
    } else if (dp >= 0.3 && p >= 0.3 && p <= 0.7) {
      recommendation = 'Baik (Dipakai)';
    } else if (dp >= 0.2) {
      recommendation = 'Cukup (Revisi Ringan)';
    }

    rows.push({
      questionNumber: i + 1,
      correctCount,
      wrongCount,
      difficultyIndex: p,
      difficultyCategory,
      discriminationIndex: dp,
      discriminationCategory,
      recommendation,
    });
  }

  return rows;
}
