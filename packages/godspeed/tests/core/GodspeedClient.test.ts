/**
 * GodspeedClient.test.ts
 *
 * Integration tests for the primary GodspeedClient public API.
 * Validates HTTP method dispatch, middleware freezing, config
 * propagation, fluent chaining, error classification, and the
 * full public API surface including PATCH, HEAD, and OPTIONS.
 *
 * Uses globalThis.fetch mocking to isolate from the network layer.
 */
import { describe, test, expect, afterEach } from 'bun:test';
import { GodspeedClient } from '../../src/core/GodspeedClient';
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
function mockFetch(handler: (req: Request) => Promise<Response>): void {
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

/**
 * Creates a mock fetch that returns a JSON response with the given
 * body and status code. Captures the incoming Request for assertions.
 */
function jsonMock(
  body: unknown,
  status = 200,
  captured?: { req?: Request }
): void {
  mockFetch(async (req) => {
    if (captured) {
      captured.req = req;
    }
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  });
}

describe('GodspeedClient API Surface', () => {
  test('GET returns a successful GodspeedResponse', async () => {
    jsonMock({ id: 1 });

    const client = new GodspeedClient();
    const res = await client.get('https://api.com/users/1');

    expect(res.status).toBe(200);
    expect(res.parsedBody).toEqual({ id: 1 });
  });

  test('POST sends body and returns response', async () => {
    const captured: { req?: Request } = {};
    jsonMock({ created: true }, 200, captured);

    const client = new GodspeedClient();
    const res = await client.post('https://api.com/users', { name: 'Ada' });

    expect(res.status).toBe(200);
    expect(res.parsedBody).toEqual({ created: true });
    expect(captured.req?.method).toBe('POST');
  });

  test('PUT sends body and returns response', async () => {
    const captured: { req?: Request } = {};
    jsonMock({ updated: true }, 200, captured);

    const client = new GodspeedClient();
    const res = await client.put('https://api.com/users/1', { name: 'Updated' });

    expect(res.status).toBe(200);
    expect(captured.req?.method).toBe('PUT');
  });

  test('PATCH sends body and returns response', async () => {
    const captured: { req?: Request } = {};
    jsonMock({ patched: true }, 200, captured);

    const client = new GodspeedClient();
    const res = await client.patch('https://api.com/users/1', { name: 'Patched' });

    expect(res.status).toBe(200);
    expect(captured.req?.method).toBe('PATCH');
  });

  test('DELETE dispatches correctly', async () => {
    const captured: { req?: Request } = {};
    jsonMock({ deleted: true }, 200, captured);

    const client = new GodspeedClient();
    const res = await client.delete('https://api.com/users/1');

    expect(res.status).toBe(200);
    expect(captured.req?.method).toBe('DELETE');
  });

  test('HEAD dispatches correctly', async () => {
    const captured: { req?: Request } = {};
    jsonMock({}, 200, captured);

    const client = new GodspeedClient();
    await client.head('https://api.com/health');

    expect(captured.req?.method).toBe('HEAD');
  });

  test('OPTIONS dispatches correctly', async () => {
    const captured: { req?: Request } = {};
    jsonMock({}, 200, captured);

    const client = new GodspeedClient();
    await client.options('https://api.com/cors');

    expect(captured.req?.method).toBe('OPTIONS');
  });
});

describe('GodspeedClient Config', () => {
  test('baseURL is propagated to the request', async () => {
    const captured: { req?: Request } = {};
    jsonMock({ ok: true }, 200, captured);

    const client = new GodspeedClient({ baseURL: 'https://api.com/v2' });
    await client.get('/endpoint');

    expect(captured.req?.url).toBe('https://api.com/v2/endpoint');
  });

  test('headers from base config are applied to requests', async () => {
    const captured: { req?: Request } = {};
    jsonMock({}, 200, captured);

    const client = new GodspeedClient({
      headers: { 'X-Custom': 'baseline' }
    });
    await client.get('https://api.com/test');

    expect(captured.req?.headers.get('X-Custom')).toBe('baseline');
  });
});

describe('GodspeedClient Middleware', () => {
  test('use() returns this for fluent chaining', () => {
    const client = new GodspeedClient();
    const passthrough: MiddlewareFn = async (req, next) => next(req);

    const returned = client.use(passthrough);
    expect(returned).toBe(client);
  });

  test('prevents middleware registration after first request', async () => {
    jsonMock({ ok: true });

    const client = new GodspeedClient();
    const passthrough: MiddlewareFn = async (req, next) => next(req);
    client.use(passthrough);

    await client.get('https://api.com/test');

    expect(() => {
      client.use(passthrough);
    }).toThrow('Godspeed: Cannot add middleware after requests have been initiated.');
  });

  test('middleware can modify request headers', async () => {
    const captured: { req?: Request } = {};
    jsonMock({}, 200, captured);

    const addHeader: MiddlewareFn = async (req, next) => {
      const headers = new Headers(req.headers);
      headers.set('X-Middleware', 'injected');
      return next(new Request(req, { headers }));
    };

    const client = new GodspeedClient();
    client.use(addHeader);
    await client.get('https://api.com/test');

    expect(captured.req?.headers.get('X-Middleware')).toBe('injected');
  });
});

describe('GodspeedClient Error Handling', () => {
  test('404 response throws HttpError', async () => {
    jsonMock({ error: 'missing' }, 404);

    const client = new GodspeedClient();

    try {
      await client.get('https://api.com/missing');
      expect(true).toBe(false);
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(HttpError);
      if (err instanceof HttpError) {
        expect(err.status).toBe(404);
      }
    }
  });

  test('network failure throws NetworkError', async () => {
    mockFetch(async () => { throw new TypeError('fetch failed'); });

    const client = new GodspeedClient();

    try {
      await client.get('https://api.com/down');
      expect(true).toBe(false);
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(NetworkError);
    }
  });
});
