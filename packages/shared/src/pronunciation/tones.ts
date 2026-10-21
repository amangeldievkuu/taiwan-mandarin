// Tone of a spoken syllable from its pitch contour. Contours are normalized to the speaker's own
// range (from the whole utterance), resampled to five points and compared with a template per
// tone. Approximate by nature: connected speech, voice quality and short syllables blur tones.

import type { Tone } from '../phonetics.ts';
import { median, semitones, type PitchFrame } from './pitch.ts';

/** Normalized pitch (0 = speaker's low, 1 = speaker's high) at five evenly spaced points. */
export const TONE_TEMPLATES: Record<1 | 2 | 3 | 4, number[]> = {
  1: [0.85, 0.85, 0.85, 0.85, 0.85],
  2: [0.4, 0.45, 0.58, 0.75, 0.9],
  // Taiwan Mandarin's third tone is mostly low (falling), rarely the full dip.
  3: [0.35, 0.2, 0.1, 0.1, 0.18],
  4: [0.95, 0.82, 0.6, 0.38, 0.18],
};

export interface SyllableSpan {
  start: number;
  end: number;
}

export interface ToneJudgement {
  /** Most likely tone, or null when there wasn't enough voiced signal. */
  tone: 1 | 2 | 3 | 4 | null;
  /** Normalized contour (0–1), five points, for drawing. */
  contour: number[];
  /** 0–1: how clearly the best template beat the second best. */
  confidence: number;
}

/** Speaker reference and range in semitones from all voiced frames. */
export function speakerRange(frames: readonly PitchFrame[]): {
  reference: number;
  low: number;
  high: number;
} {
  const voiced = frames.flatMap((f) => (f.f0 ? [f.f0] : []));
  const reference = median(voiced) || 150;
  const st = voiced.map((f) => semitones(f, reference)).sort((a, b) => a - b);
  const pick = (q: number) =>
    st[Math.min(st.length - 1, Math.max(0, Math.round(q * (st.length - 1))))] ?? 0;
  let low = pick(0.1);
  let high = pick(0.9);
  // A narrow range (one syllable, a monotone): assume a typical 8-semitone speaking range.
  if (high - low < 5) {
    const mid = (high + low) / 2;
    low = mid - 4;
    high = mid + 4;
  }
  return { reference, low, high };
}

/** Removes octave jumps and smooths with a 5-frame median. */
export function cleanContour(values: readonly number[]): number[] {
  const out = values.map((v, i) => {
    const around = values.slice(Math.max(0, i - 2), i + 3);
    const m = median(around);
    return Math.abs(v - m) > 6 ? m : v;
  });
  return out.map((_, i) => median(out.slice(Math.max(0, i - 2), i + 3)));
}

function resample(values: readonly number[], points: number): number[] {
  if (values.length === 0) return [];
  return Array.from({ length: points }, (_, i) => {
    const at = (i / (points - 1)) * (values.length - 1);
    const lo = Math.floor(at);
    const hi = Math.min(values.length - 1, lo + 1);
    const t = at - lo;
    return (values[lo] ?? 0) * (1 - t) + (values[hi] ?? 0) * t;
  });
}

export function judgeTone(
  frames: readonly PitchFrame[],
  span: SyllableSpan,
  range: ReturnType<typeof speakerRange>,
): ToneJudgement {
  const inside = frames.filter((f) => f.time >= span.start && f.time <= span.end && f.f0);
  if (inside.length < 4) return { tone: null, contour: [], confidence: 0 };
  const st = cleanContour(inside.map((f) => semitones(f.f0 ?? range.reference, range.reference)));
  const normalized = st.map((v) =>
    Math.max(-0.2, Math.min(1.2, (v - range.low) / (range.high - range.low))),
  );
  const contour = resample(normalized, 5);

  const scores = ([1, 2, 3, 4] as const).map((tone) => {
    const template = TONE_TEMPLATES[tone];
    const shape =
      contour.reduce((sum, v, i) => sum + (v - (template[i] ?? 0)) ** 2, 0) / contour.length;
    return { tone, score: shape };
  });
  scores.sort((a, b) => a.score - b.score);
  const [best, second] = scores;
  const confidence =
    best && second ? Math.min(1, (second.score - best.score) / (second.score + 1e-6)) : 0;
  return { tone: best?.tone ?? null, contour, confidence };
}

/** Does the heard tone match the expected surface tone? Neutral tones are never marked wrong. */
export function toneMatches(expected: Tone, heard: 1 | 2 | 3 | 4 | null): boolean | null {
  if (expected === 5 || heard === null) return null;
  return expected === heard;
}
