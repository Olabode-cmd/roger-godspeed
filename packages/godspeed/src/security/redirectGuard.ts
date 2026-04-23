/**
 * redirectGuard.ts
 *
 * Enforces redirect limits and prevents protocol downgrade attacks during
 * HTTP redirect following.
 *
 * This module exists as a separate concern because redirect validation
 * requires URL parsing and origin comparison logic that would pollute
 * the retry handler or pipeline with unrelated security checks.
 *
 * Redirect vulnerabilities addressed:
 *   - Infinite redirect loops (malicious or misconfigured servers)
 *   - Protocol downgrade attacks (https → http credential leakage)
 *   - Cross-origin credential leakage (Authorization header to third parties)
 *
 * Performance note: Redirect handling is only invoked when the server
 * returns a 3xx status code, so this guard is off the hot path for
 * successful 2xx responses. URL parsing uses the native URL constructor
 * since we need full origin comparison for security decisions.
 *
 * Dependencies: imports RedirectError from `../errors`.
 */

import { RedirectError } from '../errors';

/**
 * Default maximum number of redirects to follow.
 * Chosen to handle legitimate multi-hop redirects (CDN → origin → canonical)
 * while preventing infinite loops.
 */
export const DEFAULT_MAX_REDIRECTS = 5;

/**
 * Headers that contain authentication credentials and must be stripped
 * when following a redirect to a different origin.
 *
 * Prevents credential leakage to third-party domains during redirects.
 * Covers common auth mechanisms: bearer tokens, cookies, basic auth,
 * and proxy credentials.
 */
const SENSITIVE_HEADERS = new Set([
  'authorization',
  'cookie',
  'proxy-authorization',
  'www-authenticate',
]);

/**
 * Extracts the origin (scheme + host + port) from a URL string.
 *
 * Returns the origin in normalized form for comparison.
 * Throws if the URL is malformed (should never happen since the
 * Request constructor already validated it upstream).
 */
function getOrigin(url: string): string {
  return new URL(url).origin;
}

/**
 * Extracts the scheme (protocol) from a URL string.
 *
 * Returns the scheme without the trailing colon (e.g., "https").
 */
function getScheme(url: string): string {
  return new URL(url).protocol.replace(':', '');
}

/**
 * Validates that a redirect does not exceed the maximum allowed count.
 *
 * Throws RedirectError if the limit is exceeded, preventing infinite
 * redirect loops from exhausting resources or hanging the request.
 */
export function assertRedirectLimit(
  redirectCount: number,
  maxRedirects: number = DEFAULT_MAX_REDIRECTS
): void {
  if (redirectCount >= maxRedirects) {
    throw new RedirectError(
      `Exceeded maximum redirect limit of ${maxRedirects}`,
      redirectCount
    );
  }
}

/**
 * Validates that a redirect does not downgrade from HTTPS to HTTP.
 *
 * Protocol downgrades expose credentials and request bodies to
 * network eavesdropping. This check prevents https → http transitions
 * while allowing http → https upgrades and same-scheme redirects.
 *
 * Throws RedirectError if a downgrade is detected.
 */
export function assertNoProtocolDowngrade(
  fromURL: string,
  toURL: string
): void {
  const fromScheme = getScheme(fromURL);
  const toScheme = getScheme(toURL);

  if (fromScheme === 'https' && toScheme === 'http') {
    throw new RedirectError(
      `Blocked protocol downgrade from https to http during redirect`,
      0
    );
  }
}

/**
 * Strips sensitive authentication headers from a Request when following
 * a redirect to a different origin.
 *
 * Returns a new Request with sanitized headers if the origin changed,
 * or the original Request if the redirect is same-origin.
 *
 * This prevents credential leakage when a server redirects to a
 * third-party domain. For example:
 *   - User requests https://api.example.com with Authorization header
 *   - Server redirects to https://evil.com
 *   - Without this guard, Authorization header would leak to evil.com
 *
 * Performance note: Only allocates a new Request when the origin changes
 * and sensitive headers are present. Same-origin redirects return the
 * original Request unchanged.
 */
export function stripSensitiveHeadersOnRedirect(
  request: Request,
  redirectURL: string
): Request {
  const originalOrigin = getOrigin(request.url);
  const redirectOrigin = getOrigin(redirectURL);

  if (originalOrigin === redirectOrigin) {
    return request;
  }

  const headers = new Headers(request.headers);
  let stripped = false;

  for (const headerName of SENSITIVE_HEADERS) {
    if (headers.has(headerName)) {
      headers.delete(headerName);
      stripped = true;
    }
  }

  if (!stripped) {
    return request;
  }

  return new Request(redirectURL, {
    method: request.method,
    headers,
    body: request.body,
    credentials: request.credentials,
    cache: request.cache,
    redirect: request.redirect,
    referrer: request.referrer,
    integrity: request.integrity,
  });
}
