import {
  Controller,
  Delete,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
  Get,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import {
  LoginSchema,
  RegisterSchema,
  type AuthResponse,
  type LoginBody,
  type RegisterBody,
  type UserDto,
} from '@taiwan-mandarin/shared/api';
import { ENV, type Env } from '../config/env.js';
import { ApiZodBody, ZodBody } from '../common/zod.js';
import { AuthGuard, CurrentUser, type AuthUser } from './auth.guard.js';
import { AuthService, REFRESH_TTL_MS, type Session } from './auth.service.js';

const COOKIE = 'tm_refresh';

@ApiTags('auth')
@Controller('v1/auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Post('register')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Create an account and sign in' })
  @ApiZodBody(RegisterSchema)
  async register(
    @ZodBody(RegisterSchema) body: RegisterBody,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.respond(res, await this.auth.register(body, req.headers['user-agent']));
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Sign in' })
  @ApiZodBody(LoginSchema)
  async login(
    @ZodBody(LoginSchema) body: LoginBody,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.respond(res, await this.auth.login(body, req.headers['user-agent']));
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'New access token from the refresh cookie (rotates the cookie)' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    try {
      return this.respond(
        res,
        await this.auth.refresh(this.cookie(req), req.headers['user-agent']),
      );
    } catch (e) {
      res.clearCookie(COOKIE, { path: '/' });
      throw e;
    }
  }

  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Sign out on this device' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(this.cookie(req));
    res.clearCookie(COOKIE, { path: '/' });
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'The signed-in user' })
  me(@CurrentUser() user: AuthUser): Promise<UserDto> {
    return this.auth.me(user.id);
  }

  @Delete('me')
  @HttpCode(204)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete the account and all its data' })
  async remove(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.deleteAccount(user.id);
    res.clearCookie(COOKIE, { path: '/' });
  }

  private cookie(req: Request): string | undefined {
    const cookies = req.cookies as Record<string, string> | undefined;
    return cookies?.[COOKIE];
  }

  private respond(res: Response, session: Session): AuthResponse {
    const { refreshToken, ...body } = session;
    res.cookie(COOKIE, refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.env.NODE_ENV === 'production',
      path: '/',
      maxAge: REFRESH_TTL_MS,
    });
    return body;
  }
}
