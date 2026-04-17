/**
 * GodspeedClient.ts
 *
 * Implements Phase 6 GodspeedClient interface.
 * The primary public API for end-users establishing config bounds,
 * orchestrating middleware, and dispatching typed HTTP queries.
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

  public use(middleware: MiddlewareFn): this {
    if (this.pipeline) {
      throw new Error('Godspeed: Cannot add middleware after requests have been initiated.');
    }
    this.middlewares.push(middleware);
    return this;
  }

  private dispatch() {
    if (!this.pipeline) {
      this.pipeline = createPipeline(this.config, this.middlewares);
    }
    return this.pipeline;
  }

  public async get<T = unknown>(path: string, options?: GodspeedConfig): Promise<GodspeedResponse<T>> {
    return this.dispatch()('GET', path, options) as Promise<GodspeedResponse<T>>;
  }

  public async post<T = unknown>(path: string, body?: unknown, options?: GodspeedConfig): Promise<GodspeedResponse<T>> {
    return this.dispatch()('POST', path, options, body) as Promise<GodspeedResponse<T>>;
  }

  public async put<T = unknown>(path: string, body?: unknown, options?: GodspeedConfig): Promise<GodspeedResponse<T>> {
    return this.dispatch()('PUT', path, options, body) as Promise<GodspeedResponse<T>>;
  }

  public async delete<T = unknown>(path: string, options?: GodspeedConfig): Promise<GodspeedResponse<T>> {
    return this.dispatch()('DELETE', path, options) as Promise<GodspeedResponse<T>>;
  }
}
