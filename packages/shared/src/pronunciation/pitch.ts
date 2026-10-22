// Fundamental frequency (F0) with the YIN algorithm (de Cheveigné & Kawahara, 2002).
// Input: mono PCM samples in [-1, 1]. Output: one frame every `hop` samples.

export interface PitchFrame {
  /** Seconds from the start. */
  time: number;
  /** Hz, or null when the frame is unvoiced or silent. */
  f0: number | null;
  /** Root-mean-square level. */
  rms: number;
}

export interface PitchOptions {
  sampleRate?: number;
  /** Analysis window, samples (default 40 ms). */
  window?: number;
  /** Step between frames, samples (default 10 ms). */
  hop?: number;
  minHz?: number;
  maxHz?: number;
  /** YIN aperiodicity threshold (lower is stricter). */
  threshold?: number;
}

export function trackPitch(samples: Float32Array, options: PitchOptions = {}): PitchFrame[] {
  const sampleRate = options.sampleRate ?? 16000;
  const window = options.window ?? Math.round(sampleRate * 0.04);
  // At least one sample, or the frame loop below would never advance.
  const hop = Math.max(1, options.hop ?? Math.round(sampleRate * 0.01));
  const minLag = Math.floor(sampleRate / (options.maxHz ?? 500));
  const maxLag = Math.ceil(sampleRate / (options.minHz ?? 70));
  const threshold = options.threshold ?? 0.15;

  // Frames quieter than 5% of the loudest are silence.
  const levels: number[] = [];
  for (let start = 0; start + window + maxLag <= samples.length; start += hop) {
    let sum = 0;
    for (let i = start; i < start + window; i++) sum += (samples[i] ?? 0) ** 2;
    levels.push(Math.sqrt(sum / window));
  }
  const loudest = Math.max(1e-9, ...levels);

  const diff = new Float64Array(maxLag + 1);
  const frames: PitchFrame[] = [];
  levels.forEach((rms, index) => {
    const start = index * hop;
    const time = (start + window / 2) / sampleRate;
    if (rms < loudest * 0.05) {
      frames.push({ time, f0: null, rms });
      return;
    }
    // Difference function and its cumulative mean normalized form.
    diff[0] = 1;
    let running = 0;
    let found = -1;
    for (let lag = 1; lag <= maxLag; lag++) {
      let d = 0;
      for (let i = start; i < start + window; i++) {
        const delta = (samples[i] ?? 0) - (samples[i + lag] ?? 0);
        d += delta * delta;
      }
      running += d;
      diff[lag] = running > 0 ? (d * lag) / running : 1;
    }
    for (let lag = minLag; lag <= maxLag; lag++) {
      if ((diff[lag] ?? 1) < threshold) {
        while (lag + 1 <= maxLag && (diff[lag + 1] ?? 1) < (diff[lag] ?? 1)) lag++;
        found = lag;
        break;
      }
    }
    if (found < 0) {
      frames.push({ time, f0: null, rms });
      return;
    }
    // Parabolic interpolation around the minimum for sub-sample precision.
    const a = diff[found - 1] ?? diff[found] ?? 0;
    const b = diff[found] ?? 0;
    const c = diff[found + 1] ?? diff[found] ?? 0;
    const shift = a + c - 2 * b !== 0 ? (a - c) / (2 * (a + c - 2 * b)) : 0;
    frames.push({ time, f0: sampleRate / (found + shift), rms });
  });
  return frames;
}

/** Hz → semitones relative to `reference` Hz. */
export const semitones = (hz: number, reference: number) => 12 * Math.log2(hz / reference);

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? (sorted[mid] ?? 0) : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}
