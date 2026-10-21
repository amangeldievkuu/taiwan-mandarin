// Accepts `Authorization: Bearer <JWT>` (the web app) or `Bearer tm_…` (a personal access token
// for the public API) and puts the user id on the request.

import {
  createParamDecorator,
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';
import { sha256 } from './crypto.js';

export interface AuthUser {
  id: string;
  via: 'session' | 'token';
}

type AuthedRequest = Request & { user?: AuthUser };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(PrismaService) private readonly db: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const header = request.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) throw new UnauthorizedException('Sign in or send a token');

    if (token.startsWith('tm_')) {
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

    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token);
      request.user = { id: payload.sub, via: 'session' };
      return true;
    } catch {
      throw new UnauthorizedException('Session expired');
    }
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
