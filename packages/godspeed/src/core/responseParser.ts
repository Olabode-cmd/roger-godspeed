/**
 * responseParser.ts
 *
 * Parses a native Fetch `Response` into a `GodspeedResponse<unknown>`.
 *
 * This is the critical implementation of ADR-2. This module reads the body
 * stream exactly once and materializes it as `parsedBody` so the raw Response
 * cannot be abused by downstream middleware.
 *
 * Parse failures (e.g., a server claiming `application/json` but returning
 * HTML) throw a typed `ParseError` with the original exception as `cause`,
 * ensuring no untyped exceptions escape the pipeline.
 *
 * Returns `GodspeedResponse<unknown>` instead of a generic `TData`
 * because the parser has no runtime knowledge of the expected type.
 * Type narrowing to a concrete `TData` is the responsibility of
 * validation middleware or the client API boundary.
 *
 * Dependencies: imports `GodspeedResponse` from `../types`,
 *               imports `ParseError` from `../errors`.
 */
import type { GodspeedResponse } from '../types';
import { ParseError } from '../errors';

/**
 * Consumes the raw Response body exactly once and returns a
 * GodspeedResponse with the materialized `parsedBody`.
 *
 * Content-type detection determines the parsing strategy:
 *   - `application/json` → JSON.parse (via response.json())
 *   - `text/*` → string (via response.text())
 *   - anything else → ArrayBuffer (via response.arrayBuffer())
 *
 * If JSON parsing fails (malformed body, truncated response, HTML error page
 * from a proxy), a typed `ParseError` is thrown with the original `SyntaxError`
 * preserved in the `cause` chain.
 */
export async function parseResponse(response: Response): Promise<GodspeedResponse<unknown>> {
  const contentType = response.headers.get('content-type') ?? '';

  let parsedBody: unknown;

  if (contentType.includes('application/json')) {
    try {
      parsedBody = await response.json();
    } catch (error: unknown) {
      throw new ParseError(
        'Failed to parse response body as JSON',
        contentType,
        { cause: error }
      );
    }
  } else if (contentType.includes('text/')) {
    parsedBody = await response.text();
  } else {
    parsedBody = await response.arrayBuffer();
  }

  return {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
    parsedBody
  };
}
