import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { TokenCreatedDto, TokenDto } from '@taiwan-mandarin/shared/api';
import { randomToken, sha256 } from '../auth/crypto.js';
import { PrismaService } from '../prisma/prisma.service.js';

const toDto = (k: {
  id: string;
  name: string;
  prefix: string;
  createdAt: Date;
  lastUsedAt: Date | null;
}): TokenDto => ({
  id: k.id,
  name: k.name,
  prefix: k.prefix,
  createdAt: k.createdAt.toISOString(),
  lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
});

@Injectable()
export class TokensService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async list(userId: string): Promise<TokenDto[]> {
    const keys = await this.db.apiKey.findMany({
      where: { userId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return keys.map(toDto);
  }

  async create(userId: string, name: string): Promise<TokenCreatedDto> {
    const token = `tm_${randomToken(24)}`;
    const key = await this.db.apiKey.create({
      data: { userId, name, prefix: token.slice(0, 10), keyHash: sha256(token) },
    });
    return { ...toDto(key), token };
  }

  async revoke(userId: string, id: string): Promise<void> {
    const { count } = await this.db.apiKey.updateMany({
      where: { id, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (!count) throw new NotFoundException('No such token');
  }
}
