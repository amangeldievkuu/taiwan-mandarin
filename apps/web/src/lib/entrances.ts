// How 墨 turns up on a new page, as Web Animations on the companion's elements: a few steps in
// from the side the new tab is on, a drip down into a deeper page, or a hop up on the way back.
// Each one stays a short way from 墨's perch and fades in, so it never crosses the page you are
// reading; a newer entrance cancels an older one mid-way.

import type { Entrance } from './nav';

export interface Rig {
  /** Carries 墨 along: moved and faded by the entrances. */
  mover: HTMLElement;
  /** 墨 itself, squashed when it lands. */
  body: HTMLElement;
}

let live: Animation[] = [];
let generation = 0;

/** Stops whatever entrance is running and puts 墨 back at its perch. */
export function stopAll(): void {
  generation++;
  for (const animation of live) animation.cancel();
  live = [];
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

const EASE_OUT = 'cubic-bezier(0.22, 0.8, 0.24, 1)';
const EASE_IN = 'cubic-bezier(0.5, 0, 0.75, 0)';

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

/** Drips down the last little way onto the perch and splats. */
async function dropIn(rig: Rig): Promise<boolean> {
  const dropped = await run(
    rig.mover,
    [
      { transform: 'translateY(-28px)', opacity: 0 },
      { opacity: 1, offset: 0.35 },
      { transform: 'none', opacity: 1 },
    ],
    { duration: 320, easing: EASE_IN },
  );
  // Sits down as it splats, rather than after.
  if (dropped) void land(rig);
  return dropped;
}

/** Hops up from just below the perch and lands on it. */
async function riseIn(rig: Rig): Promise<boolean> {
  const risen = await run(
    rig.mover,
    [
      { transform: 'translateY(16px)', opacity: 0, easing: EASE_OUT },
      { transform: 'translateY(-8px)', opacity: 1, offset: 0.55, easing: EASE_IN },
      { transform: 'none', opacity: 1 },
    ],
    { duration: 440 },
  );
  if (risen) void land(rig);
  return risen;
}

/** Brings 墨 onto the page the way `entrance` says; true once it is sitting at its perch. */
export function arrive(rig: Rig, entrance: Entrance): Promise<boolean> {
  stopAll();
  if (entrance.kind === 'walk') return walkIn(rig, entrance.from);
  if (entrance.kind === 'drop') return dropIn(rig);
  return riseIn(rig);
}

/** Hops up and out of sight; true once 墨 is gone. */
export function hopAway(rig: Rig): Promise<boolean> {
  stopAll();
  return run(
    rig.mover,
    [
      { transform: 'none', opacity: 1 },
      { transform: 'translateY(-16px)', opacity: 0 },
    ],
    { duration: 240, easing: EASE_IN, fill: 'forwards' },
  );
}
