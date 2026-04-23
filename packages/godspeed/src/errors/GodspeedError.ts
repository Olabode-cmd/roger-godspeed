/**
 * GodspeedError.ts
 *
 * Implements the concrete Error classes for the Godspeed client.
 *
 * This module exists as a separate concern to act as the single source
 * of truth for exception instantiation without bundling external dependencies.
 *
 * Performance note: These classes merely initialize properties; they do no
 * string manipulation or formatting, maximizing instantiation speed.
 *
 * All constructors accept an optional `ErrorOptions` parameter to support
 * the ES2022 error `cause` chain, preserving original stack traces when
 * wrapping native exceptions.
 *
 * Dependencies: imports interfaces from `../types`.
 */

import type {
  GodspeedNetworkError,
  GodspeedTimeoutError,
  GodspeedHttpError,
  GodspeedValidationError,
  GodspeedParseError,
  GodspeedSSRFError,
  GodspeedResponseSizeError,
  GodspeedHeaderInjectionError,
  GodspeedRedirectError,
} from '../types';

/**
 * Base abstract class for Godspeed errors.
 *
 * Ensures all Godspeed errors can be identified via instanceof checks
 * and generic interface matching. Forwards the ES2022 `cause` option
 * to preserve the original error chain.
 */
export abstract class BaseGodspeedError extends Error {
  public abstract readonly type: string;

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * NetworkError class.
 *
 * Wraps native fetch failures like DNS resolution errors or connection resets.
 * The original exception should be passed as `cause` to preserve debug context.
 */
export class NetworkError extends BaseGodspeedError implements GodspeedNetworkError {
  public readonly type = 'network';

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

/**
 * TimeoutError class.
 *
 * Represents an explicitly aborted request due to hitting a timeout limit.
 */
export class TimeoutError extends BaseGodspeedError implements GodspeedTimeoutError {
  public readonly type = 'timeout';

  constructor(
    message: string,
    public readonly timeoutMs: number,
    options?: ErrorOptions
  ) {
    super(message, options);
  }
}

/**
 * HttpError class.
 *
 * Thrown for responses that do not have a 2xx status code.
 * Carries the parsed response body if available.
 */
export class HttpError extends BaseGodspeedError implements GodspeedHttpError {
  public readonly type = 'http';

  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
    options?: ErrorOptions
  ) {
    super(message, options);
  }
}

/**
 * ValidationError class.
 *
 * A dumb data carrier for schema validation failures.
 * Contains no diff or formatting logic to remain lightweight and tree-shakable.
 */
export class ValidationError extends BaseGodspeedError implements GodspeedValidationError {
  public readonly type = 'validation';

  constructor(
    message: string,
    public readonly details: unknown,
    options?: ErrorOptions
  ) {
    super(message, options);
  }
}

/**
 * ParseError class.
 *
 * Thrown when the response body cannot be deserialized according to
 * the Content-Type header. Carries the content type that triggered the failure
 * and the original parse exception as `cause`.
 */
export class ParseError extends BaseGodspeedError implements GodspeedParseError {
  public readonly type = 'parse';

  constructor(
    message: string,
    public readonly contentType: string,
    options?: ErrorOptions
  ) {
    super(message, options);
  }
}

/**
 * SSRFError class.
 *
 * Thrown when a request targets a private, reserved, or otherwise
 * blocked network address. Carries the offending URL for diagnostics.
 */
export class SSRFError extends BaseGodspeedError implements GodspeedSSRFError {
  public readonly type = 'ssrf';

  constructor(
    message: string,
    public readonly blockedURL: string,
    options?: ErrorOptions
  ) {
    super(message, options);
  }
}

/**
 * ResponseSizeError class.
 *
 * Thrown when a response body exceeds the configured maximum size limit.
 * Carries both the limit and the actual/projected size for diagnostics.
 */
export class ResponseSizeError extends BaseGodspeedError implements GodspeedResponseSizeError {
  public readonly type = 'response_size';

  constructor(
    message: string,
    public readonly maxSize: number,
    public readonly actualSize: number,
    options?: ErrorOptions
  ) {
    super(message, options);
  }
}

/**
 * HeaderInjectionError class.
 *
 * Thrown when a header name or value contains characters that could
 * enable CRLF injection or HTTP request smuggling attacks.
 * Carries the offending header for diagnostics.
 */
export class HeaderInjectionError extends BaseGodspeedError implements GodspeedHeaderInjectionError {
  public readonly type = 'header_injection';

  constructor(
    message: string,
    public readonly offendingHeader: string,
    options?: ErrorOptions
  ) {
    super(message, options);
  }
}

/**
 * RedirectError class.
 *
 * Thrown when a request exceeds the maximum allowed redirect count,
 * or when a redirect attempts a protocol downgrade (https to http).
 * Carries the redirect count for diagnostics.
 */
export class RedirectError extends BaseGodspeedError implements GodspeedRedirectError {
  public readonly type = 'redirect';

  constructor(
    message: string,
    public readonly redirectCount: number,
    options?: ErrorOptions
  ) {
    super(message, options);
  }
}
