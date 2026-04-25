# Plugin Integration Guide

## Installation

Install the core Godspeed client and any plugins you need:

```bash
# Core client (required)
bun add @thraggs/godspeed

# WebSocket support (optional)
bun add @thraggs/godspeed-websocket

# SSE support (optional)
bun add @thraggs/godspeed-sse
```

## Basic Usage

### WebSocket

```typescript
import { GodspeedClient } from '@thraggs/godspeed';
import { websocket } from '@thraggs/godspeed-websocket';

const client = new GodspeedClient();
client.use(websocket());

const response = await client.get('wss://echo.websocket.org');
const { socket } = response.parsedBody;

socket.addEventListener('message', (event) => {
  console.log('Received:', event.data);
});

socket.send('Hello!');
```

### Server-Sent Events

```typescript
import { GodspeedClient } from '@thraggs/godspeed';
import { sse } from '@thraggs/godspeed-sse';

const client = new GodspeedClient({
  baseURL: 'https://api.example.com',
});

client.use(sse());

const response = await client.get('/events');

for await (const event of response.parsedBody) {
  console.log('Event:', event.event);
  console.log('Data:', event.data);
}
```

## Using Multiple Plugins

Plugins compose naturally through the middleware chain:

```typescript
import { GodspeedClient } from '@thraggs/godspeed';
import { websocket } from '@thraggs/godspeed-websocket';
import { sse } from '@thraggs/godspeed-sse';
import { bearerAuth, logger } from '@thraggs/godspeed';

const client = new GodspeedClient({
  baseURL: 'https://api.example.com',
  timeout: 30000,
});

// Register plugins in order
client.use(logger());
client.use(bearerAuth('your-token'));
client.use(websocket());
client.use(sse());

// HTTP requests work normally
const data = await client.get('/api/users');

// WebSocket requests are intercepted
const ws = await client.get('wss://stream.example.com');

// SSE requests are intercepted
const events = await client.get('/events');
```

## Plugin Order

Plugins execute in the order they are registered:

```typescript
client.use(pluginA()); // Executes first (outermost layer)
client.use(pluginB()); // Executes second
client.use(pluginC()); // Executes third (innermost layer)
```

For protocol-specific plugins like WebSocket and SSE, order typically doesn't matter since they only activate for specific protocols/content-types.

## Performance Considerations

### Zero Overhead for Unused Features

If you don't install a plugin, it's not in your bundle:

```typescript
// Only HTTP client in bundle (~15KB)
import { GodspeedClient } from '@thraggs/godspeed';

// HTTP + WebSocket in bundle (~16KB)
import { GodspeedClient } from '@thraggs/godspeed';
import { websocket } from '@thraggs/godspeed-websocket';

// HTTP + SSE in bundle (~17KB)
import { GodspeedClient } from '@thraggs/godspeed';
import { sse } from '@thraggs/godspeed-sse';
```

### Runtime Overhead

Plugins use early returns for non-matching requests:

- **WebSocket plugin**: <100ns overhead per HTTP request
- **SSE plugin**: <50ns overhead per non-SSE response

This is negligible compared to network latency (typically 10-100ms).

## TypeScript Support

All plugins are fully typed:

```typescript
import type { WebSocketResponse } from '@thraggs/godspeed-websocket';
import type { SSEEvent } from '@thraggs/godspeed-sse';

// WebSocket response is typed
const wsResponse = await client.get('wss://example.com');
const socket: WebSocket = wsResponse.parsedBody.socket;

// SSE events are typed
const sseResponse = await client.get('/events');
for await (const event of sseResponse.parsedBody) {
  const id: string | undefined = event.id;
  const type: string | undefined = event.event;
  const data: string = event.data;
  const retry: number | undefined = event.retry;
}
```

## Error Handling

### WebSocket Errors

```typescript
try {
  const response = await client.get('wss://invalid.example.com');
  const { socket } = response.parsedBody;
  
  socket.addEventListener('error', (error) => {
    console.error('WebSocket error:', error);
  });
} catch (error) {
  console.error('Connection failed:', error);
}
```

### SSE Errors

```typescript
try {
  const response = await client.get('/events');
  
  for await (const event of response.parsedBody) {
    console.log(event.data);
  }
} catch (error) {
  console.error('Stream error:', error);
}
```

## Runtime Compatibility

Both plugins work in all modern JavaScript runtimes:

- ✅ Node.js 20+
- ✅ Bun
- ✅ Deno
- ✅ Cloudflare Workers
- ✅ Browser (via bundler)

## Examples

See the `examples/` directory in each plugin package for complete working examples:

- `packages/godspeed-websocket/examples/basic.ts`
- `packages/godspeed-sse/examples/basic.ts`

## Troubleshooting

### Plugin not intercepting requests

Ensure the plugin is registered before making requests:

```typescript
const client = new GodspeedClient();
client.use(websocket()); // Must be before first request
await client.get('wss://example.com'); // ✅ Works
```

### Type errors with peer dependencies

Ensure `@thraggs/godspeed` is installed:

```bash
bun add @thraggs/godspeed
```

### WebSocket not connecting

Check that the URL uses `ws://` or `wss://` protocol:

```typescript
await client.get('wss://example.com'); // ✅ Correct
await client.get('https://example.com'); // ❌ Wrong protocol
```

### SSE not parsing

Ensure the server sends `Content-Type: text/event-stream`:

```typescript
// Server must respond with correct content-type
response.headers.set('Content-Type', 'text/event-stream');
```
