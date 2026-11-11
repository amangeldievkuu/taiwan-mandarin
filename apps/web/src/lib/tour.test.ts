import { describe, expect, it } from 'vitest';
import { beatIndex, frameAt, reached, SCENES, sceneStart, stillFrame, TOUR_MS } from './tour';

describe('the tour timeline', () => {
  it('adds up the scenes', () => {
    expect(TOUR_MS).toBe(SCENES.reduce((sum, s) => sum + s.ms, 0));
    expect(sceneStart(0)).toBe(0);
    expect(sceneStart(SCENES.length)).toBe(TOUR_MS);
  });

  it('has beats in order, the first at 0 and all inside the scene', () => {
    for (const s of SCENES) {
      expect(s.beats[0]?.[1]).toBe(0);
      const times = s.beats.map(([, at]) => at);
      expect(times).toEqual([...times].sort((a, b) => a - b));
      expect(Math.max(...times)).toBeLessThan(s.ms);
      expect(s.beats.some(([name]) => name === s.still)).toBe(true);
    }
  });

  it('starts each scene where sceneStart says', () => {
    SCENES.forEach((s, i) => {
      expect(frameAt(sceneStart(i))).toMatchObject({ scene: i, beat: 0, t: 0, progress: 0 });
      expect(frameAt(sceneStart(i) + s.ms - 1)).toMatchObject({
        scene: i,
        beat: s.beats.length - 1,
      });
    });
  });

  it('changes beat exactly on its time', () => {
    const study = SCENES.findIndex((s) => s.id === 'study');
    const answer = beatIndex(study, 'answer');
    const at = SCENES[study]?.beats[answer]?.[1] ?? 0;
    expect(frameAt(sceneStart(study) + at - 1).beat).toBe(answer - 1);
    expect(frameAt(sceneStart(study) + at).beat).toBe(answer);
  });

  it('loops, both ways', () => {
    expect(frameAt(TOUR_MS)).toEqual(frameAt(0));
    expect(frameAt(TOUR_MS * 3 + 1234)).toEqual(frameAt(1234));
    expect(frameAt(-1).scene).toBe(SCENES.length - 1);
  });

  it('keeps a beat reached once it has passed', () => {
    const study = SCENES.findIndex((s) => s.id === 'study');
    const late = frameAt(sceneStart(study) + 12_000);
    expect(reached(late, 'answer')).toBe(true);
    expect(reached(frameAt(sceneStart(study)), 'answer')).toBe(false);
    expect(reached(late, 'no such beat')).toBe(false);
  });

  it('holds each scene on its still beat', () => {
    SCENES.forEach((s, i) => {
      const f = stillFrame(i);
      expect(f.scene).toBe(i);
      expect(s.beats[f.beat]?.[0]).toBe(s.still);
      expect(frameAt(sceneStart(i) + f.t)).toEqual(f);
    });
  });
});
