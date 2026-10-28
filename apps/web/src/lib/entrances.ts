// How 墨 turns up on a new page, as Web Animations on the companion's elements: walking in
// from the edge of the screen, rappelling down a rope from the top like special forces, or
// swinging in on a thread and letting go. Each one starts from 墨 sitting at its perch, so it
// measures where that is first; a newer entrance cancels an older one mid-way.

import type { Entrance } from './nav';

export interface Rig {
  /** Carries 墨 (and the cord above it) along: translated or swung by the entrances. */
  mover: HTMLElement;
  /** The rope or thread above 墨's head; `data-kind` says which, and none shows without it. */
  cord: HTMLElement;
  /** 墨 itself, squashed when it lands. */
  body: HTMLElement;
}

let live: Animation[] = [];
let generation = 0;

/** Stops whatever entrance is running and puts 墨 back at its perch. */
export function stopAll(rig?: Rig): void {
  generation++;
  for (const animation of live) animation.cancel();
  live = [];
  if (rig) {
    delete rig.cord.dataset['kind'];
    rig.mover.style.transformOrigin = '';
  }
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

/** Walks in from just past the left or right edge of the screen, at a walking pace. */
async function walkIn(rig: Rig, from: 'left' | 'right'): Promise<boolean> {
  const rect = rig.mover.getBoundingClientRect();
  const start = from === 'left' ? -(rect.right + 12) : innerWidth - rect.left + 12;
  return run(rig.mover, [{ transform: `translateX(${start}px)` }, { transform: 'none' }], {
    duration: Math.min(1800, Math.max(650, Math.abs(start) * 2.2)),
    easing: 'cubic-bezier(0.25, 0.1, 0.3, 1)',
  });
}

/** Drops in from above the screen on a rope, brakes with a couple of bounces, lands, and the
    rope zips back up. */
async function rappel(rig: Rig): Promise<boolean> {
  const rect = rig.mover.getBoundingClientRect();
  rig.cord.style.setProperty('--cord', `${rect.top + 8}px`);
  rig.cord.dataset['kind'] = 'rope';
  const dropped = await run(
    rig.mover,
    [
      { transform: `translateY(${-(rect.bottom + 16)}px)`, easing: 'cubic-bezier(0.5, 0, 0.7, 1)' },
      { transform: 'translateY(9px)', offset: 0.62, easing: 'ease-out' },
      { transform: 'translateY(-7px)', offset: 0.76, easing: 'ease-in-out' },
      { transform: 'translateY(3px)', offset: 0.88, easing: 'ease-in-out' },
      { transform: 'none' },
    ],
    { duration: 1150 },
  );
  if (!dropped) return false;
  void land(rig);
  const zipped = await run(rig.cord, [{ transform: 'scaleY(1)' }, { transform: 'scaleY(0)' }], {
    duration: 320,
    delay: 120,
    easing: 'cubic-bezier(0.5, 0, 0.75, 0)',
  });
  if (zipped) delete rig.cord.dataset['kind'];
  return zipped;
}

/** Swings in on a thread from a point high above, like a pendulum, then lets go and drops the
    last little way onto the perch. */
async function swingIn(rig: Rig): Promise<boolean> {
  const rect = rig.mover.getBoundingClientRect();
  const length = rect.top + 24;
  rig.mover.style.transformOrigin = `50% ${-length}px`;
  rig.cord.style.setProperty('--cord', `${length}px`);
  rig.cord.dataset['kind'] = 'thread';
  const swung = await run(
    rig.mover,
    [
      { transform: 'rotate(72deg)', opacity: 0, easing: 'ease-in' },
      { opacity: 1, offset: 0.08 },
      { transform: 'rotate(-12deg)', offset: 0.5, easing: 'ease-in-out' },
      { transform: 'rotate(5deg)', offset: 0.72, easing: 'ease-in-out' },
      { transform: 'rotate(-1.5deg)', offset: 0.88, easing: 'ease-in-out' },
      { transform: 'none', opacity: 1 },
    ],
    { duration: 1400 },
  );
  rig.mover.style.transformOrigin = '';
  if (!swung) return false;
  // Let go: the thread fades as 墨 lands.
  void land(rig);
  const released = await run(rig.cord, [{ opacity: 1 }, { opacity: 0 }], {
    duration: 260,
    easing: 'ease-out',
  });
  if (released) delete rig.cord.dataset['kind'];
  return released;
}

/** Brings 墨 onto the page the way `entrance` says; true once it is sitting at its perch. */
export function arrive(rig: Rig, entrance: Entrance): Promise<boolean> {
  stopAll(rig);
  if (entrance.kind === 'walk') return walkIn(rig, entrance.from);
  if (entrance.kind === 'rappel') return rappel(rig);
  return swingIn(rig);
}

/** Climbs back up the rope and out of sight; true once 墨 is gone. */
export async function climbAway(rig: Rig): Promise<boolean> {
  stopAll(rig);
  const rect = rig.mover.getBoundingClientRect();
  rig.cord.style.setProperty('--cord', `${rect.top + 8}px`);
  rig.cord.dataset['kind'] = 'rope';
  return run(
    rig.mover,
    [{ transform: 'none' }, { transform: `translateY(${-(rect.bottom + 16)}px)` }],
    { duration: 700, easing: 'cubic-bezier(0.5, 0, 0.75, 0)', fill: 'forwards' },
  );
}
