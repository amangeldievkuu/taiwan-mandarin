// Microphone recording with MediaRecorder. Safari records AAC/MP4, Chrome Opus/WebM; `toWav`
// decodes either into 16 kHz mono PCM so the server never needs ffmpeg.

class Recorder {
  recording = $state(false);
  error = $state<string | null>(null);
  readonly supported =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined';

  private media: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private startedAt = 0;

  async start(): Promise<void> {
    this.error = null;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      });
    } catch {
      this.error = 'Microphone access was blocked. Allow it in your browser settings to record.';
      return;
    }
    this.chunks = [];
    this.media = new MediaRecorder(this.stream);
    this.media.ondataavailable = (e) => {
      if (e.data.size) this.chunks.push(e.data);
    };
    this.media.start();
    this.startedAt = performance.now();
    this.recording = true;
  }

  /** Stops recording; resolves with the audio, or null if nothing usable was captured. */
  stop(): Promise<{ blob: Blob; durationMs: number } | null> {
    const media = this.media;
    if (!media) return Promise.resolve(null);
    return new Promise((resolve) => {
      media.onstop = () => {
        this.stream?.getTracks().forEach((t) => t.stop());
        this.stream = null;
        this.media = null;
        this.recording = false;
        const durationMs = performance.now() - this.startedAt;
        const blob = new Blob(this.chunks, { type: media.mimeType || 'audio/webm' });
        resolve(blob.size > 0 && durationMs > 250 ? { blob, durationMs } : null);
      };
      media.stop();
    });
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
  const decoded = await context.decodeAudioData(await blob.arrayBuffer());
  void context.close();
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
