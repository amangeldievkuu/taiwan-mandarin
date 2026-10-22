// Database errors the request caused (a duplicate, a row that is gone) become 4xx answers
// instead of 500s. Everything else goes to Nest's default handling.

import {
  Catch,
  ConflictException,
  NotFoundException,
  type ArgumentsHost,
  type HttpException,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '../generated/prisma/client.js';

const MAPPED: Record<string, () => HttpException> = {
  // Unique constraint, e.g. two sign-ups with one email at the same moment.
  P2002: () => new ConflictException('That already exists'),
  // A related row is missing, e.g. a session whose account was just deleted.
  P2003: () => new NotFoundException('Not found'),
  // The row to update or delete is gone.
  P2025: () => new NotFoundException('Not found'),
};

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaErrorFilter extends BaseExceptionFilter {
  override catch(error: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost): void {
    super.catch(MAPPED[error.code]?.() ?? error, host);
  }
}
