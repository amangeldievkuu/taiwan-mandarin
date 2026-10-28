// The drawing of the streak plant: a plum tree (梅, Taiwan's national flower) in a celadon pot
// mended with gold. It grows a little every day practiced and blossoms from 30 days. Everything
// comes from seeds (the bowl's start date, a seam's dates) rather than from chance, so the same
// streak looks the same on every device, and tomorrow's plant is today's with a little more.

import type { Bowl, Seam } from '@taiwan-mandarin/shared';

/** The pot in a 120 × 120 box: a rim band on top of a tapering body. */
export const POT_BODY =
  'M28 74 Q28 72 30 72 L90 72 Q92 72 92 74 L92 81 Q92 83 90 83 L87 83 L81 111 Q80.4 113 78 113 ' +
  'L42 113 Q39.6 113 39 111 L33 83 L30 83 Q28 83 28 81 Z';
export const POT_RIM = { x: 28, y: 72, width: 64, height: 11 };
/** Where the plant comes out of the soil. */
export const SOIL = { cx: 60, cy: 72.5, rx: 29, ry: 2.6 };

/** Growth stages by days practiced. */
export const STAGES = [
  { from: 0, name: '種子', en: 'Seed' },
  { from: 1, name: '發芽', en: 'Sprout' },
  { from: 3, name: '幼苗', en: 'Seedling' },
  { from: 7, name: '小樹', en: 'Sapling' },
  { from: 30, name: '含苞', en: 'Budding' },
  { from: 100, name: '盛開', en: 'In bloom' },
] as const;

export const stageFor = (days: number) =>
  [...STAGES].reverse().find((s) => days >= s.from) ?? STAGES[0];

/** A small seeded generator (mulberry32 over a string hash): the same seed, the same drawing. */
function seeded(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Half the pot's width at height y (it narrows towards the foot). */
const halfWidth = (y: number) => (y < 83 ? 32 : 27 - ((y - 83) / 30) * 6);

/** A crack from the rim down the pot, longer for a longer gap. */
export function seamPath(seed: string, days: number): string {
  const random = seeded(seed);
  let x = 36 + random() * 48;
  let y = 72;
  const points = [`M${x.toFixed(1)} ${y.toFixed(1)}`];
  const steps = 2 + Math.min(4, days) + Math.floor(random() * 2);
  for (let i = 0; i < steps; i++) {
    y += 4 + random() * 4;
    x += (random() - 0.5) * 12;
    const limit = halfWidth(y) - 4;
    x = Math.min(60 + limit, Math.max(60 - limit, x));
    points.push(`L${x.toFixed(1)} ${y.toFixed(1)}`);
    if (y > 106) break;
  }
  return points.join(' ');
}

export const seamKey = (seam: Seam) => `${seam.from}:${seam.to}`;

/** The seams drawn on a pot: at most `max`, the newest kept. */
export const visibleSeams = (bowl: Bowl, max = 12): Seam[] => bowl.seams.slice(-max);

interface Point {
  x: number;
  y: number;
}

export interface Stem {
  /** The centre line. */
  d: string;
  width: number;
  /** For wood: the filled outline of the limb, tapering from base to tip. */
  outline?: string;
}

export interface Leaf extends Point {
  /** Direction the leaf points, in degrees (0 is right, -90 is up). */
  angle: number;
  size: number;
  /** How far it turns down when the plant needs water. */
  droop: number;
  tone: 0 | 1;
}

export interface Bud extends Point {
  angle: number;
}

export interface Blossom extends Point {
  size: number;
  turn: number;
}

export interface Plant {
  woody: boolean;
  /** Thin straight shoots off the branches, as plum trees put up in winter. */
  shoots: Stem[];
  stems: Stem[];
  leaves: Leaf[];
  buds: Bud[];
  blossoms: Blossom[];
}

const MAX_BRANCHES = 5;
const MAX_LEAVES = 18;
const MAX_FLOWERS = 16;
const SHOOT_FLOWERS = 3;

const point = (p: Point) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
const along = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});
const heading = (a: Point, b: Point) => (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;

/** The outline of a limb along `pts`, `from` wide at the base narrowing to `to` at a rounded
    tip, so wood reads as wood rather than a line of one width. */
export function taper(pts: Point[], from: number, to: number): string {
  let run = 0;
  const lengths = pts.map((p, i) => {
    const prev = pts[i - 1];
    if (prev) run += Math.hypot(p.x - prev.x, p.y - prev.y);
    return run;
  });
  const total = run || 1;
  const unit = (a: Point, b: Point): Point => {
    const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: -(b.y - a.y) / l, y: (b.x - a.x) / l };
  };
  const left: Point[] = [];
  const right: Point[] = [];
  pts.forEach((p, i) => {
    const prev = pts[i - 1];
    const next = pts[i + 1];
    const n1 = prev ? unit(prev, p) : null;
    const n2 = next ? unit(p, next) : null;
    let n = n1 && n2 ? { x: n1.x + n2.x, y: n1.y + n2.y } : (n1 ?? n2 ?? { x: 1, y: 0 });
    const l = Math.hypot(n.x, n.y) || 1;
    n = { x: n.x / l, y: n.y / l };
    // Keep the width across a bend (a mitre), within reason.
    const miter = n1 && n2 ? Math.min(1.6, 1 / Math.max(0.3, n.x * n1.x + n.y * n1.y)) : 1;
    const half = ((from + (to - from) * ((lengths[i] ?? 0) / total)) / 2) * miter;
    left.push({ x: p.x + n.x * half, y: p.y + n.y * half });
    right.push({ x: p.x - n.x * half, y: p.y - n.y * half });
  });
  const tipR = (to / 2).toFixed(2);
  const end = right[right.length - 1] ?? { x: 0, y: 0 };
  return (
    `M${left.map(point).join(' L')} ` +
    `A${tipR} ${tipR} 0 0 1 ${point(end)} ` +
    `L${right.reverse().slice(1).map(point).join(' L')} Z`
  );
}

function leaf(at: Point, angle: number, size: number, tone: 0 | 1): Leaf {
  const right = Math.cos((angle * Math.PI) / 180) >= 0;
  return { ...at, angle, size, droop: right ? 22 : -22, tone };
}

/** A sprout or seedling: one green stem with leaves, taller each day. */
function seedling(random: () => number, days: number): Plant {
  const lean = (random() - 0.5) * 8;
  const height = 8 + Math.min(6, days) * 5;
  const base = { x: SOIL.cx, y: SOIL.cy };
  const top = { x: base.x + lean, y: base.y - height };
  const control = { x: base.x - lean * 1.4, y: base.y - height * 0.55 };
  const stems = [{ d: `M${point(base)} Q${point(control)} ${point(top)}`, width: 1.8 }];
  // Two seed leaves at the top, then true leaves alternating down the stem.
  const leaves = [
    leaf(top, -150 + random() * 10, 6 + days, 0),
    leaf(top, -30 - random() * 10, 6 + days, 1),
  ];
  for (let i = 0; i < days - 2; i++) {
    const t = 0.35 + (i / Math.max(1, days - 2)) * 0.45;
    const at = {
      x: base.x + (top.x - base.x) * t - lean * 0.4 * Math.sin(t * Math.PI),
      y: base.y - height * t,
    };
    const side = i % 2 ? -1 : 1;
    leaves.push(
      leaf(at, side > 0 ? -25 - random() * 20 : -155 + random() * 20, 7 + i, (i % 2) as 0 | 1),
    );
  }
  return { woody: false, stems, shoots: [], leaves, buds: [], blossoms: [] };
}

/** A plum tree: a zigzag trunk, angular branches, leaves, then buds and blossoms. */
function tree(random: () => number, days: number): Plant {
  // 0 at 7 days, about 0.9 at 100; drives height and reach.
  const grow = 1 - Math.exp(-(days - 7) / 40);
  const height = 38 + 24 * grow;
  const base = { x: SOIL.cx, y: SOIL.cy };

  // Every random number is drawn whatever the age, so a day older only reveals a little more.
  const trunk: Point[] = [base];
  const twigs: [Point, Point][] = [];
  const segments = 4;
  for (let i = 1; i <= segments; i++) {
    const swing = (i % 2 ? 1 : -1) * (2 + random() * 5);
    const next = { x: base.x + swing, y: base.y - (height * i) / segments };
    twigs.push([trunk[trunk.length - 1] ?? base, next]);
    trunk.push(next);
  }
  const branchSlots = Array.from({ length: MAX_BRANCHES }, (_, i) => ({
    from: 1 + (i % (segments - 1)) + (random() < 0.3 ? 1 : 0),
    side: i % 2 ? -1 : 1,
    length: 0.6 + random() * 0.4,
    rise: 0.4 + random() * 0.5,
    kink: (random() - 0.5) * 0.8,
  }));
  const leafSlots = Array.from({ length: MAX_LEAVES }, () => ({
    branch: random(),
    t: 0.3 + random() * 0.7,
    spread: 25 + random() * 35,
    size: 7.5 + random() * 3.5,
  }));
  const flowerSlots = Array.from({ length: MAX_FLOWERS }, () => ({
    branch: random(),
    t: 0.45 + random() * 0.55,
    size: 4.6 + random() * 1.4,
    turn: random() * 72,
    angle: -90 + (random() - 0.5) * 80,
  }));

  // Drawn last, so adding them left every earlier drawing as it was.
  const shootSlots = Array.from({ length: MAX_BRANCHES }, () => ({
    t: 0.35 + random() * 0.5,
    length: 0.6 + random() * 0.4,
    lean: (random() - 0.5) * 24,
    flowers: Array.from({ length: SHOOT_FLOWERS }, () => ({
      t: 0.35 + random() * 0.6,
      size: 3.4 + random() * 1,
      turn: random() * 72,
    })),
  }));

  const girth = 0.8 + grow * 0.25;
  const stems: Stem[] = [
    {
      d: `M${trunk.map(point).join(' L')}`,
      width: 2.9 * girth,
      outline: taper(trunk, 4.4 * girth, 1.1 * girth),
    },
  ];

  // Branches: two angular segments each, one more every ten days, longer as the tree grows.
  const branches = Math.min(MAX_BRANCHES, 1 + Math.floor((days - 7) / 10));
  for (const slot of branchSlots.slice(0, branches)) {
    const start = trunk[Math.min(slot.from, segments - 1)] ?? base;
    const reach = (10 + 16 * grow) * slot.length;
    const elbow = { x: start.x + slot.side * reach * 0.6, y: start.y - reach * slot.rise * 0.6 };
    const tip = {
      x: elbow.x + slot.side * reach * (0.4 + slot.kink * 0.2),
      y: elbow.y - reach * (0.35 + slot.rise * 0.5),
    };
    const width = 1.6 + grow * 0.4;
    stems.push({
      d: `M${point(start)} L${point(elbow)} L${point(tip)}`,
      width,
      outline: taper([start, elbow, tip], width * 1.3, 0.6),
    });
    twigs.push([start, elbow], [elbow, tip]);
  }
  const branchTwigs = twigs.slice(segments);
  // Only the upper wood carries leaves and flowers.
  const upper = twigs.filter(([, b]) => b.y < base.y - height * 0.35);
  const pick = (r: number): [Point, Point] => upper[Math.floor(r * upper.length)] ?? [base, base];

  // Plum flowers on bare wood, so a tree in full bloom keeps only a few leaves.
  const leafCount = days >= 100 ? 4 : Math.min(MAX_LEAVES, 5 + Math.floor((days - 7) / 3));
  const leaves = leafSlots.slice(0, leafCount).map((slot, i) => {
    const [a, b] = pick(slot.branch);
    const side = i % 2 ? -1 : 1;
    return leaf(
      along(a, b, slot.t),
      heading(a, b) + side * slot.spread,
      slot.size,
      (i % 2) as 0 | 1,
    );
  });

  let open = 0;
  let closed = 0;
  if (days >= 100) {
    open = Math.min(MAX_FLOWERS - 3, 10 + Math.floor((days - 100) / 20));
    closed = 3;
  } else if (days >= 30) {
    open = Math.min(8, Math.floor((days - 30) / 8));
    closed = Math.min(6, 2 + Math.floor((days - 30) / 10));
  }
  const blossoms: Blossom[] = [];
  const buds: Bud[] = [];
  flowerSlots.slice(0, open + closed).forEach((slot, i) => {
    const [a, b] = pick(slot.branch);
    const at = along(a, b, slot.t);
    if (i < open) blossoms.push({ ...at, size: slot.size, turn: slot.turn });
    else buds.push({ ...at, angle: slot.angle });
  });

  // Shoots: a thin straight rod up from each branch from three weeks on, with buds along it
  // that open in full bloom.
  const shoots: Stem[] = [];
  if (days >= 21) {
    shootSlots.slice(0, branches).forEach((slot, k) => {
      const [a, b] = branchTwigs[k * 2 + 1] ?? [base, base];
      const start = along(a, b, slot.t);
      const reach = (5 + 8 * grow) * slot.length;
      const angle = ((-90 + slot.lean) * Math.PI) / 180;
      const tip = { x: start.x + Math.cos(angle) * reach, y: start.y + Math.sin(angle) * reach };
      shoots.push({
        d: `M${point(start)} L${point(tip)}`,
        width: 0.7,
        outline: taper([start, tip], 0.9, 0.35),
      });
      // One bud from fifty days; all of them open in full bloom.
      slot.flowers.forEach((f, i) => {
        const at = along(start, tip, f.t);
        if (days >= 100) blossoms.push({ ...at, size: f.size, turn: f.turn });
        else if (days >= 50 && i === 0) buds.push({ ...at, angle: -90 + slot.lean });
      });
    });
  }

  return { woody: true, stems, shoots, leaves, buds, blossoms };
}

/** The plant for a streak `days` long, shaped by `seed`. Empty before the first day. */
export function plantShape(seed: string, days: number): Plant {
  if (days <= 0) return { woody: false, stems: [], shoots: [], leaves: [], buds: [], blossoms: [] };
  const random = seeded(`plant:${seed}`);
  return days < 7 ? seedling(random, days) : tree(random, days);
}

/** An almond leaf from its base at (0, 0), pointing right, `size` long. */
export const leafPath = (size: number) => {
  const s = size;
  return `M0 0 C${s * 0.3} ${-s * 0.32} ${s * 0.72} ${-s * 0.3} ${s} 0 C${s * 0.72} ${s * 0.3} ${s * 0.3} ${s * 0.32} 0 0Z`;
};
