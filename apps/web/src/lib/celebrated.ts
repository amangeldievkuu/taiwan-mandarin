// Which celebrations this device has already shown (a mended bowl, a fresh bowl, a new seal), so
// each one happens once. Kept in localStorage; on the very first run nothing is known yet, and
// what is already true is taken as seen rather than announced.

const KEY = 'taiwan-mandarin:celebrated';

function load(): Set<string> | null {
  try {
    const saved = localStorage.getItem(KEY);
    return saved ? new Set(JSON.parse(saved) as string[]) : null;
  } catch {
    return null;
  }
}

const saved = load();
const known = saved ?? new Set<string>();
let seeding = saved === null;

/** True the first time `key` comes up on this device (false for everything while seeding). */
export function once(key: string): boolean {
  if (known.has(key)) return false;
  known.add(key);
  try {
    localStorage.setItem(KEY, JSON.stringify([...known].slice(-200)));
  } catch {
    // celebrations may repeat in private browsing, nothing worse
  }
  return !seeding;
}

/** The first look at the learner's progress is done; from now on new moments are celebrated. */
export function seeded(): void {
  seeding = false;
}
