import type { GodspeedResponse } from './response';

/**
 * middleware.ts
 *
 * Defines the Koa-style middleware function signature.
 *
 * This signature enforces the Onion architecture, allowing middleware to intercept
 * requests moving down the pipeline, and responses bubbling back up.
 */

export type NextFn = (req: Request) => Promise<GodspeedResponse<unknown>>;

export type MiddlewareFn = (req: Request, next: NextFn) => Promise<GodspeedResponse<unknown>>;
