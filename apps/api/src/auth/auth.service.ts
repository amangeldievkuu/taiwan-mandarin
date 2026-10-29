// Accounts and sessions: argon2id passwords, 15-minute JWT access tokens and rotating refresh
// tokens (hashed, in an httpOnly cookie). Reusing an already-rotated refresh token normally
// revokes the whole chain, which logs out a thief and the victim alike rather than leaving a
// stolen session.
//
// The exception: a rotated token whose replacements are all still unused may be used again, a
// bounded number of times. That is what a lost response looks like (a flaky connection, the app
// suspended mid-request, a client timeout: the server rotated, the browser kept the old cookie),
// and also what two tabs refreshing together look like. Treating it as theft signed learners out
// for no reason. The cost is that a token stolen and used once is only caught when its holder
// moves on from it; a token replayed over and over is cut off after MAX_CHILDREN uses.

import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import argon2 from 'argon2';
import type {
  AuthResponse,
  ChangePasswordBody,
  LoginBody,
  RegisterBody,
  UserDto,
} from '@taiwan-mandarin/shared/api';
import { PrismaService } from '../prisma/prisma.service.js';
import { randomToken, sha256 } from './crypto.js';
import { apiError } from '@taiwan-mandarin/shared/api';

export const ACCESS_TTL_SECONDS = 15 * 60;
export const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** How many replacements one token may get: its rotation, then this many lost responses. */
export const MAX_CHILDREN = 3;
/** Expired and long-revoked tokens are dropped when their owner next refreshes. */
const SWEEP_AFTER_MS = 60 * 24 * 60 * 60 * 1000;

export interface Session extends AuthResponse {
  refreshToken: string;
}

const toDto = (u: {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: Date;
}): UserDto => ({
  id: u.id,
  email: u.email,
  displayName: u.displayName,
  createdAt: u.createdAt.toISOString(),
});

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(JwtService) private readonly jwt: JwtService,
  ) {}

  async register(body: RegisterBody, userAgent?: string): Promise<Session> {
    const email = body.email.toLowerCase();
    if (await this.db.user.findUnique({ where: { email } })) {
      throw new ConflictException(apiError('emailTaken'));
    }
    const user = await this.db.user.create({
      data: {
        email,
        passwordHash: await argon2.hash(body.password, { type: argon2.argon2id }),
        displayName: body.displayName ?? null,
      },
    });
    return this.issue(user, randomUUID(), userAgent);
  }

  async login(body: LoginBody, userAgent?: string): Promise<Session> {
    const user = await this.db.user.findUnique({ where: { email: body.email.toLowerCase() } });
    // Verify against a dummy hash when the user is missing, so timing doesn't reveal accounts.
    const ok = await argon2
      .verify(user?.passwordHash ?? (await DUMMY_HASH), body.password)
      .catch(() => false);
    if (!user || !ok) throw new UnauthorizedException(apiError('wrongLogin'));
    return this.issue(user, randomUUID(), userAgent);
  }

  async refresh(token: string | undefined, userAgent?: string): Promise<Session> {
    if (!token) throw new UnauthorizedException(apiError('notSignedIn'));
    const stored = await this.db.refreshToken.findUnique({
      where: { tokenHash: sha256(token) },
      include: { user: true },
    });
    if (!stored || stored.expiresAt < new Date())
      throw new UnauthorizedException(apiError('sessionExpired'));
    this.sweep(stored.userId);
    if (!stored.revokedAt) {
      // Revoke and replace in one transaction: a parallel refresh with the same cookie waits on
      // the row, then finds it revoked and its successor already stored.
      const next = await this.db.$transaction(async (tx) => {
        const { count } = await tx.refreshToken.updateMany({
          where: { id: stored.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        return count === 1
          ? this.store(tx, stored.userId, stored.family, userAgent, stored.id)
          : null;
      });
      if (next) return this.session(stored.user, next);
    }
    // Already rotated: a replacement the client never got (or another tab), or a replayed
    // stolen token.
    if (await this.replacementUnused(stored.id)) {
      return this.session(
        stored.user,
        await this.store(this.db, stored.userId, stored.family, userAgent, stored.id),
      );
    }
    await this.db.refreshToken.updateMany({
      where: { family: stored.family, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new UnauthorizedException(apiError('sessionExpired'));
  }

  /**
   * Whether a rotated token's replacements are all still unused, so the client plainly never
   * received one (or two tabs refreshed together). A replacement that was itself rotated, or
   * revoked by signing out, means the client did move on and this is a replay; so does a token
   * replaced too many times.
   */
  private async replacementUnused(id: string): Promise<boolean> {
    const children = await this.db.refreshToken.findMany({
      where: { parentId: id },
      select: { revokedAt: true },
    });
    return (
      children.length > 0 &&
      children.length < MAX_CHILDREN &&
      children.every((child) => child.revokedAt === null)
    );
  }

  /** Drops this account's expired tokens and those revoked long ago; nothing waits on it. */
  private sweep(userId: string): void {
    const now = Date.now();
    void this.db.refreshToken
      .deleteMany({
        where: {
          userId,
          OR: [
            { expiresAt: { lt: new Date(now) } },
            { revokedAt: { lt: new Date(now - SWEEP_AFTER_MS) } },
          ],
        },
      })
      .catch(() => undefined);
  }

  async logout(token: string | undefined): Promise<void> {
    if (!token) return;
    await this.db.refreshToken.updateMany({
      where: { tokenHash: sha256(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Changes the password and ends every session; this device gets a new one. A wrong current
   * password is 403, not 401, which clients take to mean the session itself is gone.
   */
  async changePassword(
    userId: string,
    body: ChangePasswordBody,
    userAgent?: string,
  ): Promise<Session> {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    const ok = await argon2.verify(user.passwordHash, body.currentPassword).catch(() => false);
    if (!ok) throw new ForbiddenException(apiError('wrongPassword'));
    await this.db.user.update({
      where: { id: userId },
      data: {
        passwordHash: await argon2.hash(body.newPassword, { type: argon2.argon2id }),
        sessionsValidFrom: new Date(),
      },
    });
    await this.revokeAll(userId);
    return this.issue(user, randomUUID(), userAgent);
  }

  /** Ends every session of the account, on every device, including access tokens already issued. */
  async logoutEverywhere(userId: string): Promise<void> {
    await this.db.user.update({
      where: { id: userId },
      data: { sessionsValidFrom: new Date() },
    });
    await this.revokeAll(userId);
  }

  private async revokeAll(userId: string): Promise<void> {
    await this.db.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string): Promise<UserDto> {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return toDto(user);
  }

  /** Deletes the account and everything in it (cascades). */
  async deleteAccount(userId: string): Promise<void> {
    await this.db.user.delete({ where: { id: userId } });
  }

  private async issue(
    user: { id: string; email: string; displayName: string | null; createdAt: Date },
    family: string,
    userAgent?: string,
  ): Promise<Session> {
    return this.session(user, await this.store(this.db, user.id, family, userAgent));
  }

  /** Stores a new refresh token in `family` (replacing `parentId`, if any) and returns it. */
  private async store(
    db: Pick<PrismaService, 'refreshToken'>,
    userId: string,
    family: string,
    userAgent?: string,
    parentId?: string,
  ): Promise<string> {
    const refreshToken = randomToken();
    await db.refreshToken.create({
      data: {
        userId,
        tokenHash: sha256(refreshToken),
        family,
        parentId: parentId ?? null,
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
        userAgent: userAgent?.slice(0, 200) ?? null,
      },
    });
    return refreshToken;
  }

  private async session(
    user: { id: string; email: string; displayName: string | null; createdAt: Date },
    refreshToken: string,
  ): Promise<Session> {
    // iatMs: the issue time to the millisecond (iat has whole seconds), for sessionsValidFrom.
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, iatMs: Date.now() },
      { expiresIn: ACCESS_TTL_SECONDS },
    );
    return { user: toDto(user), accessToken, expiresIn: ACCESS_TTL_SECONDS, refreshToken };
  }
}

/** Hash of a random string, verified against when an email is unknown so timing matches. */
const DUMMY_HASH = argon2.hash(randomToken(), { type: argon2.argon2id });
