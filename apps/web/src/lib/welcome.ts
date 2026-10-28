// Whether to show the welcome page instead of Today: only to someone who has never used the app
// here (no cards, no deck, no remembered account) and has not been welcomed before.

const WELCOMED_KEY = 'taiwan-mandarin:welcomed';

export interface WelcomeState {
  cards: number;
  deck: number;
  /** A remembered account on this device. */
  user: boolean;
  /** The flag set when the welcome page was left for the app. */
  welcomed: boolean;
}

export const shouldWelcome = (s: WelcomeState): boolean =>
  !s.welcomed && !s.user && s.cards === 0 && s.deck === 0;

export function wasWelcomed(): boolean {
  try {
    return localStorage.getItem(WELCOMED_KEY) === '1';
  } catch {
    return true;
  }
}

export function markWelcomed(): void {
  try {
    localStorage.setItem(WELCOMED_KEY, '1');
  } catch {
    // nothing to remember it in: the page shows again next time, which is harmless
  }
}
