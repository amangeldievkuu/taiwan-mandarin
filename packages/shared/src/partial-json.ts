// Best-effort parse of a JSON document that is still arriving, such as a streamed AI answer:
// complete values as they are, the string being written as far as it has got, and nothing that
// could still change meaning (a half-written number, literal or key).

interface Parsed {
  value: unknown;
  /** False when the text ended inside this value. */
  complete: boolean;
}

const ESCAPES: Record<string, string> = {
  '"': '"',
  '\\': '\\',
  '/': '/',
  b: '\b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
};

const LITERALS: [string, unknown][] = [
  ['true', true],
  ['false', false],
  ['null', null],
];

/**
 * `{"a": "Keep tr` → `{ a: "Keep tr" }`; `{"a": [1, 2` → `{ a: [1] }`; `{"a": nu` → `{}`.
 * Undefined when nothing usable has arrived yet.
 */
export function parsePartialJson(text: string): unknown {
  let i = 0;

  const skipSpace = () => {
    while (i < text.length && ' \t\n\r'.includes(text.charAt(i))) i++;
  };

  const string = (): Parsed => {
    i++; // the opening quote
    let out = '';
    while (i < text.length) {
      const c = text.charAt(i);
      if (c === '"') {
        i++;
        return { value: out, complete: true };
      }
      if (c === '\\') {
        const escape = text.charAt(i + 1);
        if (escape === 'u') {
          const hex = text.slice(i + 2, i + 6);
          if (!/^[0-9a-f]{4}$/i.test(hex)) break; // cut off inside the escape
          out += String.fromCharCode(parseInt(hex, 16));
          i += 6;
        } else if (escape) {
          out += ESCAPES[escape] ?? escape;
          i += 2;
        } else break;
        continue;
      }
      out += c;
      i++;
    }
    i = text.length;
    return { value: out, complete: false };
  };

  const value = (): Parsed | null => {
    skipSpace();
    const c = text.charAt(i);
    if (!c) return null;

    if (c === '{') {
      i++;
      const object: Record<string, unknown> = {};
      for (;;) {
        skipSpace();
        if (text.charAt(i) === '}') {
          i++;
          return { value: object, complete: true };
        }
        if (text.charAt(i) !== '"') return { value: object, complete: false };
        const key = string();
        skipSpace();
        if (!key.complete || text.charAt(i) !== ':') return { value: object, complete: false };
        i++;
        const member = value();
        if (!member) return { value: object, complete: false };
        object[key.value as string] = member.value;
        if (!member.complete) return { value: object, complete: false };
        skipSpace();
        if (text.charAt(i) === ',') i++;
        else if (text.charAt(i) !== '}') return { value: object, complete: false };
      }
    }

    if (c === '[') {
      i++;
      const array: unknown[] = [];
      for (;;) {
        skipSpace();
        if (text.charAt(i) === ']') {
          i++;
          return { value: array, complete: true };
        }
        const item = value();
        if (!item) return { value: array, complete: false };
        array.push(item.value);
        if (!item.complete) return { value: array, complete: false };
        skipSpace();
        if (text.charAt(i) === ',') i++;
        else if (text.charAt(i) !== ']') return { value: array, complete: false };
      }
    }

    if (c === '"') return string();

    const number = /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(text.slice(i))?.[0];
    if (number) {
      i += number.length;
      // At the very end the number may still be growing ("12" of "125").
      return i < text.length ? { value: Number(number), complete: true } : null;
    }
    for (const [word, literal] of LITERALS) {
      if (text.startsWith(word, i)) {
        i += word.length;
        return { value: literal, complete: true };
      }
    }
    return null; // a half-written literal, or not JSON
  };

  return value()?.value;
}
