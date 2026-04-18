/**
 * logger.ts
 *
 * Opt-in middleware for request and response observability.
 *
 * This module delegates logging to user-provided observer functions,
 * ensuring the core pipeline remains unaware of logging concerns.
 * It strictly adheres to ADR-2 by inspecting `GodspeedResponse.parsedBody`
 * and never interacting with the raw fetch Body stream.
 *
 * Design note: Logger callbacks are awaited and can affect the pipeline.
 * A throwing onReq or onRes callback will propagate as a pipeline error.
 * This is intentional: broken observability should be loud, not silent.
 * If silent logging is preferred, wrap callbacks in try/catch before
 * passing them to this middleware.
 *
 * Dependencies: imports `MiddlewareFn` and `GodspeedResponse` from `../types`.
 */
import type { MiddlewareFn, GodspeedResponse } from '../types';

export interface LoggerOptions {
  onReq?: (req: Request) => void | Promise<void>;
  onRes?: (res: GodspeedResponse<unknown>, req: Request) => void | Promise<void>;
  onError?: (err: unknown, req: Request) => void | Promise<void>;
}

/**
 * Creates a middleware that delegates request, response, and error
 * observability to user-provided callback functions.
 *
 * Callbacks are awaited before proceeding. If a callback throws, the
 * error propagates as a pipeline error. This ensures broken logging
 * is surfaced immediately rather than silently swallowed.
 */
export function logger({ onReq, onRes, onError }: LoggerOptions = {}): MiddlewareFn {
  return async (req, next) => {
    if (onReq) {
      await onReq(req);
    }
    try {
      const res = await next(req);
      if (onRes) {
        await onRes(res, req);
      }
      return res;
    } catch (err: unknown) {
      if (onError) {
        await onError(err, req);
      }
      throw err;
    }
  };
}
