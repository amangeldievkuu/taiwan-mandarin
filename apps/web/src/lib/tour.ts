// The welcome tour's timeline: four short scenes of the app (Today, Study, Read, the plant), each a
// row of beats at set times. The player turns elapsed time into a frame; the scenes draw a frame.
// Pure, so it is tested without a browser.

export type SceneId = 'today' | 'study' | 'read' | 'grow';

export interface Scene {
  id: SceneId;
  /** Its name on the tab bar, shown on the chapter it plays in. */
  zh: string;
  /** How long it plays, in ms. */
  ms: number;
  /** Named beats and when each starts (ms into the scene), in order; the first at 0. */
  beats: readonly (readonly [name: string, at: number])[];
  /** The beat that tells the scene best on its own, shown when nothing moves (reduced motion). */
  still: string;
}

export const SCENES: readonly Scene[] = [
  {
    id: 'today',
    zh: '今天',
    ms: 7000,
    beats: [
      ['enter', 0],
      ['ring', 700],
      ['point', 3600],
      ['tap', 4600],
      ['leave', 5800],
    ],
    still: 'point',
  },
  {
    id: 'study',
    zh: '學習',
    ms: 13000,
    beats: [
      ['front', 0],
      ['point', 1600],
      ['tap', 2600],
      ['answer', 3100],
      ['grade', 6000],
      ['tapGood', 7000],
      ['gone', 7500],
      ['next', 8600],
    ],
    still: 'grade',
  },
  {
    id: 'read',
    zh: '閱讀',
    ms: 9000,
    beats: [
      ['text', 0],
      ['point', 1500],
      ['tap', 2400],
      ['sheet', 2800],
      ['tapAdd', 5000],
      ['added', 5500],
    ],
    still: 'sheet',
  },
  {
    id: 'grow',
    zh: '我',
    ms: 7000,
    beats: [
      ['pot', 0],
      ['sprout', 900],
      ['day', 2500],
      ['streak', 3300],
    ],
    still: 'streak',
  },
];

/** The whole tour, once round. */
export const TOUR_MS = SCENES.reduce((sum, s) => sum + s.ms, 0);

/** Where scene `i` starts, in ms from the start of the tour. */
export function sceneStart(i: number): number {
  return SCENES.slice(0, i).reduce((sum, s) => sum + s.ms, 0);
}

export interface Frame {
  /** Index into SCENES. */
  scene: number;
  /** Index into the scene's beats. */
  beat: number;
  /** ms into the scene. */
  t: number;
  /** 0–1 through the scene. */
  progress: number;
}

/** The frame `ms` into the tour; it loops, so any time past the end starts over. */
export function frameAt(ms: number): Frame {
  let t = ((ms % TOUR_MS) + TOUR_MS) % TOUR_MS;
  let scene = 0;
  for (; scene < SCENES.length - 1; scene++) {
    const length = SCENES[scene]?.ms ?? 0;
    if (t < length) break;
    t -= length;
  }
  const s = SCENES[scene] as Scene;
  const beat = Math.max(
    0,
    s.beats.findLastIndex(([, at]) => t >= at),
  );
  return { scene, beat, t, progress: t / s.ms };
}

/** Index of a named beat in a scene; -1 for a name it doesn't have. */
export function beatIndex(scene: number, name: string): number {
  return SCENES[scene]?.beats.findIndex(([n]) => n === name) ?? -1;
}

/** The still frame of a scene (reduced motion): its `still` beat, held. */
export function stillFrame(scene: number): Frame {
  const s = SCENES[scene] as Scene;
  const beat = beatIndex(scene, s.still);
  const t = s.beats[beat]?.[1] ?? 0;
  return { scene, beat, t, progress: t / s.ms };
}

/** In a frame, whether the scene has got to beat `name` (so its effects stay on afterwards). */
export const reached = (frame: Frame, name: string): boolean => {
  const i = beatIndex(frame.scene, name);
  return i >= 0 && frame.beat >= i;
};
