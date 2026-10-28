import {
  Controller,
  Delete,
  HttpCode,
  Inject,
  Logger,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
  Get,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import {
  ChangePasswordSchema,
  LoginSchema,
  RegisterSchema,
  type AuthResponse,
  type ChangePasswordBody,
  type LoginBody,
  type RegisterBody,
  type UserDto,
} from '@taiwan-mandarin/shared/api';
import { ENV, type Env } from '../config/env.js';
import { ApiZodBody, ZodBody } from '../common/zod.js';
import { AuthGuard, CurrentUser, type AuthUser } from './auth.guard.js';
import { AuthService, REFRESH_TTL_MS, type Session } from './auth.service.js';

const COOKIE = 'tm_refresh';
const log = new Logger('Auth');
/** Warned once: a production sign-in over plain http gets a cookie without Secure. */
let warnedInsecure = false;

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
    return this.respond(req, res, await this.auth.register(body, req.headers['user-agent']));
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
    return this.respond(req, res, await this.auth.login(body, req.headers['user-agent']));
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
        req,
        res,
        await this.auth.refresh(this.cookie(req), req.headers['user-agent']),
      );
    } catch (e) {
      // Only a session that is really gone drops the cookie; a database hiccup must not.
      if (e instanceof UnauthorizedException) res.clearCookie(COOKIE, { path: '/' });
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

  @Post('password')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Change the password; signs out every other device (this one gets a new session)',
  })
  @ApiZodBody(ChangePasswordSchema)
  async changePassword(
    @CurrentUser() user: AuthUser,
    @ZodBody(ChangePasswordSchema) body: ChangePasswordBody,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.respond(
      req,
      res,
      await this.auth.changePassword(user.id, body, req.headers['user-agent']),
    );
  }

  @Post('logout-all')
  @HttpCode(204)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Sign out on every device, this one included' })
  async logoutEverywhere(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logoutEverywhere(user.id);
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

  private respond(req: Request, res: Response, session: Session): AuthResponse {
    const { refreshToken, ...body } = session;
    // Secure only when the request really came over https (trust proxy makes req.secure follow
    // X-Forwarded-Proto): a Secure cookie on a plain-http deployment is silently dropped by the
    // browser, which looked like being signed out after fifteen minutes.
    const production = this.env.NODE_ENV === 'production';
    if (production && !req.secure && !warnedInsecure) {
      warnedInsecure = true;
      log.warn(
        'Sign-in over plain http: the session cookie is sent without Secure. Put TLS in front.',
      );
    }
    res.cookie(COOKIE, refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: production && req.secure,
      path: '/',
      maxAge: REFRESH_TTL_MS,
    });
    return body;
  }
}
