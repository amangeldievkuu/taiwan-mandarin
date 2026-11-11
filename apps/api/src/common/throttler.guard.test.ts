import type { ExecutionContext } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { beforeAll, describe, expect, it } from 'vitest';
import { AuthController } from '../auth/auth.controller.js';
import { SyncController } from '../sync/sync.controller.js';
import { AccountThrottlerGuard, emailOf } from './throttler.guard.js';

const secret = 'test-secret-test-secret-test-secret-0123';
const jwt = new JwtService({ secret });
let tracker: (req: object, context: ExecutionContext) => Promise<string>;

beforeAll(async () => {
  // Built by Nest, as in the app: its JwtService comes by injection.
  const module = await Test.createTestingModule({
    imports: [JwtModule.register({ secret }), ThrottlerModule.forRoot({ throttlers: [] })],
    providers: [AccountThrottlerGuard],
  }).compile();
  const guard = module.get(AccountThrottlerGuard);
  tracker = (
    guard as unknown as { getTracker(req: object, context: ExecutionContext): Promise<string> }
  ).getTracker.bind(guard);
});

/** A request to a controller's route, from `ip`, with this Authorization header. */
const ask = (controller: { prototype: object }, route: string, ip: string, auth?: string) =>
  tracker({ ip, headers: auth ? { authorization: auth } : {} }, {
    getClass: () => controller,
    getHandler: () => (controller.prototype as Record<string, unknown>)[route],
  } as unknown as ExecutionContext);

const session = (sub: string) => `Bearer ${jwt.sign({ sub })}`;

describe('who a rate limit counts', () => {
  it('counts two learners behind one address apart where they are signed in', async () => {
    const one = await ask(SyncController, 'run', '203.0.113.7', session('u1'));
    const two = await ask(SyncController, 'run', '203.0.113.7', session('u2'));
    expect(one).toBe('account:u1');
    expect(two).toBe('account:u2');
  });

  it('counts by address when the token is made up or a personal access token', async () => {
    const forged = `Bearer ${new JwtService({ secret: 'another-secret-another-secret-0123456' }).sign({ sub: 'u1' })}`;
    expect(await ask(SyncController, 'run', '203.0.113.7', forged)).toBe('203.0.113.7');
    expect(await ask(SyncController, 'run', '203.0.113.7', 'Bearer tm_abc')).toBe('203.0.113.7');
    expect(await ask(SyncController, 'run', '203.0.113.7')).toBe('203.0.113.7');
  });

  it('keeps signing in by address, even with a valid session token', async () => {
    expect(await ask(AuthController, 'login', '203.0.113.7', session('u1'))).toBe('203.0.113.7');
  });

  it('counts signing in per email too, whatever its case', () => {
    expect(emailOf({ body: { email: ' Learner@Example.TW ' } })).toBe('learner@example.tw');
    expect(emailOf({ body: {} })).toBeUndefined();
  });
});
