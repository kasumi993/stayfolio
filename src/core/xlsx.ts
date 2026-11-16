/**
 * A deliberately small .xlsx reader and writer.
 *
 * An .xlsx file is a zip of XML parts. We only need cell values (the cached
 * results of formulas included), so a few regular expressions over the sheet
 * XML are enough and keep a heavy spreadsheet library out of the app.
 */
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

export type Cell = string | number | boolean | null;
/** Cells of a sheet keyed by reference, e.g. `B12`. */
export type Sheet = Map<string, Cell>;
export type Workbook = Record<string, Sheet>;

const unescapeXml = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&');

const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const attr = (tag: string, name: string): string | null => {
  const m = new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(tag);
  return m ? unescapeXml(m[1]) : null;
};

/** Concatenates every <t> run of a string item (plain or rich text). */
const textOf = (xml: string) =>
  [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => unescapeXml(m[1])).join('');

export function readWorkbook(bytes: Uint8Array): Workbook {
  const zip = unzipSync(bytes);
  const part = (path: string) => (zip[path] ? strFromU8(zip[path]) : '');

  const shared = [...part('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    textOf(m[1]),
  );

  const targets = new Map<string, string>();
  for (const m of part('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\s([^>]*?)\/?>/g)) {
    const id = attr(m[1], 'Id');
    const target = attr(m[1], 'Target');
    if (id && target) targets.set(id, target.replace(/^\/?(xl\/)?/, 'xl/'));
  }

  const book: Workbook = {};
  for (const m of part('xl/workbook.xml').matchAll(/<sheet\s([^>]*?)\/?>/g)) {
    const name = attr(m[1], 'name');
    const path = targets.get(attr(m[1], 'r:id') ?? '');
    if (!name || !path) continue;
    const sheet: Sheet = new Map();
    for (const c of part(path).matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = attr(c[1], 'r');
      const type = attr(c[1], 't');
      const inner = c[2] ?? '';
      if (!ref) continue;
      const raw = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
      let value: Cell = null;
      if (type === 'inlineStr') value = textOf(inner);
      else if (raw === undefined) value = null;
      else if (type === 's') value = shared[Number(raw)] ?? '';
      else if (type === 'str') value = unescapeXml(raw);
      else if (type === 'b') value = raw === '1';
      else if (type === 'e') value = null;
      else value = Number(raw);
      if (value !== null && value !== '') sheet.set(ref, value);
    }
    book[name] = sheet;
  }
  return book;
}

/** `A`→0, `B`→1, … `AA`→26 */
export const columnIndex = (letters: string): number =>
  [...letters].reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0) - 1;

export function columnLetters(index: number): string {
  let s = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26))
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** Converts a sheet into a dense grid of rows (0-based). */
export function toRows(sheet: Sheet): Cell[][] {
  const rows: Cell[][] = [];
  for (const [ref, value] of sheet) {
    const m = /^([A-Z]+)(\d+)$/.exec(ref);
    if (!m) continue;
    const r = Number(m[2]) - 1;
    const c = columnIndex(m[1]);
    (rows[r] ??= [])[c] = value;
  }
  for (let r = 0; r < rows.length; r++) rows[r] = Array.from(rows[r] ?? [], (v) => v ?? null);
  return rows;
}

/** Builds an .xlsx file from plain rows. Strings and numbers only. */
export function writeWorkbook(sheets: { name: string; rows: Cell[][] }[]): Uint8Array {
  const sheetXml = (rows: Cell[][]) =>
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>` +
    rows
      .map(
        (row, r) =>
          `<row r="${r + 1}">` +
          row
            .map((v, c) => {
              const ref = `${columnLetters(c)}${r + 1}`;
              if (v === null || v === '') return '';
              if (typeof v === 'number') return `<c r="${ref}"><v>${v}</v></c>`;
              return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(String(v))}</t></is></c>`;
            })
            .join('') +
          `</row>`,
      )
      .join('') +
    `</sheetData></worksheet>`;

  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
        sheets
          .map(
            (_, i) =>
              `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
          )
          .join('') +
        `</Types>`,
    ),
    '_rels/.rels': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
        `</Relationships>`,
    ),
    'xl/workbook.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>` +
        sheets
          .map(
            (s, i) =>
              `<sheet name="${escapeXml(s.name.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
          )
          .join('') +
        `</sheets></workbook>`,
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        sheets
          .map(
            (_, i) =>
              `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
          )
          .join('') +
        `</Relationships>`,
    ),
  };
  sheets.forEach((s, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(s.rows));
  });
  return zipSync(files);
}
