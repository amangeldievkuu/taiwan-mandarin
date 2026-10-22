// Motion shared by the components: whether to move at all, the springs the CSS uses (as easing
// for Svelte transitions and the Web Animations API), and FLIP for elements whose place changes.

import { prefersReducedMotion } from 'svelte/motion';

/** The learner asked their system for less motion. */
export const reduced = (): boolean => prefersReducedMotion.current;

/** A damped spring's step response, 0 → 1 with a little overshoot. */
function spring(damping: number, frequency: number): (t: number) => number {
  const ringing = frequency * Math.sqrt(1 - damping * damping);
  const ratio = damping / Math.sqrt(1 - damping * damping);
  return (t) =>
    t >= 1
      ? 1
      : 1 -
        Math.exp(-damping * frequency * t) *
          (Math.cos(ringing * t) + ratio * Math.sin(ringing * t));
}

/** About 12% overshoot, like --ease-spring in app.css. */
export const springOut = spring(0.55, 10.5);
/** About 5% overshoot, like --ease-spring-soft. */
export const springSoft = spring(0.7, 10);

const linearSupported =
  typeof CSS !== 'undefined' && CSS.supports('transition-timing-function', 'linear(0, 1)');

/** --ease-spring-soft as an easing string for element.animate(). */
export const EASE_SPRING_SOFT = linearSupported
  ? `linear(${Array.from({ length: 25 }, (_, i) => springSoft(i / 24).toFixed(3)).join(', ')})`
  : 'cubic-bezier(0.3, 1.25, 0.6, 1)';

/**
 * Glides `el` from where it was (`first`, measured before the change) to where it is now, so a
 * layout change moves instead of jumping.
 */
export function flipFrom(el: Element, first: DOMRect, duration = 420): Animation | null {
  if (reduced()) return null;
  const last = el.getBoundingClientRect();
  const dx = first.left - last.left;
  const dy = first.top - last.top;
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return null;
  return el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
    duration,
    easing: EASE_SPRING_SOFT,
  });
}
