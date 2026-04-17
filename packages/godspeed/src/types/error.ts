/**
 * error.ts
 *
 * Defines the discriminated union for all Godspeed error states.
 *
 * These types enforce strict narrowing for our exception handling.
 * The ValidationError explicitly carries unknown details
 * and contains no formatting or diff logic.
 */

export interface GodspeedNetworkError extends Error {
  type: 'network';
}

export interface GodspeedTimeoutError extends Error {
  type: 'timeout';
  timeoutMs: number;
}

export interface GodspeedHttpError extends Error {
  type: 'http';
  status: number;
  body: unknown;
}

export interface GodspeedValidationError extends Error {
  type: 'validation';
  /**
   * Raw failure details yielded by the underlying schema validator.
   */
  details: unknown;
}

/**
 * Union type representing any error explicitly thrown by the Godspeed pipeline.
 */
export type GodspeedError = 
  | GodspeedNetworkError
  | GodspeedTimeoutError
  | GodspeedHttpError
  | GodspeedValidationError;
