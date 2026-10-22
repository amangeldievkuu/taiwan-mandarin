// Minimal WAV reader for the 16-bit PCM the web app sends (it decodes and resamples in the browser,
// so the server never needs ffmpeg).

export interface Pcm {
  samples: Float32Array;
  sampleRate: number;
}

/** The only format the web app sends; anything else is refused before any analysis. */
export const WAV_RATE = 16000;

export function readWav(buffer: Buffer): Pcm {
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Not a WAV file');
  }
  let offset = 12;
  let sampleRate = 0;
  let channels = 1;
  let bits = 16;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === 'fmt ') {
      if (size < 16 || body + 16 > buffer.length) throw new Error('Broken WAV header');
      if (buffer.readUInt16LE(body) !== 1) throw new Error('Only PCM WAV is supported');
      channels = buffer.readUInt16LE(body + 2);
      sampleRate = buffer.readUInt32LE(body + 4);
      bits = buffer.readUInt16LE(body + 14);
    } else if (id === 'data') {
      if (bits !== 16 || channels !== 1 || sampleRate !== WAV_RATE)
        throw new Error(`Expected 16-bit mono PCM at ${WAV_RATE} Hz`);
      const end = Math.min(buffer.length, body + size);
      const frames = Math.floor((end - body) / (2 * channels));
      const samples = new Float32Array(frames);
      for (let i = 0; i < frames; i++)
        samples[i] = buffer.readInt16LE(body + i * 2 * channels) / 32768;
      return { samples, sampleRate };
    }
    offset = body + size + (size % 2);
  }
  throw new Error('WAV has no audio data');
}
