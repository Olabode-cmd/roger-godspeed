/**
 * interceptorAdapter.test.ts
 *
 * Unit tests validating the Axios Promise-chain replication engine.
 * Ensures LIFO execution for Request interceptors and FIFO execution
 * for Response interceptors, matching native Axios behavior.
 * Also validates ejection, rejection recovery, and the two-phase
 * architecture separating request and response interceptor scopes.
 */
import { describe, test, expect } from 'bun:test';
import { axiosAdapter } from '../../src/compat/interceptorAdapter';
import type { GodspeedResponse } from '../../src/types';

describe('Axios Interceptor Adapter', () => {
  const dummyRequest = new Request('https://test.com');
  const dummyResponse: GodspeedResponse<unknown> = {
    status: 200, statusText: 'OK', headers: new Headers(), parsedBody: 'core'
  };

  const mockNext = async (_req: Request) => dummyResponse;

  test('Request Interceptors execute LIFO before dispatch', async () => {
    const { request, middleware } = axiosAdapter();
    const sequence: number[] = [];

    request.use(req => { sequence.push(1); return req; });
    request.use(req => { sequence.push(2); return req; });

    await middleware(dummyRequest, mockNext);

    expect(sequence).toEqual([2, 1]);
  });

  test('Response Interceptors execute FIFO after dispatch', async () => {
    const { response, middleware } = axiosAdapter();
    let bodyTrace = '';

    response.use(res => { bodyTrace += 'A'; return res; });
    response.use(res => { bodyTrace += 'B'; return res; });

    await middleware(dummyRequest, mockNext);

    expect(bodyTrace).toBe('AB');
  });

  test('Interceptors can be successfully ejected', async () => {
    const { request, response, middleware } = axiosAdapter();
    let touches = 0;

    const reqId = request.use(req => { touches++; return req; });
    const resId = response.use(res => { touches++; return res; });

    request.eject(reqId);
    response.eject(resId);

    await middleware(dummyRequest, mockNext);
    expect(touches).toBe(0);
  });

  test('Request rejection recovered by an earlier interceptor flows to dispatch', async () => {
    const adapter = axiosAdapter();
    let caughtError: unknown;

    adapter.request.use(
      req => req,
      err => { caughtError = err; return dummyRequest; }
    );

    adapter.request.use(
      _req => { throw new Error('Boom'); }
    );

    const res = await adapter.middleware(dummyRequest, mockNext);

    expect(caughtError).toBeInstanceOf(Error);
    expect((caughtError as Error).message).toBe('Boom');
    expect(res.parsedBody).toBe('core');
  });

  test('Unrecovered request rejection propagates as error', async () => {
    const adapter = axiosAdapter();

    adapter.request.use(
      _req => { throw new Error('Fatal'); }
    );

    try {
      await adapter.middleware(dummyRequest, mockNext);
      expect(true).toBe(false);
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toBe('Fatal');
    }
  });

  test('Response rejection recovered by a later interceptor returns response', async () => {
    const adapter = axiosAdapter();

    adapter.response.use(
      _res => { throw new Error('Response error'); }
    );

    adapter.response.use(
      res => res,
      _err => dummyResponse
    );

    const res = await adapter.middleware(dummyRequest, mockNext);
    expect(res.parsedBody).toBe('core');
  });

  test('Response interceptors can modify parsedBody', async () => {
    const adapter = axiosAdapter();

    adapter.response.use(res => ({
      ...res,
      parsedBody: 'modified'
    }));

    const res = await adapter.middleware(dummyRequest, mockNext);
    expect(res.parsedBody).toBe('modified');
  });

  test('Ejecting an already-ejected or invalid ID is a no-op', async () => {
    const adapter = axiosAdapter();
    let runs = 0;

    const id = adapter.request.use(req => { runs++; return req; });

    adapter.request.eject(id);
    adapter.request.eject(id);
    adapter.request.eject(999);

    await adapter.middleware(dummyRequest, mockNext);
    expect(runs).toBe(0);
  });
});
