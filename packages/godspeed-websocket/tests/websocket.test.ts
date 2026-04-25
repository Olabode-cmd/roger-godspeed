/**
 * websocket.test.ts
 *
 * Unit tests validating the WebSocket protocol middleware.
 *
 * Tests protocol detection, connection establishment, error handling,
 * and pass-through behavior for non-WebSocket requests.
 *
 * Dependencies: imports websocket from src/index.
 */
import { describe, test, expect, mock } from 'bun:test';
import { websocket } from '../src/index';
import type { GodspeedResponse, NextFn } from '@thraggs/godspeed';

describe('WebSocket Plugin', () => {
  const dummyResponse: GodspeedResponse<unknown> = {
    status: 200,
    statusText: 'OK',
    headers: new Headers(),
    parsedBody: { data: 'ok' },
    data: { data: 'ok' },
  };

  const mockNext: NextFn = async (_req: Request) => dummyResponse;

  test('Passes through HTTP requests with zero overhead', async () => {
    const httpRequest = new Request('https://api.example.com/data');
    const mw = websocket();
    const response = await mw(httpRequest, mockNext);

    expect(response).toBe(dummyResponse);
  });

  test('Passes through HTTPS requests with zero overhead', async () => {
    const httpsRequest = new Request('https://secure.example.com/api');
    const mw = websocket();
    const response = await mw(httpsRequest, mockNext);

    expect(response).toBe(dummyResponse);
  });

  test('Intercepts ws:// protocol requests', async () => {
    const wsRequest = new Request('ws://localhost:8080/stream');
    const mw = websocket();

    const originalWebSocket = globalThis.WebSocket;
    const mockSocket = {
      protocol: '',
      addEventListener: mock((event: string, handler: Function) => {
        if (event === 'open') {
          setTimeout(() => handler({}), 0);
        }
      }),
    };

    globalThis.WebSocket = mock(() => mockSocket) as unknown as typeof WebSocket;

    const response = await mw(wsRequest, mockNext);

    expect(response.status).toBe(101);
    expect(response.statusText).toBe('Switching Protocols');
    expect(response.parsedBody).toHaveProperty('socket');

    globalThis.WebSocket = originalWebSocket;
  });

  test('Intercepts wss:// protocol requests', async () => {
    const wssRequest = new Request('wss://secure.example.com/stream');
    const mw = websocket();

    const originalWebSocket = globalThis.WebSocket;
    const mockSocket = {
      protocol: 'chat',
      addEventListener: mock((event: string, handler: Function) => {
        if (event === 'open') {
          setTimeout(() => handler({}), 0);
        }
      }),
    };

    globalThis.WebSocket = mock(() => mockSocket) as unknown as typeof WebSocket;

    const response = await mw(wssRequest, mockNext);

    expect(response.status).toBe(101);
    expect(response.parsedBody).toHaveProperty('socket');
    expect(response.parsedBody).toHaveProperty('protocol', 'chat');

    globalThis.WebSocket = originalWebSocket;
  });

  test('Rejects on WebSocket connection error', async () => {
    const wsRequest = new Request('ws://invalid.example.com/stream');
    const mw = websocket();

    const originalWebSocket = globalThis.WebSocket;
    const mockSocket = {
      protocol: '',
      addEventListener: mock((event: string, handler: Function) => {
        if (event === 'error') {
          setTimeout(() => handler(new Event('error')), 0);
        }
      }),
    };

    globalThis.WebSocket = mock(() => mockSocket) as unknown as typeof WebSocket;

    try {
      await mw(wsRequest, mockNext);
      expect(true).toBe(false);
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(Error);
      if (err instanceof Error) {
        expect(err.message).toContain('WebSocket connection failed');
      }
    }

    globalThis.WebSocket = originalWebSocket;
  });

  test('Does not call next() for WebSocket requests', async () => {
    const wsRequest = new Request('ws://localhost:8080/stream');
    const mw = websocket();

    let nextCalled = false;
    const trackingNext: NextFn = async (_req: Request) => {
      nextCalled = true;
      return dummyResponse;
    };

    const originalWebSocket = globalThis.WebSocket;
    const mockSocket = {
      protocol: '',
      addEventListener: mock((event: string, handler: Function) => {
        if (event === 'open') {
          setTimeout(() => handler({}), 0);
        }
      }),
    };

    globalThis.WebSocket = mock(() => mockSocket) as unknown as typeof WebSocket;

    await mw(wsRequest, trackingNext);

    expect(nextCalled).toBe(false);

    globalThis.WebSocket = originalWebSocket;
  });
});
