/**
 * error.ts
 *
 * Defines the discriminated union for all Godspeed error states.
 *
 * These types enforce strict narrowing for our exception handling.
 * The ValidationError explicitly carries unknown details
 * and contains no formatting or diff logic.
 *
 * ParseError captures body deserialization failures that occur when
 * the server's Content-Type header does not match the actual body content.
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

export interface GodspeedParseError extends Error {
  type: 'parse';
  /**
   * The Content-Type header value from the response that triggered
   * the parse failure.
   */
  contentType: string;
}

export interface GodspeedSSRFError extends Error {
  type: 'ssrf';
  /**
   * The URL that was blocked by the SSRF guard.
   */
  blockedURL: string;
}

export interface GodspeedResponseSizeError extends Error {
  type: 'response_size';
  /**
   * The maximum allowed response size in bytes.
   */
  maxSize: number;
  /**
   * The actual size that was encountered or projected.
   */
  actualSize: number;
}

export interface GodspeedHeaderInjectionError extends Error {
  type: 'header_injection';
  /**
   * The header name or value that triggered the injection detection.
   */
  offendingHeader: string;
}

export interface GodspeedRedirectError extends Error {
  type: 'redirect';
  /**
   * The number of redirects that were attempted.
   */
  redirectCount: number;
}

/**
 * Union type representing any error explicitly thrown by the Godspeed pipeline.
 */
export type GodspeedError =
  | GodspeedNetworkError
  | GodspeedTimeoutError
  | GodspeedHttpError
  | GodspeedValidationError
  | GodspeedParseError
  | GodspeedSSRFError
  | GodspeedResponseSizeError
  | GodspeedHeaderInjectionError
  | GodspeedRedirectError;
