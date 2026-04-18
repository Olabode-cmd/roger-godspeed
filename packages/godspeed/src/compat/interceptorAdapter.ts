/**
 * interceptorAdapter.ts
 *
 * Implements the Axios compatibility bridge dictated by ADR-1.
 *
 * Provides a migration path for Axios interceptors.request and
 * interceptors.response flat-array APIs by translating them into
 * Godspeed's Koa-style middleware pipeline.
 *
 * Request interceptors are applied in LIFO order (last added runs first).
 * Response interceptors are applied in FIFO order (first added runs first).
 * This matches native Axios execution order.
 *
 * The adapter uses a two-phase approach (request phase, dispatch,
 * response phase) instead of Axios's single flat promise chain. This
 * enables proper type safety at the dispatch boundary where the payload
 * transitions from Request to GodspeedResponse.
 *
 * Known Differences from Native Axios:
 *   1. Request interceptor rejections do NOT flow into response
 *      interceptor reject handlers. In Axios, the entire chain is one
 *      promise sequence and a rejected request interceptor eventually
 *      reaches response reject handlers. In Godspeed, request-phase
 *      errors throw before dispatch.
 *   2. Rejected handler recovery must return the correct type (Request
 *      for request interceptors, GodspeedResponse for response
 *      interceptors). In Axios, recovery can return any value due to
 *      untyped promise chains, which silently corrupts the pipeline.
 *   3. transformRequest and transformResponse are not supported. Use
 *      Godspeed middleware for equivalent functionality.
 *   4. cancelToken is not supported. Use AbortController.
 *   5. onUploadProgress and onDownloadProgress are not supported.
 *
 * Dependencies: imports MiddlewareFn, NextFn, GodspeedResponse from ../types.
 */
import type { MiddlewareFn, NextFn, GodspeedResponse } from '../types';

/**
 * Handler shape for an interceptor. Both callbacks are optional.
 * The fulfilled callback transforms the value, and the rejected
 * callback can recover from or re-throw errors.
 */
interface InterceptorHandler<V> {
  fulfilled?: ((value: V) => V | Promise<V>) | undefined;
  rejected?: ((error: unknown) => V | Promise<V>) | undefined;
}

/**
 * Manages an ordered list of interceptor handlers with support for
 * registration and ejection by numeric ID.
 *
 * Ejected slots are set to null to preserve the index mapping of
 * subsequent handlers (matching Axios behavior).
 */
export class InterceptorManager<V> {
  private handlers: Array<InterceptorHandler<V> | null> = [];

  /**
   * Registers a new interceptor handler pair. Returns the numeric
   * ID that can be used to eject this handler later.
   */
  public use(
    fulfilled?: (value: V) => V | Promise<V>,
    rejected?: (error: unknown) => V | Promise<V>
  ): number {
    this.handlers.push({ fulfilled, rejected });
    return this.handlers.length - 1;
  }

  /**
   * Removes an interceptor by its registration ID.
   * The slot is set to null rather than spliced to preserve IDs.
   */
  public eject(id: number): void {
    if (this.handlers[id]) {
      this.handlers[id] = null;
    }
  }

  /**
   * Iterates over all non-ejected handlers in registration order.
   */
  public forEach(
    fn: (h: InterceptorHandler<V>) => void
  ): void {
    for (const h of this.handlers) {
      if (h !== null) {
        fn(h);
      }
    }
  }
}

/**
 * Creates an Axios-compatible interceptor adapter that translates
 * flat interceptor arrays into a single Godspeed middleware function.
 *
 * Returns interceptor managers for request and response phases,
 * plus the composed middleware that should be passed to client.use().
 *
 * The middleware executes in three typed phases:
 *   1. Request interceptors (LIFO) as a Promise<Request> chain
 *   2. Dispatch via next() producing Promise<GodspeedResponse>
 *   3. Response interceptors (FIFO) as a Promise<GodspeedResponse> chain
 */
export function axiosAdapter(): {
  request: InterceptorManager<Request>;
  response: InterceptorManager<GodspeedResponse<unknown>>;
  middleware: MiddlewareFn;
} {
  const request = new InterceptorManager<Request>();
  const response = new InterceptorManager<GodspeedResponse<unknown>>();

  const middleware: MiddlewareFn = async (req: Request, next: NextFn) => {
    const requestHandlers: Array<InterceptorHandler<Request>> = [];
    request.forEach(h => requestHandlers.unshift(h));

    const responseHandlers: Array<InterceptorHandler<GodspeedResponse<unknown>>> = [];
    response.forEach(h => responseHandlers.push(h));

    let requestChain: Promise<Request> = Promise.resolve(req);
    for (const handler of requestHandlers) {
      requestChain = requestChain.then(handler.fulfilled, handler.rejected);
    }

    const processedReq = await requestChain;

    let responseChain: Promise<GodspeedResponse<unknown>> = next(processedReq);
    for (const handler of responseHandlers) {
      responseChain = responseChain.then(handler.fulfilled, handler.rejected);
    }

    return responseChain;
  };

  return { request, response, middleware };
}
