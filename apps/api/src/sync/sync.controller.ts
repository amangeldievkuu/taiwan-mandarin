import { Controller, HttpCode, Inject, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  SyncRequestSchema,
  type SyncRequest,
  type SyncResponse,
} from '@taiwan-mandarin/shared/api';
import { AuthGuard, CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import { ApiZodBody, ZodBody } from '../common/zod.js';
import { SyncService } from './sync.service.js';

@ApiTags('sync')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('v1/sync')
export class SyncController {
  constructor(@Inject(SyncService) private readonly sync: SyncService) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'Two-way sync of cards, review logs, deck and settings' })
  @ApiZodBody(SyncRequestSchema)
  run(
    @CurrentUser() user: AuthUser,
    @ZodBody(SyncRequestSchema) body: SyncRequest,
  ): Promise<SyncResponse> {
    return this.sync.sync(user.id, body);
  }
}
