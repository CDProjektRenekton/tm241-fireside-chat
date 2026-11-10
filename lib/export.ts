import 'server-only';
import ExcelJS from 'exceljs';
import { EVENT, TOPIC_SHORT, type Topic, venueFull } from './config';
import { affiliationLabel, computeStats, duplicateKey, findDuplicates, formatDateTime, topicsLabel } from './stats';
import type { Registration } from './types';

type Row = Record<string, string | number>;

const REG_HEADERS = [
  'Reference No.',
  'Submitted At',
  'Name',
  'Sex',
  'Age Group',
  'Email',
  'University/Organization',
  'Current Affiliation',
  'Topics of Interest',
  'Question for the Speaker',
  'Hopes to Learn',
  'Data Privacy Consent',
  'Attended',
  'Checked In At',
  'Possible Duplicate',
];

function registrationRows(rows: Registration[]): Row[] {
  const dups = findDuplicates(rows);
  return rows.map((r) => ({
    'Reference No.': r.ref,
    'Submitted At': formatDateTime(r.submittedAt),
    Name: r.name,
    Sex: r.sex,
    'Age Group': r.ageGroup,
    Email: r.email,
    'University/Organization': r.organization,
    'Current Affiliation': affiliationLabel(r),
    'Topics of Interest': topicsLabel(r).join('; '),
    'Question for the Speaker': r.question,
    'Hopes to Learn': r.hopes,
    'Data Privacy Consent': r.consent,
    Attended: r.attended ? 'Yes' : '',
    'Checked In At': r.attended ? formatDateTime(r.checkedInAt) : '',
    'Possible Duplicate': dups.has(duplicateKey(r)) ? 'Yes' : '',
  }));
}

const ATTENDANCE_HEADERS = [
  'No.',
  'Name',
  'University/Organization',
  'Current Affiliation',
  'Email',
  'Reference No.',
  'Checked In',
  'Signature',
];

/** Alphabetical sign-in sheet for the registration desk. */
function attendanceRows(rows: Registration[]): Row[] {
  return [...rows]
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
    .map((r, i) => ({
      'No.': i + 1,
      Name: r.name,
      'University/Organization': r.organization,
      'Current Affiliation': affiliationLabel(r),
      Email: r.email,
      'Reference No.': r.ref,
      'Checked In': r.attended ? formatDateTime(r.checkedInAt) || 'Yes' : '',
      Signature: '',
    }));
}

const QUESTION_HEADERS = ['No.', 'Question for the Speaker', 'Name', 'University/Organization', 'Current Affiliation', 'Submitted At'];

function questionRows(rows: Registration[]): Row[] {
  return rows
    .filter((r) => r.question)
    .map((r, i) => ({
      'No.': i + 1,
      'Question for the Speaker': r.question,
      Name: r.name,
      'University/Organization': r.organization,
      'Current Affiliation': affiliationLabel(r),
      'Submitted At': formatDateTime(r.submittedAt),
    }));
}

// ---------------------------------------------------------------- CSV

function csvCell(v: string | number) {
  let s = String(v ?? '');
  // Neutralise spreadsheet formulas (CSV injection).
  if (/^[=@+\-\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: Row[], headers: string[]) {
  const lines = [headers.map(csvCell).join(',')];
  for (const r of rows) lines.push(headers.map((h) => csvCell(r[h] ?? '')).join(','));
  // BOM so Excel opens Ñ / ñ correctly.
  return `﻿${lines.join('\r\n')}\r\n`;
}

export const registrationsCsv = (rows: Registration[]) => toCsv(registrationRows(rows), REG_HEADERS);
export const attendanceCsv = (rows: Registration[]) => toCsv(attendanceRows(rows), ATTENDANCE_HEADERS);
export const questionsCsv = (rows: Registration[]) => toCsv(questionRows(rows), QUESTION_HEADERS);

// ---------------------------------------------------------------- Excel

const NAVY = 'FF0B0F3A';
const CYAN = 'FF1C9CC0';
const CORAL = 'FFD63B4F';
const TINT = 'FFEAF7FB';
const BORDER = { style: 'thin' as const, color: { argb: 'FFD5DEEA' } };

function addTableSheet(wb: ExcelJS.Workbook, name: string, rows: Row[], headers: string[], widths: Record<string, number> = {}) {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = headers.map((h) => ({ header: h, key: h, width: widths[h] ?? Math.min(Math.max(h.length + 4, 14), 40) }));
  for (const r of rows) ws.addRow(r);
  const header = ws.getRow(1);
  header.height = 30;
  header.eachCell((c) => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    c.alignment = { vertical: 'middle', wrapText: true };
  });
  ws.eachRow((row, i) => {
    if (i === 1) return;
    row.alignment = { vertical: 'top', wrapText: true };
    row.eachCell({ includeEmpty: true }, (c) => {
      c.border = { bottom: BORDER };
      if (i % 2 === 0) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TINT } };
    });
  });
  if (rows.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
  return ws;
}

async function fetchImage(origin: string, path: string) {
  try {
    const res = await fetch(new URL(path, origin), { cache: 'force-cache' });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

export async function buildWorkbook(rows: Registration[], filterLabel: string, origin: string) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'TM241 Class · UP Diliman Technology Management Center';
  wb.created = new Date();
  const stats = computeStats(rows);

  // Summary
  const ws = wb.addWorksheet('Summary', { properties: { tabColor: { argb: CYAN } } });
  ws.columns = [{ width: 46 }, { width: 16 }, { width: 16 }, { width: 16 }];
  const [up, tmc] = await Promise.all([fetchImage(origin, '/up-seal.png'), fetchImage(origin, '/tmc-logo.png')]);
  let top = 1;
  if (up && tmc) {
    for (let r = 1; r <= 3; r++) {
      ws.getRow(r).height = r === 2 ? 30 : 14;
      for (let c = 1; c <= 4; c++) {
        ws.getRow(r).getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
      }
    }
    ws.addImage(wb.addImage({ buffer: up as unknown as ExcelJS.Buffer, extension: 'png' }), {
      tl: { col: 0.06, row: 0.2 },
      ext: { width: 54, height: 54 },
    });
    ws.addImage(wb.addImage({ buffer: tmc as unknown as ExcelJS.Buffer, extension: 'png' }), {
      tl: { col: 0.24, row: 0.2 },
      ext: { width: 54, height: 54 },
    });
    top = 5;
  }
  const line = (text: string, font: Partial<ExcelJS.Font>) => {
    const c = ws.getCell(`A${top}`);
    c.value = text;
    c.font = font;
    ws.mergeCells(`A${top}:D${top}`);
    top += 1;
  };
  line(EVENT.series.toUpperCase(), { bold: true, size: 11, color: { argb: CYAN } });
  line(EVENT.title.toUpperCase(), { bold: true, size: 18, color: { argb: NAVY } });
  line(EVENT.subtitle, { italic: true, size: 10, color: { argb: 'FF44506B' } });
  line(`${EVENT.dateEn} · ${EVENT.time} · ${venueFull()}`, { size: 10, color: { argb: 'FF44506B' } });
  line(`Generated ${formatDateTime(new Date().toISOString())} · ${filterLabel}`, { italic: true, size: 9, color: { argb: 'FF6B7488' } });
  top += 1;

  const section = (title: string, headers: string[], body: (string | number)[][]) => {
    const t = ws.getCell(`A${top}`);
    t.value = title;
    t.font = { bold: true, size: 12, color: { argb: CORAL } };
    top += 1;
    const h = ws.getRow(top);
    headers.forEach((v, i) => {
      const c = h.getCell(i + 1);
      c.value = v;
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    });
    top += 1;
    for (const r of body) {
      const row = ws.getRow(top);
      r.forEach((v, i) => {
        const c = row.getCell(i + 1);
        c.value = v;
        c.border = { bottom: BORDER };
      });
      top += 1;
    }
    top += 1;
  };

  const share = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '0%');
  section('Key figures', ['Metric', 'Value'], [
    ['Registrations', stats.total],
    ['Checked in at the event', stats.attended],
    ['Universities / organizations represented', stats.organizations],
    ['Students (undergraduate + graduate)', stats.students],
    ['Questions for the speaker', stats.questions],
    ['Shared what they hope to learn', stats.hopes],
    ['Possible duplicate registrations (same email)', stats.duplicates],
  ]);
  const notAsked: (string | number)[][] = stats.demographicsNotAsked
    ? [['Not asked (registered before the question was added)', stats.demographicsNotAsked, share(stats.demographicsNotAsked, stats.total)]]
    : [];
  section('Sex', ['Sex', 'Registrants', 'Share'], [
    ...stats.bySex.map((s) => [s.label, s.count, share(s.count, stats.total)]),
    ...notAsked,
  ]);
  section('Age group', ['Age group', 'Registrants', 'Share'], [
    ...stats.byAge.map((a) => [a.label, a.count, share(a.count, stats.total)]),
    ...notAsked,
  ]);
  section(
    'Current affiliation',
    ['Affiliation', 'Registrants', 'Share'],
    stats.byAffiliation.map((a) => [a.label, a.count, share(a.count, stats.total)]),
  );
  section(
    'Topics of interest (check all that apply)',
    ['Topic', 'Registrants', 'Share'],
    stats.byTopic.map((t) => [TOPIC_SHORT[t.topic as Topic] ?? t.topic, t.count, share(t.count, stats.total)]),
  );
  section(
    'Universities / organizations',
    ['University / Organization', 'Registrants'],
    stats.byOrganization.map((o) => [o.label, o.count]),
  );

  addTableSheet(wb, 'Registrations', registrationRows(rows), REG_HEADERS, {
    'Reference No.': 18,
    'Submitted At': 22,
    Name: 28,
    Sex: 18,
    'Age Group': 18,
    Email: 30,
    'University/Organization': 32,
    'Current Affiliation': 24,
    'Topics of Interest': 48,
    'Question for the Speaker': 52,
    'Hopes to Learn': 52,
    'Checked In At': 22,
  });
  const att = addTableSheet(wb, 'Attendance Sheet', attendanceRows(rows), ATTENDANCE_HEADERS, {
    'No.': 6,
    Name: 30,
    'University/Organization': 32,
    'Current Affiliation': 24,
    Email: 30,
    'Reference No.': 18,
    'Checked In': 22,
    Signature: 26,
  });
  att.eachRow((row, i) => {
    if (i > 1) row.height = 26;
  });
  addTableSheet(wb, 'Speaker Questions', questionRows(rows), QUESTION_HEADERS, {
    'No.': 6,
    'Question for the Speaker': 70,
    Name: 26,
    'University/Organization': 30,
    'Current Affiliation': 22,
    'Submitted At': 22,
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}
