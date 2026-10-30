// The inkstone (硯): what ink unlocks. Ink is never spent; reaching an amount unlocks a look (a pot
// glaze, a seal paste, writing paper, a brush, something for 墨) that the learner may then choose.
// Looks only: nothing here changes how anything is learned.

/** Each slot's looks, the default (what the app always had) first. */
export const SLOTS = {
  pot: ['celadon', 'tenmoku', 'ru', 'jun'],
  paste: ['vermilion', 'indigo', 'gold'],
  paper: ['plain', 'nine', 'xuan'],
  brush: ['vermilion', 'gold'],
  mo: ['plain', 'scarf', 'hat', 'gilt'],
} as const;

export type Slot = keyof typeof SLOTS;
export type LookOf<S extends Slot> = (typeof SLOTS)[S][number];
export type Looks = { [S in Slot]: LookOf<S> };
/** What the learner chose; a slot left out keeps its default. */
export type LookChoices = { [S in Slot]?: LookOf<S> };

export const SLOT_IDS = Object.keys(SLOTS) as Slot[];

export const DEFAULT_LOOKS: Looks = {
  pot: 'celadon',
  paste: 'vermilion',
  paper: 'plain',
  brush: 'vermilion',
  mo: 'plain',
};

export interface Unlock<S extends Slot = Slot> {
  id: string;
  slot: S;
  value: LookOf<S>;
  /** Total ink it takes. */
  at: number;
  zh: string;
  en: string;
}

const unlock = <S extends Slot>(slot: S, value: LookOf<S>, at: number, zh: string, en: string) =>
  ({ id: `${slot}-${value}`, slot, value, at, zh, en }) as Unlock;

/** In the order they come: a normal day of study earns some 500–800 ink. */
export const UNLOCKS: readonly Unlock[] = [
  unlock('paper', 'nine', 500, '九宮格', 'Nine-square paper'),
  unlock('pot', 'tenmoku', 1_000, '天目', 'Tenmoku glaze'),
  unlock('mo', 'scarf', 2_000, '紅線', 'A red string for 墨'),
  unlock('paste', 'indigo', 3_500, '花青', 'Indigo seal paste'),
  unlock('paper', 'xuan', 5_000, '宣紙', 'Rice paper'),
  unlock('pot', 'ru', 7_500, '汝窯', 'Ru glaze'),
  unlock('paste', 'gold', 10_000, '泥金', 'Gold seal paste'),
  unlock('brush', 'gold', 15_000, '金筆', 'Gold brush'),
  unlock('mo', 'hat', 20_000, '斗笠', 'A straw hat for 墨'),
  unlock('pot', 'jun', 30_000, '鈞窯', 'Jun glaze'),
  unlock('mo', 'gilt', 50_000, '金毫', 'A golden brush tip for 墨'),
];

/** Every look's name in Chinese, by `${slot}-${value}` (an unlock's id). */
export const LOOK_ZH: Record<string, string> = {
  'pot-celadon': '青瓷',
  'paste-vermilion': '朱砂',
  'paper-plain': '米字格',
  'brush-vermilion': '朱筆',
  'mo-plain': '墨',
  ...Object.fromEntries(UNLOCKS.map((u) => [u.id, u.zh])),
};

/** The unlock that brings this look, or undefined for a default. */
export const unlockFor = (slot: Slot, value: string): Unlock | undefined =>
  UNLOCKS.find((u) => u.slot === slot && u.value === value);

/** Whether a look is there to choose with this much ink (defaults always are). */
export function isUnlocked(slot: Slot, value: string, ink: number): boolean {
  if (DEFAULT_LOOKS[slot] === value) return true;
  const u = unlockFor(slot, value);
  return !!u && ink >= u.at;
}

/** Everything unlocked with this much ink, in order. */
export const unlockedAt = (ink: number): Unlock[] => UNLOCKS.filter((u) => ink >= u.at);

/** The next thing to unlock, or undefined once everything is. */
export const nextUnlock = (ink: number): Unlock | undefined => UNLOCKS.find((u) => ink < u.at);

/**
 * The looks in use: the learner's choices where they're unlocked, defaults elsewhere (after a
 * progress reset, or a choice synced from a device that had more ink counted).
 */
export function activeLooks(chosen: LookChoices | undefined, ink: number): Looks {
  const looks: Record<string, string> = { ...DEFAULT_LOOKS };
  for (const slot of SLOT_IDS) {
    const value = chosen?.[slot];
    if (value && (SLOTS[slot] as readonly string[]).includes(value) && isUnlocked(slot, value, ink))
      looks[slot] = value;
  }
  return looks as Looks;
}
