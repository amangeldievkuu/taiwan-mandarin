import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { repeats } from './talk.service.js';

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
