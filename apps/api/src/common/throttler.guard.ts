// Who a rate limit counts. On the routes that need a signed-in learner (AuthGuard), the account
// whose session token it is; everywhere else, and for personal access tokens, the address. By
// address alone, a class, an office or a mobile carrier's shared address shared one allowance:
// 120 syncs a minute for everyone behind it.
//
// Only a token whose signature checks out names an account, so a made-up one can't buy a fresh
// allowance. Signing in and signing up have no AuthGuard and stay by address, so one's own account
// doesn't buy one there either. Signing in also counts by email (see app.module.ts).

import { Inject, Injectable, type ExecutionContext } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants.js';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthGuard } from '../auth/auth.guard.js';

/** Whether the route needs a signed-in learner. */
export function signedInRoute(context: ExecutionContext): boolean {
  return [context.getHandler(), context.getClass()].some((target) => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, target) as unknown[] | undefined;
    return guards?.includes(AuthGuard) ?? false;
  });
}

@Injectable()
export class AccountThrottlerGuard extends ThrottlerGuard {
  @Inject(JwtService) private readonly jwt!: JwtService;

  protected override async getTracker(
    req: Record<string, unknown>,
    context?: ExecutionContext,
  ): Promise<string> {
    if (context && signedInRoute(context)) {
      const account = await this.account(req);
      if (account) return `account:${account}`;
    }
    return super.getTracker(req);
  }

  /** The account of a valid session token in the request, if it has one. */
  private async account(req: Record<string, unknown>): Promise<string | undefined> {
    const header = (req['headers'] as Record<string, string | undefined> | undefined)
      ?.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token || token.startsWith('tm_')) return undefined;
    try {
      const { sub } = await this.jwt.verifyAsync<{ sub?: unknown }>(token);
      return typeof sub === 'string' ? sub : undefined;
    } catch {
      return undefined;
    }
  }
}

/** The email a request signs in or up with, lowercased: a limit per account tried. */
export function emailOf(req: Record<string, unknown>): string | undefined {
  const email = (req['body'] as { email?: unknown } | undefined)?.email;
  return typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : undefined;
}
