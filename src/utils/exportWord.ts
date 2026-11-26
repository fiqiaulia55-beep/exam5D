import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import type { ExamItem, ExamStudentResult } from '../types.ts';
import { computeClassStats, computeItemAnalysis } from './itemAnalysis.ts';

function cellText(
  text: string,
  options?: { bold?: boolean; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; shading?: string }
): TableCell {
  return new TableCell({
    shading: options?.shading ? { fill: options.shading } : undefined,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: [
      new Paragraph({
        alignment: options?.align || AlignmentType.LEFT,
        children: [
          new TextRun({
            text,
            bold: options?.bold,
            size: 20, // 10pt
            font: 'Calibri',
          }),
        ],
      }),
    ],
  });
}

export async function exportExamAnalysisDocx(params: {
  exam: ExamItem;
  className: string;
  results: ExamStudentResult[];
  violationCounts: Record<string, number>;
}): Promise<void> {
  const { exam, className, results, violationCounts } = params;
  const maxRawScore = exam.maxRawScore || 40;
  const questionCount = exam.questionCount || 40;
  const kkm = exam.kkm || 75;

  const sortedResults = results
    .slice()
    .sort((a, b) => Number(a.absenNumber) - Number(b.absenNumber) || a.studentName.localeCompare(b.studentName));

  const stats = computeClassStats(sortedResults, kkm);
  const itemRows = computeItemAnalysis(sortedResults, questionCount);

  const exportDate = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Table 1: Identitas Ulangan
  const identityTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
      left: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
      right: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
    },
    rows: [
      new TableRow({
        children: [
          cellText('Judul Ulangan', { bold: true, shading: 'F1F5F9' }),
          cellText(exam.examTitle),
          cellText('Kelas', { bold: true, shading: 'F1F5F9' }),
          cellText(className),
        ],
      }),
      new TableRow({
        children: [
          cellText('Mata Pelajaran', { bold: true, shading: 'F1F5F9' }),
          cellText(exam.subject),
          cellText('Guru Pengampu', { bold: true, shading: 'F1F5F9' }),
          cellText(exam.teacherName),
        ],
      }),
      new TableRow({
        children: [
          cellText('Rumus Nilai Akhir', { bold: true, shading: 'F1F5F9' }),
          cellText(`(Jumlah Skor Diperoleh / ${maxRawScore}) × 100`),
          cellText('KKM / Jumlah Soal', { bold: true, shading: 'F1F5F9' }),
          cellText(`${kkm} / ${questionCount} Butir`),
        ],
      }),
      new TableRow({
        children: [
          cellText('Jumlah Peserta', { bold: true, shading: 'F1F5F9' }),
          cellText(`${stats.totalStudents} Siswa`),
          cellText('Ketuntasan Klasikal', { bold: true, shading: 'F1F5F9' }),
          cellText(`${stats.passedCount} Tuntas (${stats.passRatePercent}%) · Rata-rata: ${stats.averageScore}`),
        ],
      }),
    ],
  });

  // Table 2: Daftar Nilai Akhir Siswa
  const studentHeader = new TableRow({
    tableHeader: true,
    children: [
      cellText('No', { bold: true, align: AlignmentType.CENTER, shading: 'E2E8F0' }),
      cellText('Absen', { bold: true, align: AlignmentType.CENTER, shading: 'E2E8F0' }),
      cellText('Nama Siswa', { bold: true, shading: 'E2E8F0' }),
      cellText(`Skor (/${maxRawScore})`, { bold: true, align: AlignmentType.CENTER, shading: 'E2E8F0' }),
      cellText('Nilai Akhir', { bold: true, align: AlignmentType.CENTER, shading: 'E2E8F0' }),
      cellText('Keterangan', { bold: true, align: AlignmentType.CENTER, shading: 'E2E8F0' }),
      cellText('Pelanggaran Fokus', { bold: true, align: AlignmentType.CENTER, shading: 'E2E8F0' }),
    ],
  });

  const studentDataRows = sortedResults.map((r, idx) => {
    const key = `${r.absenNumber}::${r.studentName.toLowerCase()}`;
    const vCount = violationCounts[key] ?? 0;
    const isPassed = r.finalScore >= kkm;

    return new TableRow({
      children: [
        cellText(String(idx + 1), { align: AlignmentType.CENTER }),
        cellText(r.absenNumber, { align: AlignmentType.CENTER }),
        cellText(r.studentName),
        cellText(String(r.rawScore), { align: AlignmentType.CENTER }),
        cellText(String(r.finalScore), { bold: true, align: AlignmentType.CENTER }),
        cellText(isPassed ? 'Tuntas' : 'Belum Tuntas', { align: AlignmentType.CENTER }),
        cellText(`${vCount}x`, { align: AlignmentType.CENTER }),
      ],
    });
  });

  const studentTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [studentHeader, ...studentDataRows],
  });

  // Table 3: Analisis Butir Soal
  const analysisHeader = new TableRow({
    tableHeader: true,
    children: [
      cellText('No. Soal', { bold: true, align: AlignmentType.CENTER, shading: 'E2E8F0' }),
      cellText('Benar', { bold: true, align: AlignmentType.CENTER, shading: 'E2E8F0' }),
      cellText('Salah', { bold: true, align: AlignmentType.CENTER, shading: 'E2E8F0' }),
      cellText('Indeks Kesukaran (P)', { bold: true, align: AlignmentType.CENTER, shading: 'E2E8F0' }),
      cellText('Kategori Kesukaran', { bold: true, align: AlignmentType.CENTER, shading: 'E2E8F0' }),
      cellText('Daya Pembeda (DP)', { bold: true, align: AlignmentType.CENTER, shading: 'E2E8F0' }),
      cellText('Kategori DP', { bold: true, align: AlignmentType.CENTER, shading: 'E2E8F0' }),
      cellText('Tindak Lanjut', { bold: true, shading: 'E2E8F0' }),
    ],
  });

  const analysisDataRows = itemRows.map((row) => {
    return new TableRow({
      children: [
        cellText(String(row.questionNumber), { align: AlignmentType.CENTER }),
        cellText(String(row.correctCount), { align: AlignmentType.CENTER }),
        cellText(String(row.wrongCount), { align: AlignmentType.CENTER }),
        cellText(row.difficultyIndex.toFixed(2), { align: AlignmentType.CENTER }),
        cellText(row.difficultyCategory, { align: AlignmentType.CENTER }),
        cellText(row.discriminationIndex.toFixed(2), { align: AlignmentType.CENTER }),
        cellText(row.discriminationCategory, { align: AlignmentType.CENTER }),
        cellText(row.recommendation),
      ],
    });
  });

  const analysisTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [analysisHeader, ...analysisDataRows],
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            heading: HeadingLevel.HEADING_1,
            children: [
              new TextRun({
                text: `DAFTAR NILAI AKHIR & ANALISIS BUTIR SOAL`,
                bold: true,
                size: 28,
                font: 'Calibri',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 },
            children: [
              new TextRun({
                text: `${exam.examTitle} · ${exam.subject} · ${className}`,
                size: 22,
                color: '475569',
                font: 'Calibri',
              }),
            ],
          }),
          identityTable,
          new Paragraph({
            spacing: { before: 320, after: 120 },
            heading: HeadingLevel.HEADING_2,
            children: [
              new TextRun({
                text: 'A. Daftar Nilai Akhir Siswa',
                bold: true,
                size: 24,
                font: 'Calibri',
              }),
            ],
          }),
          studentTable,
          new Paragraph({
            spacing: { before: 360, after: 120 },
            heading: HeadingLevel.HEADING_2,
            children: [
              new TextRun({
                text: 'B. Analisis Butir Soal',
                bold: true,
                size: 24,
                font: 'Calibri',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: `Keterangan: P > 0,70 = Mudah; 0,30 ≤ P ≤ 0,70 = Sedang; P < 0,30 = Sukar. DP ≥ 0,40 = Sangat Baik; 0,30–0,39 = Baik; 0,20–0,29 = Cukup; < 0,20 = Kurang.`,
                size: 18,
                italics: true,
                color: '475569',
                font: 'Calibri',
              }),
            ],
          }),
          analysisTable,
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { before: 420 },
            children: [
              new TextRun({
                text: `${exportDate}\nGuru ${className},\n\n\n\n${exam.teacherName}`,
                size: 20,
                font: 'Calibri',
              }),
            ],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeSubject = (exam.subject || 'ulangan').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  a.href = url;
  a.download = `analisis-nilai-${safeSubject}-${className.toLowerCase().replace(/\s+/g, '-')}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
