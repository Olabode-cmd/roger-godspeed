/**
 * validator.ts
 *
 * Opt-in middleware for struct/schema response payload validation.
 *
 * ADR-3 Implementation:
 * Isolates schema parsing library bindings (like Zod or TypeBox)
 * from the core error class. All validation failures are intercepted
 * here and packed seamlessly into a dumb GodspeedValidationError carrier.
 *
 * Dependencies: imports `MiddlewareFn` from `../types`, `ValidationError` from `../errors`.
 */
import { ValidationError } from '../errors';
import type { MiddlewareFn } from '../types';

export interface SchemaParser<T> {
  parse: (data: unknown) => T;
}

export interface SafeSchemaParser<T> {
  safeParse: (data: unknown) => { success: true; data: T } | { success: false; error: unknown };
}

export type ValidatorSchema<T> = SchemaParser<T> | SafeSchemaParser<T>;

export function validateResponse<T>(schema: ValidatorSchema<T>): MiddlewareFn {
  return async (req, next) => {
    const res = await next(req);

    if ('safeParse' in schema) {
      const result = schema.safeParse(res.parsedBody);
      if (result.success) {
        return { ...res, parsedBody: result.data };
      }
      throw new ValidationError("Schema validation failed", result.error);
    }

    try {
      const data = schema.parse(res.parsedBody);
      return { ...res, parsedBody: data };
    } catch (error: unknown) {
      throw new ValidationError("Schema validation failed", error);
    }
  };
}
