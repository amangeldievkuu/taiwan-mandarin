// Accepts `Authorization: Bearer <JWT>` (the web app) or `Bearer tm_…` (a personal access token
// for the public API) and puts the user id on the request. Tokens only reach routes marked
// @TokenAllowed(), so a leaked one can read progress but not sync, spend AI quota or delete the
// account.

import {
  createParamDecorator,
  ForbiddenException,
  Inject,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';
import { sha256 } from './crypto.js';
import { apiError } from '@taiwan-mandarin/shared/api';

export interface AuthUser {
  id: string;
  via: 'session' | 'token';
}

type AuthedRequest = Request & { user?: AuthUser };

const TOKEN_ALLOWED = 'tokenAllowed';
/** Lets a personal access token use this route (or every route of this controller). */
export const TokenAllowed = () => SetMetadata(TOKEN_ALLOWED, true);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const header = request.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) throw new UnauthorizedException('Sign in or send a token');

    if (token.startsWith('tm_')) {
      const allowed = this.reflector.getAllAndOverride<boolean>(TOKEN_ALLOWED, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (!allowed) throw new ForbiddenException('Personal access tokens cannot use this route');
      const key = await this.db.apiKey.findUnique({ where: { keyHash: sha256(token) } });
      if (!key || key.revokedAt) throw new UnauthorizedException('Invalid token');
      // Record use at most once a minute.
      if (!key.lastUsedAt || Date.now() - key.lastUsedAt.getTime() > 60_000) {
        void this.db.apiKey
          .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
          .catch(() => {});
      }
      request.user = { id: key.userId, via: 'token' };
      return true;
    }

    let payload: { sub: string; iat?: number; iatMs?: number };
    try {
      payload = await this.jwt.verifyAsync<typeof payload>(token);
    } catch {
      throw new UnauthorizedException(apiError('sessionExpired'));
    }
    // Ended since it was issued (password changed, signed out everywhere), or the account is gone.
    const user = await this.db.user.findUnique({
      where: { id: payload.sub },
      select: { sessionsValidFrom: true },
    });
    const issuedAt = payload.iatMs ?? (payload.iat ?? 0) * 1000;
    if (!user || (user.sessionsValidFrom && issuedAt < user.sessionsValidFrom.getTime())) {
      throw new UnauthorizedException(apiError('sessionExpired'));
    }
    request.user = { id: payload.sub, via: 'session' };
    return true;
  }
}

/** The signed-in user (requires AuthGuard). */
export const CurrentUser = createParamDecorator(
  (_: unknown, context: ExecutionContext): AuthUser => {
    const user = context.switchToHttp().getRequest<AuthedRequest>().user;
    if (!user) throw new UnauthorizedException();
    return user;
  },
);
