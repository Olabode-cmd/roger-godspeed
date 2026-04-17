/**
 * pipeline.ts
 *
 * Implements Phase 6 core dispatch pipeline.
 * Wires the utilities, middleware composition, retries, and network layers together.
 */
import { resolveConfig } from './configResolver';
import { buildRequest } from './requestBuilder';
import { parseResponse } from './responseParser';
import { compose } from '../middleware/compose';
import { withRetries } from '../retry/retryHandler';
import { NetworkError, TimeoutError, HttpError } from '../errors';
import type { GodspeedConfig, MiddlewareFn, NextFn, GodspeedResponse } from '../types';

// Runtime Feature Check: ADR-4
// Fail fast if the environment lacks AbortSignal.any
if (typeof AbortSignal !== 'function' || typeof AbortSignal.any !== 'function') {
  throw new Error('Godspeed requires a runtime supporting AbortSignal.any(). Minimum: Node.js 20+, Bun 1.0+, Deno 1.38+.');
}

export function createPipeline(
  baseConfig: GodspeedConfig,
  middlewares: readonly MiddlewareFn[]
) {
  const composed = compose(middlewares);

  return async function execute(
    method: string,
    path: string,
    options: GodspeedConfig = {},
    body?: unknown
  ): Promise<GodspeedResponse<unknown>> {
    const config = resolveConfig(baseConfig, options);
    const req = buildRequest(method, path, config, body);

    const baseFetch: NextFn = async (finalReq: Request) => {
      let finalSignal = finalReq.signal;

      if (config.timeout) {
        const timeoutSignal = AbortSignal.timeout(config.timeout);
        finalSignal = AbortSignal.any([finalReq.signal, timeoutSignal]);
      }

      let rawResponse: Response;
      try {
        rawResponse = await withRetries(finalReq, config, async (attemptReq) => {
           return await fetch(attemptReq, { signal: finalSignal });
        });
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'name' in err) {
          if (err.name === 'TimeoutError' || err.name === 'AbortError') {
             throw new TimeoutError('Request explicitly timed out', config.timeout ?? 0, { cause: err });
          }
        }
        throw new NetworkError('Network request failed', { cause: err });
      }

      const godspeedRes = await parseResponse(rawResponse);
      
      if (godspeedRes.status < 200 || godspeedRes.status >= 300) {
        throw new HttpError(
          `Request failed with status ${godspeedRes.status}`,
          godspeedRes.status,
          godspeedRes.parsedBody
        );
      }

      return godspeedRes;
    };

    const run = composed(baseFetch);
    return run(req);
  };
}
