/**
 * sse.test.ts
 *
 * Unit tests validating the Server-Sent Events middleware.
 *
 * Tests content-type detection, SSE protocol parsing, multi-line data
 * handling, and pass-through behavior for non-SSE responses.
 *
 * Dependencies: imports sse from src/index.
 */
import { describe, test, expect } from 'bun:test';
import { sse } from '../src/index';
import type { GodspeedResponse, NextFn } from '@thraggs/godspeed';

describe('SSE Plugin', () => {
  test('Passes through non-SSE responses with zero overhead', async () => {
    const dummyRequest = new Request('https://api.example.com/data');
    const jsonResponse: GodspeedResponse<unknown> = {
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'application/json' }),
      parsedBody: { data: 'ok' },
      data: { data: 'ok' },
    };

    const mockNext: NextFn = async (_req: Request) => jsonResponse;
    const mw = sse();
    const response = await mw(dummyRequest, mockNext);

    expect(response).toBe(jsonResponse);
  });

  test('Passes through responses without content-type header', async () => {
    const dummyRequest = new Request('https://api.example.com/data');
    const noHeaderResponse: GodspeedResponse<unknown> = {
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      parsedBody: { data: 'ok' },
      data: { data: 'ok' },
    };

    const mockNext: NextFn = async (_req: Request) => noHeaderResponse;
    const mw = sse();
    const response = await mw(dummyRequest, mockNext);

    expect(response).toBe(noHeaderResponse);
  });

  test('Intercepts text/event-stream responses', async () => {
    const dummyRequest = new Request('https://api.example.com/events');
    const sseData = 'data: hello\n\n';
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(sseData));
        controller.close();
      },
    });

    const sseResponse: GodspeedResponse<ReadableStream<Uint8Array>> = {
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'text/event-stream' }),
      parsedBody: stream,
      data: stream,
    };

    const mockNext: NextFn = async (_req: Request) => sseResponse;
    const mw = sse();
    const response = await mw(dummyRequest, mockNext);

    expect(response.headers.get('content-type')).toBe('text/event-stream');
    expect(response.parsedBody).toBeInstanceOf(ReadableStream);
  });

  test('Parses simple SSE event correctly', async () => {
    const dummyRequest = new Request('https://api.example.com/events');
    const sseData = 'data: hello world\n\n';
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(sseData));
        controller.close();
      },
    });

    const sseResponse: GodspeedResponse<ReadableStream<Uint8Array>> = {
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'text/event-stream' }),
      parsedBody: stream,
      data: stream,
    };

    const mockNext: NextFn = async (_req: Request) => sseResponse;
    const mw = sse();
    const response = await mw(dummyRequest, mockNext);

    const reader = response.parsedBody.getReader();
    const { value, done } = await reader.read();

    expect(done).toBe(false);
    expect(value).toEqual({ data: 'hello world' });
  });

  test('Parses SSE event with id and event type', async () => {
    const dummyRequest = new Request('https://api.example.com/events');
    const sseData = 'id: 123\nevent: update\ndata: test data\n\n';
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(sseData));
        controller.close();
      },
    });

    const sseResponse: GodspeedResponse<ReadableStream<Uint8Array>> = {
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'text/event-stream' }),
      parsedBody: stream,
      data: stream,
    };

    const mockNext: NextFn = async (_req: Request) => sseResponse;
    const mw = sse();
    const response = await mw(dummyRequest, mockNext);

    const reader = response.parsedBody.getReader();
    const { value, done } = await reader.read();

    expect(done).toBe(false);
    expect(value).toEqual({
      id: '123',
      event: 'update',
      data: 'test data',
    });
  });

  test('Parses multi-line data correctly', async () => {
    const dummyRequest = new Request('https://api.example.com/events');
    const sseData = 'data: line 1\ndata: line 2\ndata: line 3\n\n';
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(sseData));
        controller.close();
      },
    });

    const sseResponse: GodspeedResponse<ReadableStream<Uint8Array>> = {
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'text/event-stream' }),
      parsedBody: stream,
      data: stream,
    };

    const mockNext: NextFn = async (_req: Request) => sseResponse;
    const mw = sse();
    const response = await mw(dummyRequest, mockNext);

    const reader = response.parsedBody.getReader();
    const { value, done } = await reader.read();

    expect(done).toBe(false);
    expect(value).toEqual({ data: 'line 1\nline 2\nline 3' });
  });

  test('Parses retry field correctly', async () => {
    const dummyRequest = new Request('https://api.example.com/events');
    const sseData = 'retry: 5000\ndata: reconnect test\n\n';
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(sseData));
        controller.close();
      },
    });

    const sseResponse: GodspeedResponse<ReadableStream<Uint8Array>> = {
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'text/event-stream' }),
      parsedBody: stream,
      data: stream,
    };

    const mockNext: NextFn = async (_req: Request) => sseResponse;
    const mw = sse();
    const response = await mw(dummyRequest, mockNext);

    const reader = response.parsedBody.getReader();
    const { value, done } = await reader.read();

    expect(done).toBe(false);
    expect(value).toEqual({
      data: 'reconnect test',
      retry: 5000,
    });
  });

  test('Handles multiple events in single chunk', async () => {
    const dummyRequest = new Request('https://api.example.com/events');
    const sseData = 'data: event 1\n\ndata: event 2\n\ndata: event 3\n\n';
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(sseData));
        controller.close();
      },
    });

    const sseResponse: GodspeedResponse<ReadableStream<Uint8Array>> = {
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'text/event-stream' }),
      parsedBody: stream,
      data: stream,
    };

    const mockNext: NextFn = async (_req: Request) => sseResponse;
    const mw = sse();
    const response = await mw(dummyRequest, mockNext);

    const reader = response.parsedBody.getReader();
    
    const event1 = await reader.read();
    expect(event1.value).toEqual({ data: 'event 1' });

    const event2 = await reader.read();
    expect(event2.value).toEqual({ data: 'event 2' });

    const event3 = await reader.read();
    expect(event3.value).toEqual({ data: 'event 3' });
  });

  test('Ignores empty events', async () => {
    const dummyRequest = new Request('https://api.example.com/events');
    const sseData = '\n\ndata: real event\n\n\n\n';
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(sseData));
        controller.close();
      },
    });

    const sseResponse: GodspeedResponse<ReadableStream<Uint8Array>> = {
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'text/event-stream' }),
      parsedBody: stream,
      data: stream,
    };

    const mockNext: NextFn = async (_req: Request) => sseResponse;
    const mw = sse();
    const response = await mw(dummyRequest, mockNext);

    const reader = response.parsedBody.getReader();
    const { value, done } = await reader.read();

    expect(done).toBe(false);
    expect(value).toEqual({ data: 'real event' });
  });
});
