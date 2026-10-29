import { describe, expect, it } from 'vitest';
import { entranceFor, navKind } from './nav';

describe('navKind', () => {
  it('goes forward into deeper pages and back out of them', () => {
    expect(navKind('read', 'reader')).toBe('forward');
    expect(navKind('reader', 'read')).toBe('back');
    expect(navKind('level', 'word')).toBe('forward');
  });

  it('moves sideways between tabs', () => {
    expect(navKind('today', 'dict')).toBe('tab');
  });
});

describe('entranceFor', () => {
  it('walks in from the side the new tab is on', () => {
    expect(entranceFor('today', 'study')).toEqual({ kind: 'walk', from: 'right' });
    expect(entranceFor('me', 'read')).toEqual({ kind: 'walk', from: 'left' });
  });

  it('counts a page under a tab as that tab', () => {
    // The reader sits under Read, which is left of the Dictionary.
    expect(entranceFor('dict', 'reader')).toEqual({ kind: 'rappel' });
    expect(entranceFor('me-settings', 'me-about')).toEqual({ kind: 'walk', from: 'right' });
  });

  it('rappels down into a deeper page and climbs back up', () => {
    expect(entranceFor('path', 'level')).toEqual({ kind: 'rappel' });
    expect(entranceFor('level', 'path')).toEqual({ kind: 'climb' });
  });
});
