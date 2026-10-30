// Errors the API sends a learner, by stable code, in English. A body carries both ({ message, code,
// params? }), so an app shows the code in its own language and anything else as written.

export const ERRORS = {
  // Validation (the shared schemas use these wordings)
  invalidEmail: 'Enter a valid email address',
  emailTooLong: 'That email is too long',
  passwordTooShort: 'Use at least 8 characters for the password',
  passwordTooLong: 'That password is too long',
  nameEmpty: 'Enter a name, or leave it empty',
  nameTooLong: 'That name is too long',
  passwordMissing: 'Enter your password',
  currentPasswordMissing: 'Enter your current password',
  samePassword: 'The new password is the same as the current one',
  textOrImage: 'Send text or an image',
  // Accounts
  emailTaken: 'An account with this email already exists',
  wrongLogin: 'Wrong email or password',
  notSignedIn: 'Not signed in',
  sessionExpired: 'Session expired',
  wrongPassword: 'The current password is wrong',
  // Limits
  tooManyAttempts: 'Too many attempts. Wait a minute and try again.',
  dailyLimit: 'Daily limit reached ({limit}). It resets tomorrow.',
  // AI
  aiNotSetUp: 'AI features are not set up on this server (OPENAI_API_KEY).',
  aiMisconfigured: 'AI features are not set up correctly on this server.',
  aiCutOff: 'The AI answer was cut off. Try again.',
  aiTimeout: 'The AI took too long. Try again.',
  aiUnreachable: "Couldn't reach the AI service. Try again.",
  aiUnavailable: "The AI isn't available right now.",
  aiBusy: 'The AI is busy right now. Try again in a minute.',
  aiFailed: 'The AI service failed. Try again.',
  photoUnreadable: "The photo couldn't be read. Try another one.",
  conversationMissing: 'No such conversation',
  conversationEnded: 'This conversation has ended.',
  // Pronunciation
  audioUnreadable: 'Unreadable audio',
  recordingTooLong: 'Keep recordings under 15 seconds',
  noSpeech: "Didn't catch any speech. Try again a little closer to the microphone.",
  speechTimeout: 'Speech recognition took too long. Try again.',
  speechBusy: 'Speech recognition is busy. Try again in a minute.',
  speechFailed: 'Speech recognition failed. Try again.',
  // Reminders
  remindersNotSetUp: 'Reminders are not set up on this server (VAPID_PUBLIC_KEY).',
  // Anything else
  unexpected: 'Something went wrong. Try again.',
} as const;

export type ApiErrorCode = keyof typeof ERRORS;

export type ErrorParams = Record<string, string | number>;

/** "Daily limit reached ({limit})…" with its parameters filled in. */
export const fillParams = (text: string, params: ErrorParams = {}): string =>
  text.replace(/\{(\w+)\}/g, (all, key: string) => String(params[key] ?? all));

/** An error body for HttpException: the English wording, the code and its parameters. */
export function apiError(
  code: ApiErrorCode,
  params?: ErrorParams,
): { message: string; code: ApiErrorCode; params?: ErrorParams } {
  return { message: fillParams(ERRORS[code], params), code, ...(params ? { params } : {}) };
}

const BY_MESSAGE = new Map(
  (Object.entries(ERRORS) as [ApiErrorCode, string][]).map(([code, message]) => [message, code]),
);

/** The code of a schema's message, for validation errors. */
export const errorCodeOf = (message: string): ApiErrorCode | undefined => BY_MESSAGE.get(message);
