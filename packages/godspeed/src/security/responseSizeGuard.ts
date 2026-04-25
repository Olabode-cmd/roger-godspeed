/**
 * responseSizeGuard.ts
 *
 * Enforces maximum response body size limits to prevent memory exhaustion
 * attacks from servers returning unbounded or maliciously large payloads.
 *
 * This module exists as a separate concern because size validation requires
 * stream manipulation that would pollute the response parser with unrelated
 * control flow. Isolating it allows the guard to be tested independently
 * against both Content-Length fast-path and streaming fallback scenarios.
 *
 * Performance note: Uses a hybrid approach. When Content-Length header is
 * present, performs a single integer comparison (zero overhead). When absent
 * (chunked/streamed responses), wraps the body stream with a counting
 * transform that tracks bytes incrementally. The transform is only allocated
 * when needed, keeping the common path allocation-free.
 *
 * Dependencies: imports ResponseSizeError from `../errors`.
 */

import { ResponseSizeError } from '../errors';

/**
 * Default maximum response size in bytes (10MB).
 * Chosen as a reasonable upper bound for JSON API responses while
 * preventing multi-gigabyte payloads from exhausting memory.
 */
export const DEFAULT_MAX_RESPONSE_SIZE = 10 * 1024 * 1024;

/**
 * Validates that a response body does not exceed the configured size limit.
 *
 * Uses a two-phase approach:
 *   1. Fast path: Check Content-Length header if present. Throws immediately
 *      if the declared size exceeds the limit. Zero overhead for compliant
 *      responses with Content-Length.
 *   2. Fallback: If Content-Length is missing or zero (chunked/streamed),
 *      wraps the response body with a counting TransformStream that tracks
 *      bytes as they flow through and throws mid-stream if limit exceeded.
 *
 * Returns the original Response if Content-Length check passes, or a new
 * Response with the guarded stream if fallback is needed.
 */
export function guardResponseSize(
  response: Response,
  maxSize: number = DEFAULT_MAX_RESPONSE_SIZE
): Response {
  const contentLengthHeader = response.headers.get('content-length');

  if (contentLengthHeader) {
    const declaredSize = parseInt(contentLengthHeader, 10);
    if (!isNaN(declaredSize) && declaredSize > maxSize) {
      throw new ResponseSizeError(
        `Response size ${declaredSize} bytes exceeds limit of ${maxSize} bytes`,
        maxSize,
        declaredSize
      );
    }
    return response;
  }

  if (!response.body) {
    return response;
  }

  let bytesRead = 0;

  const countingTransform = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      bytesRead += chunk.byteLength;
      if (bytesRead > maxSize) {
        controller.error(
          new ResponseSizeError(
            `Response size exceeded ${maxSize} bytes during streaming`,
            maxSize,
            bytesRead
          )
        );
        return;
      }
      controller.enqueue(chunk);
    },
  });

  const guardedBody = response.body.pipeThrough(countingTransform);

  return new Response(guardedBody, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}