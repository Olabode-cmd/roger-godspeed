/**
 * compose.test.ts
 *
 * Unit tests verifying ADR-5 fast-paths, exact execution ordering
 * of the middleware onion architecture, double-next() guards,
 * error propagation, and request/response mutation visibility.
 */
import { describe, test, expect } from 'bun:test';
import { compose } from '../../src/middleware/compose';
import type { GodspeedResponse, MiddlewareFn, NextFn } from '../../src/types';

describe('Middleware Compose Engine', () => {
  const dummyResponse: GodspeedResponse = {
    status: 200,
    statusText: 'OK',
    headers: new Headers(),
    parsedBody: 'core-fetch'
  };

  const coreFetch: NextFn = async (_req: Request) => dummyResponse;
  const dummyRequest = new Request('https://api.com/test');

  test('Fast-path: Zero middlewares returns the core fetch directly', async () => {
    const pipeline = compose([])(coreFetch);
    const res = await pipeline(dummyRequest);
    expect(res.parsedBody).toBe('core-fetch');
  });

  test('Fast-path: Single middleware executes pre and post cleanly', async () => {
    let pre = false;
    let post = false;

    const mw: MiddlewareFn = async (req, next) => {
      pre = true;
      const res = await next(req);
      post = true;
      return res;
    };

    const pipeline = compose([mw])(coreFetch);
    await pipeline(dummyRequest);

    expect(pre).toBe(true);
    expect(post).toBe(true);
  });

  test('General-path: Exact Onion Execution Sequence', async () => {
    const trace: number[] = [];

    const mw1: MiddlewareFn = async (req, next) => {
      trace.push(1);
      const res = await next(req);
      trace.push(4);
      return res;
    };

    const mw2: MiddlewareFn = async (req, next) => {
      trace.push(2);
      const res = await next(req);
      trace.push(3);
      return res;
    };

    const pipeline = compose([mw1, mw2])(coreFetch);
    await pipeline(dummyRequest);

    expect(trace).toEqual([1, 2, 3, 4]);
  });

  test('Middleware allows early short-circuiting', async () => {
    const cacheHit: MiddlewareFn = async (_req, _next) => {
      return { ...dummyResponse, parsedBody: 'cache-intercept' };
    };

    let subsequentMwHit = false;
    const logger: MiddlewareFn = async (req, next) => {
      subsequentMwHit = true;
      return next(req);
    };

    const pipeline = compose([cacheHit, logger])(coreFetch);
    const res = await pipeline(dummyRequest);

    expect(res.parsedBody).toBe('cache-intercept');
    expect(subsequentMwHit).toBe(false);
  });

  test('calling next() twice throws an error', async () => {
    const doubleNext: MiddlewareFn = async (req, next) => {
      await next(req);
      return next(req);
    };

    const pipeline = compose([doubleNext])(coreFetch);
    expect(pipeline(dummyRequest)).rejects.toThrow('next() called multiple times by middleware');
  });

  test('double next() guard works in the N-middleware general path', async () => {
    const passthrough: MiddlewareFn = async (req, next) => next(req);

    const doubleNext: MiddlewareFn = async (req, next) => {
      await next(req);
      return next(req);
    };

    const pipeline = compose([passthrough, doubleNext])(coreFetch);
    expect(pipeline(dummyRequest)).rejects.toThrow('next() called multiple times by middleware');
  });

  test('errors propagate up through the middleware chain', async () => {
    const errorMiddleware: MiddlewareFn = async (_req, _next) => {
      throw new Error('middleware explosion');
    };

    const pipeline = compose([errorMiddleware])(coreFetch);
    expect(pipeline(dummyRequest)).rejects.toThrow('middleware explosion');
  });

  test('async rejection in downstream middleware propagates to upstream', async () => {
    let upstreamCaughtError = false;

    const upstream: MiddlewareFn = async (req, next) => {
      try {
        return await next(req);
      } catch {
        upstreamCaughtError = true;
        throw new Error('re-thrown from upstream');
      }
    };

    const downstream: MiddlewareFn = async (_req, _next) => {
      throw new Error('downstream failure');
    };

    const pipeline = compose([upstream, downstream])(coreFetch);
    expect(pipeline(dummyRequest)).rejects.toThrow('re-thrown from upstream');
    await pipeline(dummyRequest).catch(() => {});
    expect(upstreamCaughtError).toBe(true);
  });

  test('downstream middleware sees request modifications', async () => {
    let downstreamURL = '';

    const rewriter: MiddlewareFn = async (_req, next) => {
      const modified = new Request('https://api.com/rewritten');
      return next(modified);
    };

    const inspector: MiddlewareFn = async (req, next) => {
      downstreamURL = req.url;
      return next(req);
    };

    const pipeline = compose([rewriter, inspector])(coreFetch);
    await pipeline(dummyRequest);

    expect(downstreamURL).toBe('https://api.com/rewritten');
  });

  test('upstream middleware sees response modifications from downstream', async () => {
    let upstreamBody: unknown;

    const tagger: MiddlewareFn = async (req, next) => {
      const res = await next(req);
      return { ...res, parsedBody: 'modified-body' };
    };

    const observer: MiddlewareFn = async (req, next) => {
      const res = await next(req);
      upstreamBody = res.parsedBody;
      return res;
    };

    const pipeline = compose([observer, tagger])(coreFetch);
    await pipeline(dummyRequest);

    expect(upstreamBody).toBe('modified-body');
  });
});
