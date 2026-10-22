// Sound and touch feedback: short chimes made with Web Audio (no audio files), on the pentatonic
// scale, and vibration where the device has it (Android; iPhones have no vibration API). Both are
// per-device choices; sound is on by default. Every grade sounds the same: Again is never a buzzer.

export type Cue = 'grade' | 'xp' | 'complete' | 'mend' | 'stamp' | 'toggle';
type Buzz = 'light' | 'success' | 'mend';

const SOUND_KEY = 'taiwan-mandarin:sound';
const HAPTICS_KEY = 'taiwan-mandarin:haptics';

const VIBRATION: Record<Buzz, number | number[]> = {
  light: 8,
  success: [12, 60, 18],
  mend: [10, 40, 10, 40, 30],
};

function readFlag(key: string, fallback: boolean): boolean {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value === '1';
  } catch {
    return fallback;
  }
}

function writeFlag(key: string, on: boolean): void {
  try {
    localStorage.setItem(key, on ? '1' : '0');
  } catch {
    // per-device preference only
  }
}

interface Note {
  freq: number;
  /** Seconds from now. */
  at?: number;
  length: number;
  volume?: number;
  type?: OscillatorType;
  /** Slide to this frequency. */
  to?: number;
}

class Feedback {
  sound = $state(readFlag(SOUND_KEY, true));
  haptics = $state(readFlag(HAPTICS_KEY, true));
  readonly canVibrate = typeof navigator !== 'undefined' && 'vibrate' in navigator;
  private context: AudioContext | null = null;
  private output: AudioNode | null = null;

  /** Browsers only start audio from a tap or a key: get it ready on the first one. */
  init(): () => void {
    const unlock = () => void this.audio();
    const hidden = () => {
      if (document.visibilityState === 'hidden') void this.context?.suspend().catch(() => {});
    };
    addEventListener('pointerdown', unlock, { capture: true, passive: true });
    addEventListener('keydown', unlock, { capture: true });
    document.addEventListener('visibilitychange', hidden);
    return () => {
      removeEventListener('pointerdown', unlock, { capture: true });
      removeEventListener('keydown', unlock, { capture: true });
      document.removeEventListener('visibilitychange', hidden);
    };
  }

  setSound(on: boolean): void {
    this.sound = on;
    writeFlag(SOUND_KEY, on);
    if (on) this.play('toggle');
  }

  setHaptics(on: boolean): void {
    this.haptics = on;
    writeFlag(HAPTICS_KEY, on);
    if (on) this.buzz('light');
  }

  buzz(kind: Buzz): void {
    if (this.haptics && this.canVibrate) navigator.vibrate(VIBRATION[kind]);
  }

  play(cue: Cue): void {
    if (!this.sound) return;
    const audio = this.audio();
    if (!audio) return;
    const note = (n: Note) => this.note(audio, n);
    switch (cue) {
      case 'grade':
        note({ freq: 660, to: 990, length: 0.09, volume: 0.16 });
        break;
      case 'xp':
        note({ freq: 1318.5, length: 0.07, volume: 0.09, type: 'sine' });
        note({ freq: 1760, at: 0.06, length: 0.09, volume: 0.09, type: 'sine' });
        break;
      case 'complete':
        // C E G C, then a little shimmer.
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) =>
          note({ freq, at: i * 0.09, length: 0.42, volume: 0.18 }),
        );
        note({ freq: 2093, at: 0.36, length: 0.6, volume: 0.05, type: 'sine' });
        break;
      case 'mend':
        // A singing bowl: a low C with its uneven overtones, and a glint of gold on top.
        [
          [1, 0.2],
          [2, 0.09],
          [2.76, 0.06],
          [5.4, 0.03],
        ].forEach(([ratio = 1, volume = 0.1]) =>
          note({ freq: 523.25 * ratio, length: 1.8, volume, type: 'sine' }),
        );
        note({ freq: 1568, to: 2093, at: 0.18, length: 0.5, volume: 0.05, type: 'sine' });
        break;
      case 'stamp':
        note({ freq: 150, to: 70, length: 0.2, volume: 0.3, type: 'sine' });
        break;
      case 'toggle':
        note({ freq: 1200, length: 0.04, volume: 0.06, type: 'sine' });
        break;
    }
  }

  /** The audio context, created on first use and resumed when the browser paused it. */
  private audio(): { context: AudioContext; output: AudioNode } | null {
    if (!this.sound || typeof AudioContext === 'undefined') return null;
    if (!this.context || !this.output) {
      const context = new AudioContext();
      const gain = context.createGain();
      gain.gain.value = 0.5;
      const soften = context.createBiquadFilter();
      soften.type = 'lowpass';
      soften.frequency.value = 6000;
      gain.connect(soften).connect(context.createDynamicsCompressor()).connect(context.destination);
      this.context = context;
      this.output = gain;
    }
    if (this.context.state !== 'running') void this.context.resume().catch(() => {});
    return { context: this.context, output: this.output };
  }

  /** One note: a quick attack and an exponential fade. */
  private note(
    { context, output }: { context: AudioContext; output: AudioNode },
    { freq, at = 0, length, volume = 0.2, type = 'triangle', to }: Note,
  ): void {
    const start = context.currentTime + 0.01 + at;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, start);
    if (to) oscillator.frequency.exponentialRampToValueAtTime(to, start + length * 0.8);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(volume, start + 0.006);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + length);
    oscillator.connect(envelope).connect(output);
    oscillator.start(start);
    oscillator.stop(start + length + 0.05);
  }
}

export const feedback = new Feedback();
