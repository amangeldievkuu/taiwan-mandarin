import { describe, expect, it } from 'vitest';
import { trackPitch } from './pitch.ts';
import { surfaceTones } from './sandhi.ts';
import { judgeTone, speakerRange } from './tones.ts';

const RATE = 16000;

/** A voiced sound (fundamental + harmonics) whose pitch follows `hz(t)` over `seconds`. */
function voice(seconds: number, hz: (t: number) => number): Float32Array {
  const out = new Float32Array(Math.round(seconds * RATE));
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    phase += (2 * Math.PI * hz(i / out.length)) / RATE;
    out[i] = 0.5 * Math.sin(phase) + 0.25 * Math.sin(2 * phase) + 0.12 * Math.sin(3 * phase);
  }
  return out;
}

const silence = (seconds: number) => new Float32Array(Math.round(seconds * RATE));

function join(parts: Float32Array[]): Float32Array {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

describe('trackPitch', () => {
  it('measures a steady pitch', () => {
    const frames = trackPitch(voice(0.4, () => 200)).filter((f) => f.f0);
    expect(frames.length).toBeGreaterThan(20);
    for (const f of frames) expect(f.f0).toBeCloseTo(200, -0.5);
  });

  it('follows a rising glide', () => {
    const f0 = trackPitch(voice(0.5, (t) => 150 + 100 * t)).flatMap((f) => (f.f0 ? [f.f0] : []));
    expect(f0[0]).toBeLessThan(170);
    expect(f0.at(-1)).toBeGreaterThan(225);
  });

  it('marks silence as unvoiced', () => {
    const frames = trackPitch(join([voice(0.2, () => 180), silence(0.2)]));
    expect(frames.at(-1)?.f0).toBeNull();
  });

  it('finishes at sample rates too low for a 10 ms hop', () => {
    expect(
      trackPitch(
        voice(0.001, () => 180),
        { sampleRate: 40 },
      ),
    ).toBeInstanceOf(Array);
  });
});

describe('judgeTone', () => {
  it('tells the four tones apart in one utterance (mā má mǎ mà)', () => {
    const syllable = 0.3;
    const gap = 0.08;
    const contours = [
      (t: number) => 255 + 0 * t, // 1: high level
      (t: number) => 175 + 85 * t, // 2: rising
      (t: number) => 165 - 25 * Math.sin(Math.PI * Math.min(t, 0.8)), // 3: low dip
      (t: number) => 270 - 120 * t, // 4: falling
    ];
    const audio = join(contours.flatMap((c) => [voice(syllable, c), silence(gap)]));
    const frames = trackPitch(audio);
    const range = speakerRange(frames);
    const heard = contours.map((_, i) => {
      const start = i * (syllable + gap);
      return judgeTone(frames, { start, end: start + syllable }, range).tone;
    });
    expect(heard).toEqual([1, 2, 3, 4]);
  });

  it('gives up on unvoiced spans', () => {
    const frames = trackPitch(silence(0.5));
    expect(judgeTone(frames, { start: 0, end: 0.5 }, speakerRange(frames)).tone).toBeNull();
  });
});

describe('surfaceTones', () => {
  it.each([
    ['你好', 'ni3 hao3', [2, 3]],
    ['很好', 'hen3 hao3', [2, 3]],
    ['不要', 'bu4 yao4', [2, 4]],
    ['不好', 'bu4 hao3', [4, 3]],
    ['一個', 'yi1 ge4', [2, 4]],
    ['一天', 'yi1 tian1', [4, 1]],
    ['第一', 'di4 yi1', [4, 1]],
    ['十一月', 'shi2 yi1 yue4', [2, 1, 4]],
    ['謝謝', 'xie4 xie5', [4, 5]],
  ])('%s %s', (hanzi, pinyin, expected) => {
    expect(surfaceTones(hanzi, pinyin)).toEqual(expected);
  });
});
