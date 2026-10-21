// Accounts and sessions: argon2id passwords, 15-minute JWT access tokens and rotating refresh
// tokens (hashed, in an httpOnly cookie). Reusing an already-rotated refresh token revokes the
// whole chain, which logs out a thief and the victim alike rather than leaving a stolen session.

import { randomUUID } from 'node:crypto';
import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import argon2 from 'argon2';
import type { AuthResponse, LoginBody, RegisterBody, UserDto } from '@taiwan-mandarin/shared/api';
import { PrismaService } from '../prisma/prisma.service.js';
import { randomToken, sha256 } from './crypto.js';

export const ACCESS_TTL_SECONDS = 15 * 60;
export const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

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
    if (!stored) throw new UnauthorizedException('Session expired');
    if (stored.revokedAt) {
      await this.db.refreshToken.updateMany({
        where: { family: stored.family, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Session expired');
    }
    if (stored.expiresAt < new Date()) throw new UnauthorizedException('Session expired');
    await this.db.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    return this.issue(stored.user, stored.family, userAgent);
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
    const refreshToken = randomToken();
    await this.db.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(refreshToken),
        family,
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
        userAgent: userAgent?.slice(0, 200) ?? null,
      },
    });
    const accessToken = await this.jwt.signAsync(
      { sub: user.id },
      { expiresIn: ACCESS_TTL_SECONDS },
    );
    return { user: toDto(user), accessToken, expiresIn: ACCESS_TTL_SECONDS, refreshToken };
  }
}

/** Hash of a random string, verified against when an email is unknown so timing matches. */
const DUMMY_HASH = argon2.hash(randomToken(), { type: argon2.argon2id });
