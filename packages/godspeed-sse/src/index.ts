/**
 * index.ts
 *
 * Server-Sent Events (SSE) middleware for Godspeed.
 *
 * This plugin intercepts responses with Content-Type: text/event-stream
 * and transforms the raw byte stream into parsed SSE events. It wraps
 * the response body with a TransformStream that performs single-pass
 * parsing of the SSE protocol format.
 *
 * The plugin only activates when the response Content-Type matches
 * text/event-stream. All other responses pass through untouched with
 * zero overhead (single header lookup).
 *
 * Performance: Uses a minimal buffer to accumulate incomplete events.
 * Events are emitted as soon as a complete message is detected (double
 * newline delimiter). No intermediate arrays or objects are allocated
 * during parsing. The transform stream processes chunks incrementally
 * without buffering the entire response.
 *
 * Dependencies: imports MiddlewareFn from @thraggs/godspeed.
 */
import type { MiddlewareFn } from './types';

export type { MiddlewareFn, NextFn, GodspeedResponse } from './types';

export interface SSEEvent {
  id?: string;
  event?: string;
  data: string;
  retry?: number;
}

/**
 * Creates a TransformStream that parses SSE protocol format.
 *
 * Accumulates text chunks in a buffer and splits on double newlines
 * to detect complete events. Each event is parsed into an SSEEvent
 * object with id, event, data, and retry fields.
 *
 * The buffer is kept minimal by immediately flushing complete events.
 * Incomplete events remain in the buffer until the next chunk arrives.
 */
function createSSETransform(): TransformStream<string, SSEEvent> {
  let buffer = '';

  return new TransformStream<string, SSEEvent>({
    transform(chunk, controller) {
      buffer += chunk;
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';

      for (const rawEvent of events) {
        if (!rawEvent.trim()) continue;

        const event: SSEEvent = { data: '' };
        const lines = rawEvent.split('\n');

        for (const line of lines) {
          if (line.startsWith('id:')) {
            event.id = line.slice(3).trim();
          } else if (line.startsWith('event:')) {
            event.event = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            if (event.data) event.data += '\n';
            event.data += line.slice(5).trim();
          } else if (line.startsWith('retry:')) {
            const retryValue = parseInt(line.slice(6).trim(), 10);
            if (!isNaN(retryValue)) event.retry = retryValue;
          }
        }

        if (event.data) {
          controller.enqueue(event);
        }
      }
    },

    flush(controller) {
      if (buffer.trim()) {
        const event: SSEEvent = { data: '' };
        const lines = buffer.split('\n');

        for (const line of lines) {
          if (line.startsWith('id:')) {
            event.id = line.slice(3).trim();
          } else if (line.startsWith('event:')) {
            event.event = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            if (event.data) event.data += '\n';
            event.data += line.slice(5).trim();
          } else if (line.startsWith('retry:')) {
            const retryValue = parseInt(line.slice(6).trim(), 10);
            if (!isNaN(retryValue)) event.retry = retryValue;
          }
        }

        if (event.data) {
          controller.enqueue(event);
        }
      }
    },
  });
}

/**
 * Creates a middleware that intercepts SSE responses.
 *
 * Checks the response Content-Type header. If it does not match
 * text/event-stream, the response passes through unchanged with
 * zero overhead.
 *
 * If matched, wraps the response body with a TextDecoderStream
 * and SSE parser transform. Returns a GodspeedResponse with
 * parsedBody as an async iterable ReadableStream of SSEEvent objects.
 *
 * Consumers can use for-await-of to iterate events as they arrive.
 */
export function sse(): MiddlewareFn {
  return async (req, next) => {
    const response = await next(req);

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('text/event-stream')) {
      return response;
    }

    if (!response.parsedBody || !(response.parsedBody instanceof ReadableStream)) {
      return response;
    }

    const eventStream = (response.parsedBody as ReadableStream<Uint8Array>)
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(createSSETransform());

    return {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      parsedBody: eventStream,
      data: eventStream,
    };
  };
}
