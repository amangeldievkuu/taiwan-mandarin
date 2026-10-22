// Svelte transitions with the app's springs: arrivals spring into place, exits accelerate away.
// Under reduced motion each one does nothing.

import { cubicIn } from 'svelte/easing';
import type { TransitionConfig } from 'svelte/transition';
import { reduced, springOut, springSoft } from './motion';

type Direction = { direction: 'in' | 'out' | 'both' };

const NONE: TransitionConfig = { duration: 0 };

/** The next card, rising from the stack underneath. */
export function cardIn(_node: Element, { delay = 40 }: { delay?: number } = {}): TransitionConfig {
  if (reduced()) return NONE;
  return {
    delay,
    duration: 460,
    easing: springSoft,
    css: (t, u) =>
      `transform: translateY(${u * 26}px) scale(${0.95 + 0.05 * t}); opacity: ${Math.min(1, t * 1.6)}`,
  };
}

/** Where a graded card goes: left for Again, down for Hard, right for Good, up and right for Easy. */
const EXITS: Record<number, [x: number, y: number, turn: number]> = {
  1: [-1, 0.2, -8],
  2: [0, 1, 0],
  3: [1, 0.1, 8],
  4: [0.8, -0.8, 10],
};

/** A graded card leaving. Only the direction differs by grade, never the energy. */
export function cardOut(node: Element, { grade = 3 }: { grade?: number } = {}): TransitionConfig {
  if (reduced()) return NONE;
  const [x, y, turn] = EXITS[grade] ?? [1, 0.1, 8];
  const width = node instanceof HTMLElement ? node.offsetWidth : 400;
  return {
    duration: 280,
    easing: cubicIn,
    css: (t, u) =>
      `transform: translate(${x * u * width * 0.6}px, ${y * u * 180}px) rotate(${turn * u}deg);` +
      `opacity: ${t}; z-index: 2; pointer-events: none`,
  };
}

/** A face replaced in place (a card turning to its answer), tipping forward into view. */
export function flipIn(
  _node: Element,
  { duration = 440 }: { duration?: number } = {},
): TransitionConfig {
  if (reduced()) return NONE;
  return {
    duration,
    easing: springSoft,
    css: (t, u) =>
      `transform: perspective(900px) rotateX(${-u * 55}deg); opacity: ${Math.min(1, t * 2)}`,
  };
}

/** A panel: up from the bottom on phones, in from the right on wider screens. */
export function sheet(
  _node: Element,
  { wide = false }: { wide?: boolean } = {},
  options?: Direction,
): TransitionConfig {
  if (reduced()) return NONE;
  const leaving = options?.direction === 'out';
  return {
    duration: leaving ? 220 : 420,
    easing: leaving ? cubicIn : springSoft,
    css: (t, u) =>
      wide
        ? `transform: translateX(${u * 28}px); opacity: ${t}`
        : `transform: translateY(${u * 100}%)`,
  };
}

/** Popping into place (a badge, a stamp, a new chip). */
export function pop(
  _node: Element,
  { delay = 0, from = 0.6 }: { delay?: number; from?: number } = {},
  options?: Direction,
): TransitionConfig {
  if (reduced()) return NONE;
  const leaving = options?.direction === 'out';
  return {
    delay,
    duration: leaving ? 160 : 520,
    easing: leaving ? cubicIn : springOut,
    css: (t) => `transform: scale(${from + (1 - from) * t}); opacity: ${Math.min(1, t * 2)}`,
  };
}

/** Rising a little as it fades in. */
export function rise(
  _node: Element,
  { delay = 0, y = 12 }: { delay?: number; y?: number } = {},
  options?: Direction,
): TransitionConfig {
  if (reduced()) return NONE;
  const leaving = options?.direction === 'out';
  return {
    delay,
    duration: leaving ? 160 : 460,
    easing: leaving ? cubicIn : springSoft,
    css: (t, u) => `transform: translateY(${u * y}px); opacity: ${Math.min(1, t * 1.5)}`,
  };
}

/** Fading in and out (a backdrop). */
export function fade(
  _node: Element,
  { duration = 200 }: { duration?: number } = {},
): TransitionConfig {
  if (reduced()) return NONE;
  return { duration, css: (t) => `opacity: ${t}` };
}
