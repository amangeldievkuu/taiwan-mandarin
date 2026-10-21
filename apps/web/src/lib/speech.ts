// Text-to-speech with the Web Speech API, preferring a Taiwan Mandarin voice.

const synth: SpeechSynthesis | undefined =
  typeof window !== 'undefined' ? window.speechSynthesis : undefined;

export const canSpeak = synth !== undefined && typeof SpeechSynthesisUtterance !== 'undefined';

let voice: SpeechSynthesisVoice | null = null;

function pickVoice(): void {
  if (!synth) return;
  const voices = synth.getVoices();
  const lang = (v: SpeechSynthesisVoice) => v.lang.replace('_', '-').toLowerCase();
  const tw = voices.filter((v) => lang(v) === 'zh-tw');
  voice =
    tw.find((v) => /mei-?jia/i.test(v.name)) ??
    tw[0] ??
    voices.find((v) => lang(v).startsWith('zh-hant')) ??
    voices.find((v) => lang(v).startsWith('zh')) ??
    null;
}

if (synth) {
  pickVoice();
  synth.addEventListener?.('voiceschanged', pickVoice);
}

/**
 * Speaks `text` in Taiwan Mandarin. Resolves true when it finished, false when it was cut off
 * (another `speak`, `stopSpeaking`) or speech is unavailable.
 */
export function speak(text: string, options: { rate?: number } = {}): Promise<boolean> {
  if (!synth || !canSpeak) return Promise.resolve(false);
  return new Promise((resolve) => {
    try {
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-TW';
      utterance.rate = options.rate ?? 0.85;
      if (voice) utterance.voice = voice;
      utterance.onend = () => resolve(true);
      utterance.onerror = () => resolve(false);
      synth.speak(utterance);
    } catch {
      // Some browsers throw when speech is unavailable; audio is optional.
      resolve(false);
    }
  });
}

export function stopSpeaking(): void {
  synth?.cancel();
}
