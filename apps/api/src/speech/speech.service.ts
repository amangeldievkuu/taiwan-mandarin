// Pronunciation check: what was said (speech-to-text) against what was meant, syllable by
// syllable, and the tone of each syllable from its pitch contour, judged against the tones
// expected after sandhi. Tone judgements are approximate and reported as such.

import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  judgeTone,
  speakerRange,
  splitSyllables,
  surfaceTones,
  toneMatches,
  trackPitch,
  type PitchFrame,
  type SyllableSpan,
} from '@taiwan-mandarin/shared';
import type {
  PronounceRequest,
  PronounceResult,
  SyllableResult,
} from '@taiwan-mandarin/shared/api';
import { toTaiwanCharacters } from '@taiwan-mandarin/shared/taiwan-standard';
import { ContentService } from '../content/content.service.js';
import { readWav } from './wav.js';
import { WhisperService, type Transcript } from './whisper.service.js';

const HAN = /\p{Script=Han}/u;
const toneless = (p: string) => p.replace(/[1-5]/g, '');

/** Edit-distance alignment: for each target index, the index in `heard` it lines up with. */
export function align(target: readonly string[], heard: readonly string[]): (number | null)[] {
  const n = target.length;
  const m = heard.length;
  const width = m + 1;
  const cost = new Int32Array((n + 1) * width);
  const at = (i: number, j: number) => cost[i * width + j] ?? 0;
  for (let i = 0; i <= n; i++) cost[i * width] = i;
  for (let j = 0; j <= m; j++) cost[j] = j;
  const sub = (i: number, j: number) => (target[i - 1] === heard[j - 1] ? 0 : 1);
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      cost[i * width + j] = Math.min(
        at(i - 1, j) + 1,
        at(i, j - 1) + 1,
        at(i - 1, j - 1) + sub(i, j),
      );
    }
  }
  const result: (number | null)[] = Array.from({ length: n }, () => null);
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    if (at(i, j) === at(i - 1, j - 1) + sub(i, j)) {
      result[i - 1] = j - 1;
      i--;
      j--;
    } else if (at(i, j) === at(i - 1, j) + 1) i--;
    else j--;
  }
  return result;
}

@Injectable()
export class SpeechService {
  constructor(
    @Inject(WhisperService) private readonly whisper: WhisperService,
    @Inject(ContentService) private readonly content: ContentService,
  ) {}

  /**
   * Everything that can fail without a paid call is checked first; `charge` (the daily quota)
   * runs only once the recording is worth sending.
   */
  async check(
    request: PronounceRequest,
    charge: () => Promise<void> = async () => {},
  ): Promise<PronounceResult> {
    const wav = Buffer.from(request.audio, 'base64');
    let pcm;
    try {
      pcm = readWav(wav);
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : 'Unreadable audio');
    }
    if (pcm.samples.length / pcm.sampleRate > 15)
      throw new BadRequestException('Keep recordings under 15 seconds');
    this.target(request);
    if (peak(pcm.samples) < SILENCE) {
      throw new BadRequestException(
        "Didn't catch any speech. Try again a little closer to the microphone.",
      );
    }
    await charge();

    // Pitch tracking is CPU work: do it while the transcription request is on its way.
    const transcribing = this.whisper.transcribe(wav);
    transcribing.catch(() => undefined); // awaited below
    await new Promise((resolve) => setImmediate(resolve));
    const frames = trackPitch(pcm.samples, { sampleRate: pcm.sampleRate });
    return this.analyze(request, pcm, await transcribing, frames);
  }

  /** The target's characters and reading, one syllable per character. */
  private target(request: PronounceRequest): { chars: string[]; pinyin: string } {
    const chars = [...request.target].filter((c) => HAN.test(c));
    const pinyin = request.pinyin ?? this.readingOf(request.target);
    if (!chars.length || !pinyin || splitSyllables(pinyin).length !== chars.length) {
      throw new BadRequestException('Need a reading with one syllable per character');
    }
    return { chars, pinyin };
  }

  /** Separate from `check` so it can be tested with a known transcript. */
  analyze(
    request: PronounceRequest,
    pcm: { samples: Float32Array; sampleRate: number },
    transcript: Transcript,
    frames: PitchFrame[] = trackPitch(pcm.samples, { sampleRate: pcm.sampleRate }),
  ): PronounceResult {
    const { chars, pinyin } = this.target(request);
    const syllables = splitSyllables(pinyin);
    // The text as written, so its punctuation counts as pauses.
    const expected = surfaceTones(request.target, pinyin);

    // What was heard, in Taiwan characters, with a time span per character.
    const heardText = toTaiwanCharacters(transcript.text);
    const heard: { char: string; span: SyllableSpan | null }[] = [];
    const wordChars = transcript.words.flatMap((w) => {
      const cs = [...toTaiwanCharacters(w.word)].filter((c) => HAN.test(c));
      const step = (w.end - w.start) / Math.max(1, cs.length);
      return cs.map((char, k) => ({
        char,
        span: { start: w.start + k * step, end: w.start + (k + 1) * step },
      }));
    });
    const plainHeard = [...heardText].filter((c) => HAN.test(c));
    if (wordChars.length === plainHeard.length && wordChars.every((w) => w.span.end > w.span.start))
      heard.push(...wordChars);
    else heard.push(...plainHeard.map((char) => ({ char, span: null })));

    const range = speakerRange(frames);
    const fallback = evenSpans(frames, chars.length);
    const matched = align(
      chars,
      heard.map((h) => h.char),
    );

    const results: SyllableResult[] = chars.map((char, i) => {
      const at = matched[i];
      const h = at === null || at === undefined ? undefined : heard[at];
      const sound: SyllableResult['sound'] = !h
        ? 'missing'
        : h.char === char || this.sameSound(h.char, syllables[i] ?? '')
          ? 'ok'
          : 'wrong';
      const span = h?.span ?? fallback[i];
      const judged = span
        ? judgeTone(frames, span, range)
        : { tone: null, contour: [], confidence: 0 };
      const expectedTone = expected[i] ?? 5;
      const match = toneMatches(expectedTone, judged.confidence < 0.08 ? null : judged.tone);
      return {
        char,
        pinyin: syllables[i] ?? '',
        expectedTone,
        ...(h ? { heard: h.char } : {}),
        sound,
        tone: expectedTone === 5 ? 'neutral' : match === null ? 'unclear' : match ? 'ok' : 'wrong',
        ...(judged.tone ? { heardTone: judged.tone } : {}),
        contour: judged.contour.map((v) => Math.round(v * 100) / 100),
      };
    });

    const points = results.map(
      (r) =>
        (r.sound === 'ok' ? 0.5 : 0) +
        (r.tone === 'ok' || r.tone === 'neutral' ? 0.5 : r.tone === 'unclear' ? 0.25 : 0),
    );
    const score = Math.round(
      (100 * points.reduce((a, b) => a + b, 0)) / Math.max(1, points.length),
    );
    return { transcript: heardText, syllables: results, score };
  }

  private readingOf(text: string): string | undefined {
    const syllables = this.content
      .segment(text)
      .flatMap((t) => (t.han ? [t.word?.pinyin ?? t.entry?.p] : []));
    return syllables.every(Boolean) ? syllables.join(' ') : undefined;
  }

  /** Speech-to-text may pick a homophone (在 for 再): same syllable means the sound was right. */
  private sameSound(heardChar: string, targetSyllable: string): boolean {
    return this.content.lookup(heardChar).some((e) => toneless(e.p) === toneless(targetSyllable));
  }
}

/** Peak level below this (about -40 dBFS) is silence or room noise, not speech. */
const SILENCE = 0.01;

function peak(samples: Float32Array): number {
  let max = 0;
  for (const s of samples) max = Math.max(max, Math.abs(s));
  return max;
}

/** Without timestamps: the voiced stretch, split evenly. */
function evenSpans(frames: readonly PitchFrame[], count: number): SyllableSpan[] {
  const voiced = frames.filter((f) => f.f0);
  const start = voiced[0]?.time ?? 0;
  const end = voiced.at(-1)?.time ?? 0;
  const step = (end - start) / Math.max(1, count);
  return Array.from({ length: count }, (_, i) => ({
    start: start + i * step,
    end: start + (i + 1) * step,
  }));
}
