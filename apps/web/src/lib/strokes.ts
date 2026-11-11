// Stroke data for hanzi-writer. Characters checked against the Taiwan MOE standard come from
// strokes-tw.json (scripts/build-strokes.ts). Everything else comes from hanzi-writer-data on
// jsDelivr, and the service worker keeps it for offline use.
import type { CharacterJson } from 'hanzi-writer';

/** `tw` is true only when the order is verified against the Taiwan MOE standard. */
export type StrokeData = CharacterJson & { tw: boolean };

const CDN = 'https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0.1/';
let overrides: Promise<Record<string, StrokeData>> | undefined;
const loadOverrides = () =>
  (overrides ??= fetch(`${import.meta.env.BASE_URL}strokes-tw.json`)
    .then((r): Promise<Record<string, StrokeData>> | Record<string, StrokeData> =>
      r.ok ? r.json() : {},
    )
    .catch((): Record<string, StrokeData> => ({})));

/** Loads of this page, so a character asked for twice (prefetched, then drawn) loads once. */
const loads = new Map<string, Promise<StrokeData>>();

export function loadChar(char: string): Promise<StrokeData> {
  let load = loads.get(char);
  if (!load) {
    load = (async () => {
      const verified = (await loadOverrides())[char];
      if (verified) return verified;
      const response = await fetch(`${CDN}${encodeURIComponent(char)}.json`);
      if (!response.ok) throw new Error(`No stroke data for ${char}`);
      return { ...((await response.json()) as CharacterJson), tw: false };
    })();
    // A failure (offline, say) is tried again next time rather than remembered.
    load.catch(() => loads.delete(char));
    loads.set(char, load);
  }
  return load;
}

/** Starts loading these characters' strokes, so their sheets are ready (and kept offline). */
export function prefetchStrokes(chars: Iterable<string>): void {
  for (const char of chars) void loadChar(char).catch(() => undefined);
}

const cssVar = (name: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** hanzi-writer's colors in the current theme, with the brush ink has unlocked. */
export function writerColors(brush: string) {
  const ink = brush === 'gold' ? cssVar('--gold') : cssVar('--seal');
  return {
    strokeColor: cssVar('--ink'),
    outlineColor: cssVar('--stroke-outline'),
    drawingColor: ink,
    highlightColor: ink,
  };
}
