/**
 * types.ts
 *
 * Local type definitions mirroring @thraggs/godspeed types.
 *
 * These types are duplicated here to avoid circular dependencies during
 * development. At runtime, consumers will use the actual types from the
 * core package via peer dependency.
 */

export interface GodspeedResponse<TData = unknown> {
  status: number;
  statusText: string;
  headers: Headers;
  parsedBody: TData;
  data: TData;
}

export type NextFn = (req: Request) => Promise<GodspeedResponse<unknown>>;

export type MiddlewareFn = (req: Request, next: NextFn) => Promise<GodspeedResponse<unknown>>;
