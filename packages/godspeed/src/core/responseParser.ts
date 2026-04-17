/**
 * responseParser.ts
 *
 * Parses a native Fetch `Response` into a `GodspeedResponse<TData>`.
 *
 * This is the critical implementation of ADR-2. This module reads the stream
 * exactly once and explicitly maps it to `parsedBody` so the raw Response 
 * cannot be abused by downstream middleware.
 *
 * Dependencies: imports interfaces from `../types`.
 */
import type { GodspeedResponse } from '../types';

export async function parseResponse<TData = unknown>(response: Response): Promise<GodspeedResponse<TData>> {
  let parsedBody: unknown;
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    parsedBody = await response.json();
  } else if (contentType.includes('text/')) {
    parsedBody = await response.text();
  } else {
    parsedBody = await response.arrayBuffer();
  }

  return {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
    parsedBody: parsedBody as TData
  };
}
