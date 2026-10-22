import 'reflect-metadata';
import OpenAI from 'openai';
import { describe, expect, it } from 'vitest';
import { effortFallback, formatUsage } from './llm.service.js';

describe('formatUsage', () => {
  it('shows the time, the wait for the first output and the tokens', () => {
    expect(
      formatUsage({
        feature: 'explain',
        model: 'gpt-6-luna',
        effort: 'low',
        ms: 3420,
        firstOutputMs: 910,
        usage: {
          input_tokens: 1104,
          input_tokens_details: { cached_tokens: 1024 },
          output_tokens: 1380,
          output_tokens_details: { reasoning_tokens: 210 },
        },
        serviceTier: 'default',
        status: 'completed',
      }),
    ).toBe(
      'explain gpt-6-luna effort=low · 3.42 s (first output 0.91 s) · in 1,104 (cached 1,024) · out 1,380 (reasoning 210)',
    );
  });

  it('notes a faster tier and an unfinished answer', () => {
    expect(
      formatUsage({
        feature: 'talk',
        model: 'gpt-6-luna',
        effort: 'none',
        ms: 800,
        serviceTier: 'priority',
        status: 'incomplete',
      }),
    ).toBe('talk gpt-6-luna effort=none · 0.80 s · priority · incomplete');
  });
});

describe('effortFallback', () => {
  const rejected = (param: string, message: string) =>
    new OpenAI.BadRequestError(
      400,
      { message, param, code: 'unsupported_value', type: 'invalid_request_error' },
      message,
      new Headers(),
    );

  it('steps to the nearest effort a model takes', () => {
    expect(effortFallback(rejected('reasoning.effort', "Unsupported value: 'none'"), 'none')).toBe(
      'low',
    );
    expect(effortFallback(rejected('reasoning.effort', 'Unsupported value'), 'max')).toBe('high');
  });

  it('leaves other errors alone', () => {
    expect(effortFallback(rejected('text.verbosity', 'Unsupported value'), 'none')).toBeUndefined();
    expect(
      effortFallback(rejected('reasoning.effort', 'Unsupported value'), 'low'),
    ).toBeUndefined();
    expect(effortFallback(new Error('reasoning effort'), 'none')).toBeUndefined();
  });
});
