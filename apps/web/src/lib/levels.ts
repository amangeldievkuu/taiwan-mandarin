// The levels a learner studies (settings.levels): kept in path order, never empty.
import { LEVEL_IDS, type Level } from '@taiwan-mandarin/shared';

/** The levels with `level` turned on or off, in path order; null when that would leave none. */
export function toggledLevels(levels: readonly Level[], level: Level): Level[] | null {
  const on = levels.includes(level);
  const next = LEVEL_IDS.filter((l) => (l === level ? !on : levels.includes(l)));
  return next.length ? next : null;
}

/** The furthest level along the path among `levels` (saved in any order by older versions). */
export function highestLevel(levels: readonly Level[]): Level | undefined {
  return LEVEL_IDS.findLast((l) => levels.includes(l));
}
