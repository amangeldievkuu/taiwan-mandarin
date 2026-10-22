// Little celebrations anywhere in the app: "+10" rising from a button, and bursts of plum-blossom
// petals (梅花) or gold dust. Components call these; <Celebrations> in App draws them.

import { reduced } from './motion';

export interface Float {
  id: number;
  x: number;
  y: number;
  text: string;
}

export interface Burst {
  id: number;
  kind: 'party' | 'gold';
  /** Where it comes from, in viewport pixels; the top centre when missing. */
  x?: number;
  y?: number;
}

let next = 0;

class Celebrate {
  floats = $state<Float[]>([]);
  bursts = $state<Burst[]>([]);

  /** "+10" rising from an element. */
  float(from: DOMRect, text: string): void {
    if (reduced()) return;
    this.floats = [
      ...this.floats,
      { id: next++, x: from.left + from.width / 2, y: from.top, text },
    ].slice(-8);
  }

  done(id: number): void {
    this.floats = this.floats.filter((f) => f.id !== id);
  }

  burst(kind: Burst['kind'], from?: DOMRect): void {
    if (reduced()) return;
    this.bursts = [
      ...this.bursts,
      {
        id: next++,
        kind,
        ...(from ? { x: from.left + from.width / 2, y: from.top + from.height / 2 } : {}),
      },
    ];
  }

  burstDone(id: number): void {
    this.bursts = this.bursts.filter((b) => b.id !== id);
  }
}

export const celebrate = new Celebrate();
