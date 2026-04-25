/**
 * headerGuard.ts
 *
 * Sanitizes HTTP header names and values to prevent CRLF injection attacks
 * (CWE-113) and HTTP request smuggling vulnerabilities.
 *
 * This module exists as a separate concern because header validation requires
 * character-level scanning that would pollute the request builder with
 * unrelated security logic. Isolating it allows the guard to be tested
 * independently against known injection vectors.
 *
 * CRLF injection occurs when an attacker injects carriage return (\r) or
 * line feed (\n) characters into HTTP headers, allowing them to:
 *   - Inject additional headers (e.g., smuggling cookies or auth tokens)
 *   - Split a single request into multiple requests (request smuggling)
 *   - Inject response content (in some proxy configurations)
 *
 * Performance note: Uses lazy validation. The fast path performs two indexOf
 * checks per header value (scanning for \r and \n). Only when suspicious
 * characters are detected does it allocate a new string via replace().
 * Header names are validated by the native Headers API, which throws
 * TypeError for invalid tokens per RFC 7230.
 *
 * Dependencies: imports HeaderInjectionError from `../errors`.
 */

import { HeaderInjectionError } from '../errors';

/**
 * Sanitizes a header value by stripping carriage return and line feed
 * characters that could enable CRLF injection attacks.
 *
 * Uses a lazy two-phase approach:
 *   1. Fast path: Check if \r or \n exist using indexOf (zero allocations).
 *      If neither is found, return the original string unchanged.
 *   2. Slow path: If suspicious characters detected, allocate a new string
 *      with all \r and \n stripped via replace().
 *
 * This ensures the common case (clean headers) pays only for two indexOf
 * scans, while malicious input triggers the defensive strip operation.
 *
 * Edge case: Empty strings and whitespace-only values are allowed, as the
 * HTTP spec permits them and they pose no injection risk.
 */
export function sanitizeHeaderValue(value: string): string {
  if (value.indexOf('\r') === -1 && value.indexOf('\n') === -1) {
    return value;
  }

  return value.replace(/[\r\n]/g, '');
}

/**
 * Validates that a header name conforms to RFC 7230 token rules.
 *
 * Rather than implementing full RFC 7230 validation ourselves, we rely on
 * the native Headers API to reject invalid header names. The Headers
 * constructor throws TypeError for names containing:
 *   - Whitespace (space, tab)
 *   - Control characters (0x00-0x1F, 0x7F)
 *   - Separators like : ; , = etc.
 *
 * This function wraps that behavior and converts the generic TypeError
 * into a typed HeaderInjectionError for consistent error handling.
 *
 * Performance note: This validation happens implicitly when we construct
 * the Headers object in requestBuilder. This function exists primarily
 * for explicit pre-validation in contexts where we want to fail fast
 * before reaching the Headers constructor.
 */
export function validateHeaderName(name: string): void {
  try {
    new Headers({ [name]: 'test' });
  } catch (error: unknown) {
    if (error instanceof TypeError) {
      throw new HeaderInjectionError(
        `Invalid header name "${name}" — contains forbidden characters`,
        name,
        { cause: error }
      );
    }
    throw error;
  }
}

/**
 * Sanitizes all headers in a record, returning a new record with
 * cleaned values and validated names.
 *
 * Iterates each header entry and applies:
 *   1. Name validation (via Headers API implicit check)
 *   2. Value sanitization (CRLF stripping)
 *
 * Returns a new object to avoid mutating the input config.
 * If the input is undefined or empty, returns undefined to preserve
 * the original config shape.
 */
export function sanitizeHeaders(
  headers: Record<string, string> | undefined
): Record<string, string> | undefined {
  if (!headers || Object.keys(headers).length === 0) {
    return headers;
  }

  const sanitized: Record<string, string> = {};

  for (const [name, value] of Object.entries(headers)) {
    validateHeaderName(name);
    sanitized[name] = sanitizeHeaderValue(value);
  }

  return sanitized;
}
