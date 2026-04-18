/**
 * pipeline.test.ts
 *
 * Integration tests for the core dispatch pipeline.
 * Validates the full request lifecycle: config resolution, request building,
 * middleware composition, fetch execution, response parsing, and error
 * classification (HttpError, NetworkError).
 *
 * Uses globalThis.fetch mocking to isolate from the network layer.
 *
 * Dependencies: createPipeline from core, error classes from errors.
 */
import { describe, test, expect, afterEach } from 'bun:test';
import { createPipeline } from '../../src/core/pipeline';
import { HttpError, NetworkError } from '../../src/errors';
import type { MiddlewareFn } from '../../src/types';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

/**
 * Assigns a mock fetch function to globalThis.fetch.
 * Uses Object.assign to satisfy Bun's extended fetch type
 * which includes the `preconnect` method.
 */
function mockFetch(handler: (input: Request) => Promise<Response>): void {
  globalThis.fetch = Object.assign(
    async (input: string | Request | URL, init?: RequestInit) => {
      const req = input instanceof Request
        ? input
        : new Request(typeof input === 'string' ? input : input.toString(), init);
      return handler(req);
    },
    { preconnect: originalFetch.preconnect }
  );
}

describe('Pipeline Integration', () => {
  test('successful JSON GET returns a well-formed GodspeedResponse', async () => {
    mockFetch(async () => new Response(
      JSON.stringify({ id: 1, name: 'test' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    ));

    const pipeline = createPipeline({}, []);
    const res = await pipeline('GET', 'https://api.com/users/1');

    expect(res.status).toBe(200);
    expect(res.parsedBody).toEqual({ id: 1, name: 'test' });
    expect(res.headers).toBeInstanceOf(Headers);
  });

  test('non-2xx response throws HttpError with status and body', async () => {
    mockFetch(async () => new Response(
      JSON.stringify({ error: 'not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    ));

    const pipeline = createPipeline({}, []);

    try {
      await pipeline('GET', 'https://api.com/missing');
      expect(true).toBe(false);
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(HttpError);
      if (err instanceof HttpError) {
        expect(err.status).toBe(404);
        expect(err.body).toEqual({ error: 'not found' });
        expect(err.type).toBe('http');
      }
    }
  });

  test('network failure throws NetworkError with cause chain', async () => {
    const networkErr = new TypeError('fetch failed');
    mockFetch(async () => { throw networkErr; });

    const pipeline = createPipeline({}, []);

    try {
      await pipeline('GET', 'https://api.com/down');
      expect(true).toBe(false);
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(NetworkError);
      if (err instanceof NetworkError) {
        expect(err.type).toBe('network');
        expect(err.cause).toBe(networkErr);
      }
    }
  });

  test('middleware executes in the correct onion order through pipeline', async () => {
    mockFetch(async () => new Response(
      JSON.stringify({ data: 'ok' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    ));

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

    const pipeline = createPipeline({}, [mw1, mw2]);
    await pipeline('GET', 'https://api.com/test');

    expect(trace).toEqual([1, 2, 3, 4]);
  });

  test('baseURL config is applied to the request', async () => {
    let capturedURL = '';
    mockFetch(async (req) => {
      capturedURL = req.url;
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    });

    const pipeline = createPipeline({ baseURL: 'https://api.com/v2' }, []);
    await pipeline('GET', '/users');

    expect(capturedURL).toBe('https://api.com/v2/users');
  });

  test('per-request options override base config', async () => {
    let capturedURL = '';
    mockFetch(async (req) => {
      capturedURL = req.url;
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    });

    const pipeline = createPipeline(
      { baseURL: 'https://api.com/v1' },
      []
    );
    await pipeline('GET', '/users', { baseURL: 'https://api.com/v2' });

    expect(capturedURL).toBe('https://api.com/v2/users');
  });

  test('500 response with text body throws HttpError', async () => {
    mockFetch(async () => new Response(
      'Internal Server Error',
      { status: 500, headers: { 'Content-Type': 'text/plain' } }
    ));

    const pipeline = createPipeline({}, []);

    try {
      await pipeline('GET', 'https://api.com/error');
      expect(true).toBe(false);
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(HttpError);
      if (err instanceof HttpError) {
        expect(err.status).toBe(500);
        expect(err.body).toBe('Internal Server Error');
      }
    }
  });
});
