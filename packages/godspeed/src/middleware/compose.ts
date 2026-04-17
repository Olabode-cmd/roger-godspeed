/**
 * compose.ts
 *
 * Implements the middleware composition engine for Godspeed.
 *
 * We pre-compute the middleware chain structure when `compose()` is called
 * (during client setup), NOT during the hot path of handling a request.
 * We implement fast-paths for 0 and 1 middleware arrays to minimize
 * closure overhead.
 *
 * Each middleware layer includes a per-request guard that prevents
 * `next()` from being called more than once, avoiding duplicate
 * downstream execution and potential data corruption on mutation
 * endpoints. This guard allocates one boolean per middleware per
 * request — a deliberate trade-off favoring correctness over
 * zero-allocation purity. The cost is negligible relative to the
 * async/await and network I/O overhead of each request.
 *
 * Dependencies: imports interfaces from `../types`.
 */
import type { MiddlewareFn, NextFn } from '../types';

/**
 * Composes an array of middleware functions into a single pipeline factory.
 *
 * Returns a function that accepts a core fetch handler and produces a
 * final handler with all middleware applied in onion (LIFO) order.
 *
 * Fast-paths for 0 and 1 middleware avoid unnecessary closure wrapping.
 * The general N-middleware path reduces from right to left, producing
 * a chain of closures whose structure is fixed at initialization time.
 * Per-request, each layer allocates only a boolean guard flag to prevent
 * double `next()` invocations.
 */
export function compose(middlewares: readonly MiddlewareFn[]): (coreFetch: NextFn) => NextFn {
  if (middlewares.length === 0) {
    return (coreFetch: NextFn) => coreFetch;
  }

  if (middlewares.length === 1) {
    const fn = middlewares[0];
    if (fn === undefined) return (coreFetch: NextFn) => coreFetch;
    return (coreFetch: NextFn) => {
      return (req: Request) => {
        let called = false;
        return fn(req, (nextReq: Request) => {
          if (called) throw new Error('next() called multiple times by middleware');
          called = true;
          return coreFetch(nextReq);
        });
      };
    };
  }

  return (coreFetch: NextFn) => {
    let nextChain = coreFetch;

    for (let i = middlewares.length - 1; i >= 0; i--) {
      const currentNext = nextChain;
      const fn = middlewares[i];
      if (fn === undefined) continue;
      nextChain = (req: Request) => {
        let called = false;
        return fn(req, (nextReq: Request) => {
          if (called) throw new Error('next() called multiple times by middleware');
          called = true;
          return currentNext(nextReq);
        });
      };
    }

    return nextChain;
  };
}
