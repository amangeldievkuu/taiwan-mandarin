// How 墨 turns up on a new page, as Web Animations on the companion's elements: a few steps in
// from the side the new tab is on, down a short rope into a deeper page, or climbing up one on
// the way back. The rope hangs from a little way above 墨's perch (its top end fades out), so
// nothing crosses the page you are reading; a newer entrance cancels an older one mid-way.

import type { Entrance } from './nav';

export interface Rig {
  /** Carries 墨 along: moved and faded by the entrances. */
  mover: HTMLElement;
  /** The rope above 墨's perch; it shows while it has `data-kind`, and stays put while 墨 moves. */
  cord: HTMLElement;
  /** 墨 itself, squashed when it lands. */
  body: HTMLElement;
}

/** How far above the perch the rope hangs from. */
const ROPE = 96;

const EASE_OUT = 'cubic-bezier(0.22, 0.8, 0.24, 1)';
const EASE_IN = 'cubic-bezier(0.5, 0, 0.75, 0)';

let live: Animation[] = [];
let generation = 0;

/** Stops whatever entrance is running and puts 墨 back at its perch. */
export function stopAll(rig?: Rig): void {
  generation++;
  for (const animation of live) animation.cancel();
  live = [];
  if (rig) delete rig.cord.dataset['kind'];
}

/** Runs one animation; resolves true when it finished, false when something newer stopped it. */
async function run(el: HTMLElement, keyframes: Keyframe[], options: KeyframeAnimationOptions) {
  const mine = generation;
  const animation = el.animate(keyframes, options);
  live.push(animation);
  try {
    await animation.finished;
  } catch {
    return false;
  }
  return mine === generation;
}

/** A moment on the rope: 墨 `y` px below its perch, and how visible 墨 and the rope are. */
interface Stop {
  y?: number;
  opacity?: number;
  rope?: number;
  offset?: number;
  easing?: string;
}

/**
 * Moves 墨 along the rope. The rope's top stays where it hangs from and its bottom end follows
 * 墨's head, so it is stretched to match 墨 (on the compositor, in step with it).
 */
async function onRope(rig: Rig, stops: Stop[], options: KeyframeAnimationOptions) {
  rig.cord.style.setProperty('--cord', `${ROPE}px`);
  rig.cord.dataset['kind'] = 'rope';
  const timing = (s: Stop): Keyframe => ({
    ...(s.offset !== undefined && { offset: s.offset }),
    ...(s.easing !== undefined && { easing: s.easing }),
  });
  const mo = stops.map((s) => ({
    ...timing(s),
    ...(s.y !== undefined && { transform: `translateY(${s.y}px)` }),
    ...(s.opacity !== undefined && { opacity: s.opacity }),
  }));
  const rope = stops.map((s) => ({
    ...timing(s),
    ...(s.y !== undefined && { transform: `scaleY(${(ROPE + s.y) / ROPE})` }),
    ...(s.rope !== undefined && { opacity: s.rope }),
  }));
  const done = await Promise.all([run(rig.mover, mo, options), run(rig.cord, rope, options)]);
  return done.every(Boolean);
}

const land = (rig: Rig) =>
  run(
    rig.body,
    [
      { transform: 'none' },
      { transform: 'scale(1.2, 0.8)', offset: 0.3 },
      { transform: 'scale(0.94, 1.06)', offset: 0.65 },
      { transform: 'none' },
    ],
    { duration: 380, easing: 'ease-out' },
  );

/** Lets go: the rope zips back up to where it hangs from. */
async function zipUp(rig: Rig): Promise<boolean> {
  const zipped = await run(
    rig.cord,
    [
      { transform: 'scaleY(1)', opacity: 1 },
      { transform: 'scaleY(0)', opacity: 0 },
    ],
    { duration: 300, delay: 80, easing: EASE_IN },
  );
  if (zipped) delete rig.cord.dataset['kind'];
  return zipped;
}

/** A few steps in from the left or the right, slowing to a stop at the perch. */
function walkIn(rig: Rig, from: 'left' | 'right'): Promise<boolean> {
  const start = from === 'left' ? -36 : 36;
  return run(
    rig.mover,
    [
      { transform: `translateX(${start}px)`, opacity: 0 },
      { opacity: 1, offset: 0.3 },
      { transform: 'none', opacity: 1 },
    ],
    { duration: 460, easing: EASE_OUT },
  );
}

/** Slides down the rope onto the perch, brakes with a couple of bounces, and lands. */
async function rappel(rig: Rig): Promise<boolean> {
  const down = await onRope(
    rig,
    [
      { y: -64, opacity: 0, rope: 0, easing: 'cubic-bezier(0.45, 0, 0.7, 1)' },
      { opacity: 1, rope: 1, offset: 0.18 },
      { y: 6, offset: 0.6, easing: 'ease-out' },
      { y: -4, offset: 0.76, easing: 'ease-in-out' },
      { y: 1.5, offset: 0.89, easing: 'ease-in-out' },
      { y: 0, opacity: 1, rope: 1 },
    ],
    { duration: 850 },
  );
  if (!down) return false;
  void land(rig);
  return zipUp(rig);
}

/** Climbs up the rope from just below the perch, pull by pull, and hops onto it. */
async function climbIn(rig: Rig): Promise<boolean> {
  const up = await onRope(
    rig,
    [
      { y: 32, opacity: 0, rope: 0, easing: EASE_OUT },
      { opacity: 1, rope: 1, offset: 0.15 },
      { y: 21, offset: 0.26 },
      { y: 21, offset: 0.36, easing: EASE_OUT },
      { y: 10, offset: 0.62 },
      { y: 10, offset: 0.7, easing: EASE_OUT },
      { y: -3, offset: 0.92, easing: 'ease-in' },
      { y: 0, opacity: 1, rope: 1 },
    ],
    { duration: 1000 },
  );
  if (!up) return false;
  void land(rig);
  return zipUp(rig);
}

/** Brings 墨 onto the page the way `entrance` says; true once it is sitting at its perch. */
export function arrive(rig: Rig, entrance: Entrance): Promise<boolean> {
  stopAll(rig);
  if (entrance.kind === 'walk') return walkIn(rig, entrance.from);
  if (entrance.kind === 'rappel') return rappel(rig);
  return climbIn(rig);
}

/** Climbs up the rope and out of sight; true once 墨 is gone. */
export function climbAway(rig: Rig): Promise<boolean> {
  stopAll(rig);
  return onRope(
    rig,
    [
      { y: 0, opacity: 1, rope: 0, easing: EASE_OUT },
      { rope: 1, offset: 0.12 },
      { y: -14, offset: 0.25 },
      { y: -14, offset: 0.35, easing: EASE_OUT },
      { y: -30, offset: 0.62 },
      { y: -30, opacity: 1, rope: 1, offset: 0.7, easing: EASE_OUT },
      { y: -48, opacity: 0, rope: 0 },
    ],
    { duration: 800, fill: 'forwards' },
  );
}
