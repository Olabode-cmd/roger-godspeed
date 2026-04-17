/**
 * logger.ts
 *
 * Opt-in middleware for request and response observability.
 *
 * This module securely delegates logging responsibilities to custom
 * observer functions, ensuring downstream layers are isolated.
 * It strictly adheres to ADR-2 by inspecting `GodspeedResponse.parsedBody`
 * and never interacting with the raw fetch Body stream.
 *
 * Dependencies: imports `MiddlewareFn` and `GodspeedResponse` from `../types`.
 */
import type { MiddlewareFn, GodspeedResponse } from '../types';

export interface LoggerOptions {
  onReq?: (req: Request) => void | Promise<void>;
  onRes?: (res: GodspeedResponse<unknown>, req: Request) => void | Promise<void>;
  onError?: (err: unknown, req: Request) => void | Promise<void>;
}

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
