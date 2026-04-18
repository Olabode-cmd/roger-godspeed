/**
 * GodspeedClient.ts
 *
 * The primary public API for end-users. Manages client-level
 * configuration, middleware registration, and HTTP method dispatching.
 *
 * The pipeline is lazily initialized on the first request and
 * memoized to enforce middleware immutability post-dispatch.
 * Middleware must be registered before the first request is made.
 *
 * All HTTP methods return GodspeedResponse<unknown> because the
 * parser has no runtime knowledge of the response type. Type
 * narrowing to a concrete type is the responsibility of validation
 * middleware (validateResponse) or the consumer's own narrowing.
 *
 * Dependencies: createPipeline, types.
 */
import { createPipeline } from './pipeline';
import type { GodspeedConfig, MiddlewareFn, GodspeedResponse } from '../types';

export class GodspeedClient {
  private config: GodspeedConfig;
  private middlewares: MiddlewareFn[] = [];
  private pipeline: ReturnType<typeof createPipeline> | null = null;

  constructor(config: GodspeedConfig = {}) {
    this.config = config;
  }

  /**
   * Registers a middleware function to the pipeline.
   *
   * Middleware must be registered before the first request. Calling
   * this method after a request has been dispatched throws to prevent
   * inconsistent pipeline behavior.
   *
   * Returns `this` for fluent chaining: `client.use(a).use(b)`.
   */
  public use(middleware: MiddlewareFn): this {
    if (this.pipeline) {
      throw new Error('Godspeed: Cannot add middleware after requests have been initiated.');
    }
    this.middlewares.push(middleware);
    return this;
  }

  /**
   * Lazily creates and memoizes the execution pipeline.
   * Ensures the middleware chain is frozen after the first dispatch.
   */
  private dispatch() {
    if (!this.pipeline) {
      this.pipeline = createPipeline(this.config, this.middlewares);
    }
    return this.pipeline;
  }

  public async get<T = any>(path: string, options?: GodspeedConfig): Promise<GodspeedResponse<T>> {
    return this.dispatch()('GET', path, options) as Promise<GodspeedResponse<T>>;
  }

  public async post<T = any>(path: string, body?: unknown, options?: GodspeedConfig): Promise<GodspeedResponse<T>> {
    return this.dispatch()('POST', path, options, body) as Promise<GodspeedResponse<T>>;
  }

  public async put<T = any>(path: string, body?: unknown, options?: GodspeedConfig): Promise<GodspeedResponse<T>> {
    return this.dispatch()('PUT', path, options, body) as Promise<GodspeedResponse<T>>;
  }

  public async patch<T = any>(path: string, body?: unknown, options?: GodspeedConfig): Promise<GodspeedResponse<T>> {
    return this.dispatch()('PATCH', path, options, body) as Promise<GodspeedResponse<T>>;
  }

  public async delete<T = any>(path: string, options?: GodspeedConfig): Promise<GodspeedResponse<T>> {
    return this.dispatch()('DELETE', path, options) as Promise<GodspeedResponse<T>>;
  }

  public async head<T = any>(path: string, options?: GodspeedConfig): Promise<GodspeedResponse<T>> {
    return this.dispatch()('HEAD', path, options) as Promise<GodspeedResponse<T>>;
  }

  public async options<T = any>(path: string, options?: GodspeedConfig): Promise<GodspeedResponse<T>> {
    return this.dispatch()('OPTIONS', path, options) as Promise<GodspeedResponse<T>>;
  }
}
