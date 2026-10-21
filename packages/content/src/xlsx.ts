// Minimal .xlsx reader: sheet name → rows of cell text. Enough for the TOCFL and NAER word lists
// (shared strings and plain values; no formulas, dates or rich formatting).

import { readFileSync } from 'node:fs';
import { strFromU8, unzipSync } from 'fflate';

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

export function decodeXml(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
    if (name.startsWith('#x')) return String.fromCodePoint(parseInt(name.slice(2), 16));
    if (name.startsWith('#')) return String.fromCodePoint(parseInt(name.slice(1), 10));
    return ENTITIES[name] ?? whole;
  });
}

/** Concatenated text of every <t> run inside an element. */
const runs = (xml: string) =>
  [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decodeXml(m[1] ?? '')).join('');

/** "A" → 0, "AB" → 27 */
const columnIndex = (letters: string) =>
  [...letters].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;

export function readXlsx(path: string): Map<string, string[][]> {
  const files = unzipSync(readFileSync(path));
  const text = (name: string) => {
    const file = files[name];
    return file ? strFromU8(file) : '';
  };

  const shared = [...text('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    runs(m[1] ?? ''),
  );
  const targets = new Map(
    [...text('xl/_rels/workbook.xml.rels').matchAll(/<Relationship [^>]*>/g)].map((m) => [
      /Id="([^"]+)"/.exec(m[0])?.[1] ?? '',
      /Target="([^"]+)"/.exec(m[0])?.[1] ?? '',
    ]),
  );

  const sheets = new Map<string, string[][]>();
  for (const [tag] of text('xl/workbook.xml').matchAll(/<sheet [^>]*>/g)) {
    const name = decodeXml(/name="([^"]+)"/.exec(tag)?.[1] ?? '');
    const target = targets.get(/r:id="([^"]+)"/.exec(tag)?.[1] ?? '') ?? '';
    const xml = text('xl/' + target.replace(/^\/?xl\//, ''));
    const rows: string[][] = [];
    for (const [, body = ''] of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
      const row: string[] = [];
      for (const cell of body.matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const [, col = 'A', attrs = '', inner = ''] = cell;
        const value = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
        let content = '';
        if (attrs.includes('t="s"') && value !== undefined) content = shared[Number(value)] ?? '';
        else if (attrs.includes('t="inlineStr"')) content = runs(inner);
        else if (value !== undefined) content = decodeXml(value);
        row[columnIndex(col)] = content;
      }
      rows.push(Array.from(row, (c) => c ?? ''));
    }
    sheets.set(name, rows);
  }
  return sheets;
}
