/**
 * auth.ts
 *
 * Opt-in middleware for attaching Bearer authorization tokens.
 *
 * This module allows tokens to be injected either statically or via a
 * dynamic provider function, ensuring tokens remain fresh over time.
 *
 * Performance note: Avoids allocating new headers maps; mutates the 
 * cloned Request headers natively.
 *
 * Dependencies: imports `MiddlewareFn` from `../types`.
 */
import type { MiddlewareFn } from '../types';

export function bearerAuth(tokenProvider: string | (() => string | Promise<string>)): MiddlewareFn {
  return async (req, next) => {
    const activeToken = typeof tokenProvider === 'function' ? await tokenProvider() : tokenProvider;
    req.headers.set('Authorization', `Bearer ${activeToken}`);
    return next(req);
  };
}
