/**
 * requestBuilder.ts
 *
 * Constructs a native Fetch `Request` object from a method, path,
 * resolved config, and optional body.
 *
 * This isolates URL path concatenation and payload serialization
 * from the middleware pipeline.
 *
 * Performance note: Uses basic string concatenation for paths,
 * bypassing heavy URL parsing APIs when not explicitly required.
 * A type guard function eliminates unsafe `as` casts for native body
 * types while keeping the hot path branch-free for the common JSON case.
 *
 * Dependencies: imports interfaces from `../types`.
 */
import type { GodspeedConfig } from '../types';

/**
 * Determines whether a value is a native body type that can be passed
 * directly to the Fetch API Request constructor without serialization.
 *
 * This type guard replaces an unsafe `as` cast by providing compile-time
 * narrowing that matches the BodyInit union accepted by RequestInit.
 */
function isNativeBody(
  value: unknown
): value is Blob | ArrayBuffer | FormData | URLSearchParams | ReadableStream {
  return (
    value instanceof Blob ||
    value instanceof ArrayBuffer ||
    value instanceof FormData ||
    value instanceof URLSearchParams ||
    value instanceof ReadableStream
  );
}

/**
 * Constructs a native Fetch `Request` from a method, path, resolved config,
 * and optional body.
 *
 * URL resolution handles absolute URLs, relative paths, and protocol-relative
 * URLs (`//cdn.example.com`). BaseURL concatenation uses explicit length checks
 * instead of relying on truthiness to avoid subtle empty-string edge cases.
 *
 * Body serialization is exhaustive: strings are sent as text/plain, native
 * body types pass through directly, and all other values are JSON-stringified.
 */
export function buildRequest(
  method: string,
  path: string,
  config: GodspeedConfig,
  body?: unknown
): Request {
  let urlStr = path;

  if (
    config.baseURL !== undefined &&
    config.baseURL.length > 0 &&
    !path.startsWith('http://') &&
    !path.startsWith('https://') &&
    !path.startsWith('//')
  ) {
    const base = config.baseURL.replace(/\/$/, '');
    const reqPath = path.startsWith('/') ? path : `/${path}`;
    urlStr = `${base}${reqPath}`;
  }

  const headers = new Headers(config.headers);
  const init: RequestInit = { method, headers };

  if (config.withCredentials) {
    init.credentials = 'include';
  }

  if (body !== undefined && body !== null) {
    if (typeof body === 'string') {
      init.body = body;
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'text/plain');
      }
    } else if (isNativeBody(body)) {
      init.body = body;
    } else {
      init.body = JSON.stringify(body);
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
    }
  }

  return new Request(urlStr, init);
}
