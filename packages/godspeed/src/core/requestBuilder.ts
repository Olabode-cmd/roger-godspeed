/**
 * requestBuilder.ts
 *
 * Constructs a native Fetch `Request` object.
 *
 * This isolates URL path concatenation and payload serialization from the middleware.
 *
 * Performance note: Uses basic string concatenation for paths dynamically, 
 * bypassing heavy URL parsing APIs when not explicitly required.
 *
 * Dependencies: imports interfaces from `../types`.
 */
import type { GodspeedConfig } from '../types';

export function buildRequest(
  method: string,
  path: string,
  config: GodspeedConfig,
  body?: unknown
): Request {
  let urlStr = path;

  if (config.baseURL && !path.startsWith('http://') && !path.startsWith('https://')) {
    const base = config.baseURL.replace(/\/$/, '');
    const reqPath = path.startsWith('/') ? path : `/${path}`;
    urlStr = `${base}${reqPath}`;
  }
  
  const headers = new Headers(config.headers);
  const init: RequestInit = { method, headers };

  if (body !== undefined && body !== null) {
    if (typeof body === 'string') {
      init.body = body;
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'text/plain');
      }
    } else if (
      body instanceof Blob || 
      body instanceof ArrayBuffer || 
      body instanceof FormData || 
      body instanceof URLSearchParams
    ) {
      init.body = body as BodyInit;
    } else {
      init.body = JSON.stringify(body);
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
    }
  }

  return new Request(urlStr, init);
}
