// Turning the daily reminder on and off for a device, and trying it out.

import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  apiError,
  PushSubscribeSchema,
  PushUnsubscribeSchema,
  type PushConfigDto,
  type PushSubscribeBody,
  type PushTestDto,
} from '@taiwan-mandarin/shared/api';
import type { z } from 'zod';
import { AuthGuard, CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import { ApiZodBody, ZodBody } from '../common/zod.js';
import { PushService } from './push.service.js';
import { ReminderService } from './reminder.service.js';

@ApiTags('reminders')
@Controller('v1/push')
export class PushController {
  constructor(
    @Inject(PushService) private readonly push: PushService,
    @Inject(ReminderService) private readonly reminders: ReminderService,
  ) {}

  /** Public, so the app knows before sign-in whether this server sends reminders. */
  @Get('config')
  @ApiOperation({ summary: 'The VAPID key to subscribe with; null when reminders are off' })
  config(): PushConfigDto {
    return { publicKey: this.push.publicKey };
  }

  @Post('subscribe')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @HttpCode(204)
  @ApiOperation({ summary: 'Turn the daily reminder on for this device' })
  @ApiZodBody(PushSubscribeSchema)
  async subscribe(
    @CurrentUser() user: AuthUser,
    @ZodBody(PushSubscribeSchema) body: PushSubscribeBody,
  ): Promise<void> {
    this.requirePush();
    await this.push.subscribe(user.id, body);
  }

  @Post('unsubscribe')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @HttpCode(204)
  @ApiOperation({ summary: 'Turn the daily reminder off for this device' })
  @ApiZodBody(PushUnsubscribeSchema)
  async unsubscribe(
    @CurrentUser() user: AuthUser,
    @ZodBody(PushUnsubscribeSchema) body: z.infer<typeof PushUnsubscribeSchema>,
  ): Promise<void> {
    await this.push.unsubscribe(user.id, body.endpoint);
  }

  @Post('test')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: 'Send the reminder now to every device that turned it on' })
  async test(@CurrentUser() user: AuthUser): Promise<PushTestDto> {
    this.requirePush();
    return this.reminders.sendNow(user.id);
  }

  private requirePush(): void {
    if (!this.push.publicKey) throw new ServiceUnavailableException(apiError('remindersNotSetUp'));
  }
}
