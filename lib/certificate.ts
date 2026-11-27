// The Certificate of Participation: the blank template (assets/certificate/template.pdf, based on the
// organizers' Certificate of Appreciation) with one person's name and certificate number added, and the
// event leads' e-signatures when they have been uploaded (dashboard: Certificates).
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, type PDFFont, type PDFPage, rgb, StandardFonts } from 'pdf-lib';
import { EVENT } from './config';
import { placeSignature, SIGNATORIES, signaturePng, type Signatures } from './signatories';

const DIR = path.join(process.cwd(), 'assets', 'certificate');
const FONT_FILES = ['InterTight-ExtraBoldItalic-latin.ttf', 'InterTight-ExtraBoldItalic-latin-ext.ttf'];
const INK = rgb(0.043, 0.059, 0.18);

// Where the name goes, in points from the top-left of the A4 landscape page.
const CENTER_X = 420.95;
const MAX_WIDTH = 636;
const ONE_LINE = { size: 38, baseline: 231 };
const TWO_LINES = { size: 24, baselines: [207, 234] };

let loaded: Promise<{ template: Buffer; fonts: Buffer[]; covers: ((cp: number) => boolean)[] }> | undefined;
function files() {
  loaded ??= (async () => {
    const [template, ...fonts] = await Promise.all(['template.pdf', ...FONT_FILES].map((f) => readFile(path.join(DIR, f))));
    // Which letters each font file has, so "Ñ" and "Ž" both print.
    const covers = fonts.map((f) => {
      const font = fontkit.create(f) as unknown as { hasGlyphForCodePoint(cp: number): boolean };
      return (cp: number) => font.hasGlyphForCodePoint(cp);
    });
    return { template, fonts, covers };
  })().catch((e) => {
    loaded = undefined;
    throw e;
  });
  return loaded;
}

type Run = { text: string; font: PDFFont };

/** The name as runs of text, each in a font file that has its letters. */
function toRuns(text: string, fonts: PDFFont[], covers: ((cp: number) => boolean)[]): Run[] {
  const runs: Run[] = [];
  for (const raw of text) {
    let char = raw;
    let i = covers.findIndex((has) => has(char.codePointAt(0)!));
    if (i < 0) {
      // A letter neither file has: try it without its accent, then a plain space.
      char = raw.normalize('NFD').charAt(0);
      i = covers.findIndex((has) => has(char.codePointAt(0)!));
      if (i < 0) {
        char = ' ';
        i = 0;
      }
    }
    const last = runs[runs.length - 1];
    if (last && last.font === fonts[i]) last.text += char;
    else runs.push({ text: char, font: fonts[i] });
  }
  return runs;
}

const widthOf = (runs: Run[], size: number) => runs.reduce((w, r) => w + r.font.widthOfTextAtSize(r.text, size), 0);

function drawCentered(page: PDFPage, runs: Run[], size: number, baselineFromTop: number) {
  let x = CENTER_X - widthOf(runs, size) / 2;
  for (const r of runs) {
    page.drawText(r.text, { x, y: page.getHeight() - baselineFromTop, size, font: r.font, color: INK });
    x += r.font.widthOfTextAtSize(r.text, size);
  }
}

/** Names are printed in capitals, as on the Certificate of Appreciation. */
export const certificateName = (name: string) => name.normalize('NFC').replace(/\s+/g, ' ').trim().toLocaleUpperCase('en-PH');

/** The finished PDF for one person. */
export async function buildCertificate({ name, number, signatures }: { name: string; number: string; signatures?: Partial<Signatures> }): Promise<Buffer> {
  const { template, fonts, covers } = await files();
  const pdf = await PDFDocument.load(template);
  pdf.registerFontkit(fontkit);
  const embedded = await Promise.all(fonts.map((f) => pdf.embedFont(f, { subset: true })));
  const page = pdf.getPage(0);

  const full = certificateName(name);
  const runs = toRuns(full, embedded, covers);
  const fit = (r: Run[], max: number) => Math.min(max, (max * MAX_WIDTH) / widthOf(r, max));
  const oneLine = fit(runs, ONE_LINE.size);
  const words = full.split(' ');
  if (oneLine >= 26 || words.length < 2) {
    drawCentered(page, runs, oneLine, ONE_LINE.baseline);
  } else {
    // A long name: two lines, split where they come out most even.
    let best: { lines: Run[][]; size: number } | undefined;
    for (let i = 1; i < words.length; i++) {
      const lines = [words.slice(0, i).join(' '), words.slice(i).join(' ')].map((t) => toRuns(t, embedded, covers));
      const size = Math.min(...lines.map((l) => fit(l, TWO_LINES.size)));
      const evenness = Math.abs(widthOf(lines[0], 10) - widthOf(lines[1], 10));
      const bestEven = best ? Math.abs(widthOf(best.lines[0], 10) - widthOf(best.lines[1], 10)) : Infinity;
      if (!best || size > best.size + 0.01 || (Math.abs(size - best.size) <= 0.01 && evenness < bestEven)) best = { lines, size };
    }
    best!.lines.forEach((l, i) => drawCentered(page, l, best!.size, TWO_LINES.baselines[i]));
  }

  for (const s of SIGNATORIES) {
    const png = signaturePng(signatures?.[s.key]);
    if (!png) continue;
    try {
      const img = await pdf.embedPng(png);
      const at = placeSignature(s.box, img.width, img.height);
      page.drawImage(img, { x: at.left, y: page.getHeight() - at.top - at.height, width: at.width, height: at.height });
    } catch (e) {
      // A damaged image never stops the certificate; it is printed without that signature.
      console.error(`[certificate] signature of ${s.name} could not be used:`, e instanceof Error ? e.message : e);
    }
  }

  const small = await pdf.embedFont(StandardFonts.Helvetica);
  const note = `Certificate No. ${number}`;
  page.drawText(note, {
    x: CENTER_X - small.widthOfTextAtSize(note, 7.5) / 2,
    y: page.getHeight() - 558,
    size: 7.5,
    font: small,
    color: rgb(0.16, 0.26, 0.42),
  });

  pdf.setTitle(`Certificate of Participation - ${full}`);
  pdf.setAuthor(EVENT.organizer);
  pdf.setSubject(`${EVENT.series}: ${EVENT.title}, ${EVENT.dateEn}`);
  pdf.setKeywords([number]);
  pdf.setCreator(EVENT.organizer);
  return Buffer.from(await pdf.save());
}

/** "Certificate of Participation - Juan dela Cruz.pdf", safe for every mail app and file system. */
export function certificateFileName(name: string) {
  const plain = name
    .replace(/[ŁłØøĐđßÆæŒœ]/g, (c) => ({ Ł: 'L', ł: 'l', Ø: 'O', ø: 'o', Đ: 'D', đ: 'd', ß: 'ss', Æ: 'AE', æ: 'ae', Œ: 'OE', œ: 'oe' })[c]!)
    .normalize('NFD')
    .replace(/[^A-Za-z0-9 .'-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
  return `Certificate of Participation${plain ? ` - ${plain}` : ''}.pdf`;
}
