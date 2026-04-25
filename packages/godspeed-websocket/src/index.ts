/**
 * index.ts
 *
 * WebSocket protocol middleware for Godspeed.
 *
 * This plugin intercepts requests with ws:// or wss:// protocols and
 * establishes WebSocket connections instead of standard HTTP requests.
 * For all other protocols, it passes through to the next middleware
 * with zero overhead (single string comparison).
 *
 * The plugin wraps the native WebSocket API and returns a GodspeedResponse
 * containing the socket instance in parsedBody. This allows consumers to
 * interact with the WebSocket using standard event handlers while
 * maintaining type safety through the Godspeed response interface.
 *
 * Performance: Protocol check is a single startsWith() call. When the
 * protocol does not match, the function returns immediately with no
 * allocations. When matched, a single WebSocket instance is created
 * and wrapped in a Promise that resolves on connection open.
 *
 * Dependencies: imports MiddlewareFn from @thraggs/godspeed.
 */
import type { MiddlewareFn } from './types';

export type { MiddlewareFn, NextFn, GodspeedResponse } from './types';

export interface WebSocketResponse {
  socket: WebSocket;
  protocol: string;
}

/**
 * Creates a middleware that intercepts WebSocket protocol requests.
 *
 * Checks if the request URL starts with ws:// or wss://. If not,
 * immediately delegates to next() with zero overhead.
 *
 * If matched, creates a native WebSocket connection and returns a
 * GodspeedResponse with status 101 (Switching Protocols) and the
 * socket instance in parsedBody.
 *
 * The socket is returned in an open state. Consumers must attach
 * their own error, message, and close handlers.
 */
export function websocket(): MiddlewareFn {
  return async (req, next) => {
    const url = req.url;

    if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
      return next(req);
    }

    const ws = new WebSocket(url);

    return new Promise((resolve, reject) => {
      ws.addEventListener('open', () => {
        resolve({
          status: 101,
          statusText: 'Switching Protocols',
          headers: new Headers(),
          parsedBody: {
            socket: ws,
            protocol: ws.protocol,
          } as WebSocketResponse,
          data: {
            socket: ws,
            protocol: ws.protocol,
          } as WebSocketResponse,
        });
      });

      ws.addEventListener('error', (event) => {
        reject(new Error(`WebSocket connection failed: ${event}`));
      });
    });
  };
}
