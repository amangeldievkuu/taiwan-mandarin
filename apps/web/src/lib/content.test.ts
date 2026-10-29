import { describe, expect, it } from 'vitest';
import { localizedPath } from './content.svelte';

describe('localizedPath', () => {
  const files = {
    'content/words-N1.json': 'a',
    'content/vi/words-N1.json': 'b',
    'dict/vi/3.json': 'c',
  };

  it('takes the language’s own file when the build has it', () => {
    expect(localizedPath('content/words-N1.json', 'vi', files)).toEqual({
      path: 'content/vi/words-N1.json',
      translated: true,
    });
    expect(localizedPath('dict/3.json', 'vi', files).path).toBe('dict/vi/3.json');
  });

  it('falls back to English, marked, when it does not', () => {
    expect(localizedPath('content/readers.json', 'vi', files)).toEqual({
      path: 'content/readers.json',
      translated: false,
    });
    expect(localizedPath('dict/3.json', 'vi', undefined).translated).toBe(false);
  });

  it('leaves English alone', () => {
    expect(localizedPath('dict/3.json', 'en', files)).toEqual({
      path: 'dict/3.json',
      translated: true,
    });
  });
});
