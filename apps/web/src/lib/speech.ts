// Text-to-speech with the Web Speech API, preferring a Taiwan Mandarin voice.

const synth: SpeechSynthesis | undefined =
  typeof window !== 'undefined' ? window.speechSynthesis : undefined;

export const canSpeak = synth !== undefined && typeof SpeechSynthesisUtterance !== 'undefined';

let voice: SpeechSynthesisVoice | null = null;

const langOf = (v: Pick<SpeechSynthesisVoice, 'lang'>) => v.lang.replace(/_/g, '-').toLowerCase();
const isTaiwan = (v: Pick<SpeechSynthesisVoice, 'lang'>) =>
  langOf(v) === 'zh-tw' || langOf(v) === 'zh-hant-tw';

/**
 * Whether this device can speak Taiwan Mandarin; null until it has listed its voices. Without one
 * the app falls back to another Chinese voice, whose accent and readings may not be Taiwan's.
 */
export function hasTaiwanVoice(
  voices: readonly Pick<SpeechSynthesisVoice, 'lang'>[] = synth?.getVoices() ?? [],
): boolean | null {
  return voices.length === 0 ? null : voices.some(isTaiwan);
}

let onMissingVoice: (() => void) | null = null;

/** Calls `handler` the first time something is spoken without a Taiwan voice. */
export function onceMissingTaiwanVoice(handler: () => void): void {
  onMissingVoice = handler;
}

function pickVoice(): void {
  if (!synth) return;
  const voices = synth.getVoices();
  const tw = voices.filter(isTaiwan);
  voice =
    tw.find((v) => /mei-?jia/i.test(v.name)) ??
    tw[0] ??
    voices.find((v) => langOf(v).startsWith('zh-hant')) ??
    voices.find((v) => langOf(v).startsWith('zh')) ??
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
  if (onMissingVoice && hasTaiwanVoice() === false) {
    onMissingVoice();
    onMissingVoice = null;
  }
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
