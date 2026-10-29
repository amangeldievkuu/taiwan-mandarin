// Rate-limited requests answer in plain words, rather than "ThrottlerException: Too Many Requests".

import { Catch, HttpStatus, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { apiError } from '@taiwan-mandarin/shared/api';
import type { Response } from 'express';

@Catch(ThrottlerException)
export class ThrottlerFilter implements ExceptionFilter {
  catch(_: ThrottlerException, host: ArgumentsHost): void {
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(HttpStatus.TOO_MANY_REQUESTS)
      .json({
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        ...apiError('tooManyAttempts'),
      });
  }
}
