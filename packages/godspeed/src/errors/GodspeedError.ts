/**
 * GodspeedError.ts
 *
 * Implements the concrete Error classes for the Godspeed client.
 *
 * This module exists as a separate concern to act as the single source
 * of truth for exception instantiations without bundling external dependencies.
 *
 * Performance note: These classes merely initialize properties; they do no string manipulation
 * or formatting, maximizing instantiation speed.
 *
 * Dependencies: imports interfaces from `../types`.
 */

import type {
  GodspeedNetworkError,
  GodspeedTimeoutError,
  GodspeedHttpError,
  GodspeedValidationError,
} from '../types';

/**
 * Base abstract class for Godspeed errors.
 *
 * Ensures all Godspeed errors can be identified via instanceof checks
 * and generic interface matching.
 */
export abstract class BaseGodspeedError extends Error {
  public abstract readonly type: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * NetworkError class.
 *
 * Wraps native fetch failures like DNS resolution errors or connection timeouts.
 */
export class NetworkError extends BaseGodspeedError implements GodspeedNetworkError {
  public readonly type = 'network';

  constructor(message: string) {
    super(message);
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
    public readonly timeoutMs: number
  ) {
    super(message);
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
    public readonly body: unknown
  ) {
    super(message);
  }
}

/**
 * ValidationError class.
 *
 * A dumb data carrier for schema validation failures.
 * Contains no diff logic formatting to remain lightweight and tree-shakable.
 */
export class ValidationError extends BaseGodspeedError implements GodspeedValidationError {
  public readonly type = 'validation';

  constructor(
    message: string,
    public readonly details: unknown
  ) {
    super(message);
  }
}
