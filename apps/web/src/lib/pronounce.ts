// A recording checked on the server: syllables by speech-to-text (Whisper), tones from the pitch
// contour. Signed-in only; each check uses the account's speech quota.
import type { PronounceResult } from '@taiwan-mandarin/shared/api';
import { api } from './api';
import { toWav } from './recorder.svelte';

export async function checkPronunciation(
  recording: Blob,
  target: string,
  pinyin?: string,
): Promise<PronounceResult> {
  const { wav } = await toWav(recording);
  const bytes = new Uint8Array(await wav.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return api<PronounceResult>('/v1/speech/check', {
    method: 'POST',
    body: { audio: btoa(binary), target, ...(pinyin ? { pinyin } : {}) },
  });
}
