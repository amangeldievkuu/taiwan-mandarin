// Microphone recording with MediaRecorder. Safari records AAC/MP4, Chrome Opus/WebM; `toWav`
// decodes either into 16 kHz mono PCM so the server never needs ffmpeg.

import { t } from './i18n/index.svelte';

/**
 * The longest recording. The server takes 15 seconds; a second under it, since a recorder stops a
 * little after it is told to.
 */
export const MAX_RECORDING_MS = 14_000;

class Recorder {
  recording = $state(false);
  /** Waiting for the microphone (the permission prompt may be open). */
  starting = $state(false);
  error = $state<string | null>(null);
  readonly supported =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined';

  private media: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private startedAt = 0;
  /** Bumped by cancel(), so a start still waiting for the microphone gives it back. */
  private generation = 0;
  private limit: ReturnType<typeof setTimeout> | undefined;

  /** Starts recording. `onLimit` is called at MAX_RECORDING_MS, for the caller to stop it there. */
  async start(onLimit?: () => void): Promise<void> {
    if (this.starting || this.recording) return;
    this.error = null;
    this.starting = true;
    const generation = this.generation;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      });
    } catch {
      this.error = t().speak.blocked;
      return;
    } finally {
      this.starting = false;
    }
    if (generation !== this.generation) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    this.stream = stream;
    this.chunks = [];
    this.media = new MediaRecorder(stream);
    this.media.ondataavailable = (e) => {
      if (e.data.size) this.chunks.push(e.data);
    };
    this.media.start();
    this.startedAt = performance.now();
    this.recording = true;
    if (onLimit) this.limit = setTimeout(onLimit, MAX_RECORDING_MS);
  }

  /** Stops recording; resolves with the audio, or null if nothing usable was captured. */
  stop(): Promise<{ blob: Blob; durationMs: number } | null> {
    const media = this.media;
    if (!media) return Promise.resolve(null);
    // Stopping by hand just as the limit comes would otherwise stop it twice.
    clearTimeout(this.limit);
    this.limit = undefined;
    return new Promise((resolve) => {
      media.onstop = () => {
        this.release();
        const durationMs = performance.now() - this.startedAt;
        const blob = new Blob(this.chunks, { type: media.mimeType || 'audio/webm' });
        resolve(blob.size > 0 && durationMs > 250 ? { blob, durationMs } : null);
      };
      media.stop();
    });
  }

  /** Stops and discards any recording, and gives the microphone back (e.g. leaving the page). */
  cancel(): void {
    this.generation++;
    if (this.media) {
      this.media.onstop = null;
      if (this.media.state !== 'inactive') this.media.stop();
    }
    this.release();
  }

  private release(): void {
    clearTimeout(this.limit);
    this.limit = undefined;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.media = null;
    this.recording = false;
  }
}

export const recorder = new Recorder();

/** Decodes any recording the browser can play into 16 kHz mono 16-bit PCM WAV. */
export async function toWav(
  blob: Blob,
  sampleRate = 16000,
): Promise<{ wav: Blob; samples: Float32Array }> {
  const AudioContextClass =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const context = new AudioContextClass();
  let decoded: AudioBuffer;
  try {
    decoded = await context.decodeAudioData(await blob.arrayBuffer());
  } finally {
    // Also when decoding fails: browsers allow only a few open contexts.
    void context.close();
  }
  const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * sampleRate), sampleRate);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();
  const samples = rendered.getChannelData(0);

  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const text = (offset: number, s: string) =>
    [...s].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) => view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 0x7fff, true));
  return { wav: new Blob([buffer], { type: 'audio/wav' }), samples };
}
