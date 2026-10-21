// Request validation with the shared zod schemas. `@ZodBody(schema)` validates the body and
// documents it in Swagger (zod → JSON Schema), so there is one source of truth for both.

import { applyDecorators, BadRequestException, Body, type PipeTransform } from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';
import { z } from 'zod';

export class ZodPipe<T extends z.ZodType> implements PipeTransform<unknown, z.infer<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.infer<T> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Invalid request',
        issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    return result.data;
  }
}

/** Documents a request body in Swagger from a zod schema. */
export const ApiZodBody = (schema: z.ZodType) =>
  applyDecorators(
    ApiBody({ schema: z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as object }),
  );

/** Parameter decorator: the validated body. */
export const ZodBody = <T extends z.ZodType>(schema: T) => Body(new ZodPipe(schema));
