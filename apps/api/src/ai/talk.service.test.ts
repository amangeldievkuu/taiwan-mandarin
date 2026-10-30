import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { repeats, RULES, systemPrompt } from './talk.service.js';

describe('repeats', () => {
  const earlier = '喔，你要去花蓮。請在台北車站買火車票，坐火車大概三個小時就到。';

  it('catches a reply that says the same thing again', () => {
    expect(repeats('好，請在臺北車站買去花蓮的火車票，坐火車大概三個小時就到喔。', earlier)).toBe(
      true,
    );
  });

  it('lets the conversation move on', () => {
    expect(repeats('你要坐幾點的火車？自強號比較快喔。', earlier)).toBe(false);
  });

  it('allows short replies twice', () => {
    expect(repeats('好啊！', '好啊！')).toBe(false);
  });
});

describe('RULES', () => {
  it('ask for translations and explanations in the learner’s language', () => {
    expect(RULES.en).toContain('translation: natural English');
    expect(RULES.vi).toContain('translation: natural Vietnamese');
    expect(RULES.vi).toContain('If they write Vietnamese, English or pinyin');
    expect(RULES.vi).toContain('one or two short Vietnamese sentences');
    expect(RULES.ru).toContain('translation: natural Russian');
    expect(RULES.ru).toContain('If they write Russian, English or pinyin');
  });

  it('stay the same for every turn, so the provider can cache them', () => {
    expect(RULES.vi).toBe(RULES.vi);
    expect(RULES.en.split('\n')[0]).toBe(
      'You are a conversation partner for someone learning Taiwan Mandarin. Their first language is English.',
    );
  });
});

describe('systemPrompt', () => {
  const follows = 'When the learner brings up a new subject, follow them to it';

  it('lets a chat go wherever the learner takes it', () => {
    for (const id of ['free', 'food', 'weather'] as const) {
      expect(systemPrompt(id, 'Vocabulary: …', 'en')).toContain(follows);
    }
  });

  it('keeps a task on its way to its end', () => {
    const prompt = systemPrompt('night-market', 'Vocabulary: …', 'en');
    expect(prompt).not.toContain(follows);
    expect(prompt).toContain('Raohe Night Market');
  });

  it('starts with the rules, so the cached prefix stays the same', () => {
    expect(systemPrompt('taxi', 'Vocabulary: …', 'vi').startsWith(RULES.vi)).toBe(true);
  });
});
