// Keyboard shortcuts that work on any layout, and don't take a key from a focused control.

/**
 * The letter a shortcut key stands for, lowercase. On a Latin layout it is the letter typed (so
 * AZERTY's A is a, and Caps Lock changes nothing); on another (Russian: к) it is the letter of the
 * same key on a US layout (r), from `event.code`.
 */
export function letterOf(event: Pick<KeyboardEvent, 'key' | 'code'>): string {
  const key = event.key.toLowerCase();
  if (/^[a-z]$/.test(key)) return key;
  const physical = /^Key([A-Z])$/.exec(event.code)?.[1];
  return physical ? physical.toLowerCase() : key;
}

/**
 * How focus last moved: a click or tap, or the keyboard (Tab, the arrow keys). `:focus-visible`
 * can't tell them apart here: Chrome turns it on at the very keydown being handled.
 */
let byPointer = true;
if (typeof window !== 'undefined') {
  addEventListener('pointerdown', () => (byPointer = true), true);
  addEventListener(
    'keydown',
    (e) => {
      // Autofill sends keydowns without a key.
      if (typeof e.key === 'string' && (e.key === 'Tab' || e.key.startsWith('Arrow')))
        byPointer = false;
    },
    true,
  );
}

/**
 * A button or link focused with the keyboard: Space and Enter press it rather than standing for a
 * page shortcut. After a click or a tap on it, the shortcut still applies.
 */
export function keyboardFocused(target: EventTarget | null, except?: string): boolean {
  if (byPointer || typeof Element === 'undefined' || !(target instanceof Element)) return false;
  const control = target.closest('button, a[href], [role="button"], [role="radio"]');
  return !!control && !(except && control.matches(except));
}
