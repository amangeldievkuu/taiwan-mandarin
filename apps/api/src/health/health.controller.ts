import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ContentService } from '../content/content.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(ContentService) private readonly content: ContentService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Liveness, database and content status' })
  async check() {
    const database = await this.db.$queryRaw`SELECT 1`.then(
      () => true,
      () => false,
    );
    return { ok: database, database, content: this.content.manifest?.version ?? null };
  }
}
