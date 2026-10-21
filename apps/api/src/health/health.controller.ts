import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  // Database check is added with Prisma in Phase 2.
  @Get()
  check(): { ok: true } {
    return { ok: true };
  }
}
