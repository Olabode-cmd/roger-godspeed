/**
 * auth.ts
 *
 * Opt-in middleware for attaching Bearer authorization tokens.
 *
 * This module allows tokens to be injected either statically or via a
 * dynamic provider function, ensuring tokens remain fresh over time.
 *
 * Creates a new Request with the Authorization header to avoid
 * mutating the incoming Request, which may be immutable in strict
 * runtimes like Cloudflare Workers.
 *
 * Dependencies: imports `MiddlewareFn` from `../types`.
 */
import type { MiddlewareFn } from '../types';

/**
 * Creates a middleware that attaches a Bearer token to every request.
 *
 * Accepts either a static token string or an async provider function
 * that is called on each request to obtain a fresh token.
 *
 * A new Request is constructed with the Authorization header to
 * preserve Request immutability and middleware purity.
 */
export function bearerAuth(tokenProvider: string | (() => string | Promise<string>)): MiddlewareFn {
  return async (req, next) => {
    const activeToken = typeof tokenProvider === 'function' ? await tokenProvider() : tokenProvider;
    const headers = new Headers(req.headers);
    headers.set('Authorization', `Bearer ${activeToken}`);
    return next(new Request(req, { headers }));
  };
}
