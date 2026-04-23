/**
 * index.ts
 *
 * Public API entry point for the Godspeed HTTP client.
 *
 * Exports only the public-facing API surface: the client class, type
 * definitions, error classes, and opt-in middleware factories.
 * Internal utilities (compose, configResolver, requestBuilder,
 * responseParser, createPipeline) are deliberately excluded to prevent
 * external dependencies on implementation details.
 *
 * The compat layer is exported via a separate entry point
 * (godspeed/compat) as defined in package.json exports.
 */

export { GodspeedClient } from './core/GodspeedClient';

export type {
  GodspeedConfig,
  GodspeedResponse,
  MiddlewareFn,
  NextFn,
  GodspeedError,
  GodspeedNetworkError,
  GodspeedTimeoutError,
  GodspeedHttpError,
  GodspeedValidationError,
  GodspeedParseError,
  GodspeedSSRFError,
  GodspeedResponseSizeError,
  GodspeedHeaderInjectionError,
} from './types';

export {
  BaseGodspeedError,
  NetworkError,
  TimeoutError,
  HttpError,
  ValidationError,
  ParseError,
  SSRFError,
  ResponseSizeError,
  HeaderInjectionError,
} from './errors';

export { bearerAuth } from './middleware/auth';
export { logger } from './middleware/logger';
export type { LoggerOptions } from './middleware/logger';
export { validateResponse } from './middleware/validator';
export type { SchemaParser, SafeSchemaParser, ValidatorSchema } from './middleware/validator';
