// Accounts and sessions: argon2id passwords, 15-minute JWT access tokens and rotating refresh
// tokens (hashed, in an httpOnly cookie). Reusing an already-rotated refresh token revokes the
// whole chain, which logs out a thief and the victim alike rather than leaving a stolen session.
// The exception is reuse within a few seconds of rotation, which is two tabs refreshing at once.

import { randomUUID } from 'node:crypto';
import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import argon2 from 'argon2';
import type { AuthResponse, LoginBody, RegisterBody, UserDto } from '@taiwan-mandarin/shared/api';
import { PrismaService } from '../prisma/prisma.service.js';
import { randomToken, sha256 } from './crypto.js';

export const ACCESS_TTL_SECONDS = 15 * 60;
export const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** A token replaced this recently may be used once more (two tabs refreshing together). */
export const REUSE_GRACE_MS = 30_000;

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
      throw new ConflictException('An account with this email already exists');
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
    if (!user || !ok) throw new UnauthorizedException('Wrong email or password');
    return this.issue(user, randomUUID(), userAgent);
  }

  async refresh(token: string | undefined, userAgent?: string): Promise<Session> {
    if (!token) throw new UnauthorizedException('Not signed in');
    const stored = await this.db.refreshToken.findUnique({
      where: { tokenHash: sha256(token) },
      include: { user: true },
    });
    if (!stored || stored.expiresAt < new Date())
      throw new UnauthorizedException('Session expired');
    if (!stored.revokedAt) {
      // Revoke and replace in one transaction: a parallel refresh with the same cookie waits on
      // the row, then finds it revoked and its successor already stored.
      const next = await this.db.$transaction(async (tx) => {
        const { count } = await tx.refreshToken.updateMany({
          where: { id: stored.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        return count === 1 ? this.store(tx, stored.userId, stored.family, userAgent) : null;
      });
      if (next) return this.session(stored.user, next);
    }
    // Already rotated: by another tab a moment ago (fine), or a replayed stolen token.
    if (await this.justRotated(stored.id, stored.family)) {
      return this.session(
        stored.user,
        await this.store(this.db, stored.userId, stored.family, userAgent),
      );
    }
    await this.db.refreshToken.updateMany({
      where: { family: stored.family, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new UnauthorizedException('Session expired');
  }

  /**
   * Whether a token was replaced within the last few seconds, as when two tabs refresh at once.
   * Rotation leaves a live successor in the family; logging out or a revoked family does not.
   */
  private async justRotated(id: string, family: string): Promise<boolean> {
    const row = await this.db.refreshToken.findUnique({ where: { id } });
    if (!row?.revokedAt || Date.now() - row.revokedAt.getTime() > REUSE_GRACE_MS) return false;
    const successor = await this.db.refreshToken.findFirst({ where: { family, revokedAt: null } });
    return successor !== null;
  }

  async logout(token: string | undefined): Promise<void> {
    if (!token) return;
    await this.db.refreshToken.updateMany({
      where: { tokenHash: sha256(token), revokedAt: null },
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

  /** Stores a new refresh token in `family` and returns it. */
  private async store(
    db: Pick<PrismaService, 'refreshToken'>,
    userId: string,
    family: string,
    userAgent?: string,
  ): Promise<string> {
    const refreshToken = randomToken();
    await db.refreshToken.create({
      data: {
        userId,
        tokenHash: sha256(refreshToken),
        family,
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
    const accessToken = await this.jwt.signAsync(
      { sub: user.id },
      { expiresIn: ACCESS_TTL_SECONDS },
    );
    return { user: toDto(user), accessToken, expiresIn: ACCESS_TTL_SECONDS, refreshToken };
  }
}

/** Hash of a random string, verified against when an email is unknown so timing matches. */
const DUMMY_HASH = argon2.hash(randomToken(), { type: argon2.argon2id });
