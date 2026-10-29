// Request validation with the shared zod schemas. `@ZodBody(schema)` validates the body and
// documents it in Swagger (zod → JSON Schema), so there is one source of truth for both.

import { applyDecorators, BadRequestException, Body, type PipeTransform } from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';
import { errorCodeOf } from '@taiwan-mandarin/shared/api';
import { z } from 'zod';

export class ZodPipe<T extends z.ZodType> implements PipeTransform<unknown, z.infer<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.infer<T> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const issues = result.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }));
      // The first problem, so a form can show it as it is; the schemas word their own messages,
      // and the shared ones have a code an app can show in its language.
      const message = issues[0]?.message ?? 'Invalid request';
      const code = errorCodeOf(message);
      throw new BadRequestException({ message, ...(code ? { code } : {}), issues });
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
