/**
 * pipeline.ts
 *
 * Wires the core utilities, middleware composition, retries, and
 * network layers into a single dispatch function.
 *
 * The middleware composition factory is pre-computed once at pipeline
 * creation per ADR-5. The factory is applied per-request because the
 * innermost fetch handler closes over per-request config (timeout,
 * retries) to prevent race conditions between concurrent requests.
 * This is an intentional trade-off: per-request config isolation
 * costs N closure allocations (where N is the middleware count),
 * which is negligible relative to network I/O overhead.
 *
 * The AbortSignal.any() runtime check (ADR-4) is performed inside
 * createPipeline() at client instantiation, not at module-load time,
 * to avoid crashing applications that only import types.
 *
 * Dependencies: configResolver, requestBuilder, responseParser,
 *               compose, withRetries, ssrf guard, error classes.
 */
import { resolveConfig } from './configResolver';
import { buildRequest } from './requestBuilder';
import { parseResponse } from './responseParser';
import { compose } from '../middleware/compose';
import { withRetries } from '../retry/retryHandler';
import { assertNotSSRF } from '../security';
import { NetworkError, TimeoutError, HttpError } from '../errors';
import type { GodspeedConfig, MiddlewareFn, NextFn, GodspeedResponse } from '../types';

/**
 * Determines whether a caught error originated from an AbortSignal
 * (timeout or manual cancellation).
 *
 * Uses instanceof narrowing instead of property-access casts to
 * satisfy the no-assertion rule. DOMException is available in
 * Node.js 17+ (our minimum is 20+), Bun, and Deno.
 */
function isAbortRelatedError(err: unknown): boolean {
  if (err instanceof DOMException) {
    return err.name === 'TimeoutError' || err.name === 'AbortError';
  }
  return false;
}

/**
 * Creates a pre-composed request pipeline bound to a base config
 * and middleware stack.
 *
 * Performs the one-time ADR-4 runtime check for AbortSignal.any()
 * support. Throws immediately if the runtime is incompatible.
 *
 * Returns an async execute function that resolves per-request config,
 * builds the Request, composes middleware around the fetch handler,
 * and returns a GodspeedResponse.
 */
export function createPipeline(
  baseConfig: GodspeedConfig,
  middlewares: readonly MiddlewareFn[]
) {
  if (typeof AbortSignal === 'undefined' || typeof AbortSignal.any !== 'function') {
    throw new Error(
      'Godspeed requires a runtime supporting AbortSignal.any(). ' +
      'Minimum: Node.js 20+, Bun 1.0+, Deno 1.38+.'
    );
  }

  const composed = compose(middlewares);

  return async function execute(
    method: string,
    path: string,
    options: GodspeedConfig = {},
    body?: unknown
  ): Promise<GodspeedResponse<unknown>> {
    const config = resolveConfig(baseConfig, options);
    const req = buildRequest(method, path, config, body);

    assertNotSSRF(req.url, config.allowPrivateNetworks === true);

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
        }, finalSignal);
      } catch (err: unknown) {
        if (isAbortRelatedError(err)) {
          throw new TimeoutError(
            'Request explicitly timed out',
            config.timeout ?? 0,
            { cause: err }
          );
        }
        throw new NetworkError('Network request failed', { cause: err });
      }

      const godspeedRes = await parseResponse(rawResponse, config.maxResponseSize);

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
