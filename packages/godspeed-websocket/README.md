# @thraggs/godspeed-websocket

WebSocket protocol middleware for Godspeed.

## Installation

```bash
bun add @thraggs/godspeed-websocket
```

## Usage

```typescript
import { GodspeedClient } from '@thraggs/godspeed';
import { websocket } from '@thraggs/godspeed-websocket';

const client = new GodspeedClient({
  baseURL: 'wss://stream.example.com',
});

client.use(websocket());

const response = await client.get('/live');
const { socket } = response.parsedBody;

socket.addEventListener('message', (event) => {
  console.log('Received:', event.data);
});

socket.addEventListener('close', () => {
  console.log('Connection closed');
});

socket.send('Hello, server!');
```

## How It Works

The plugin intercepts requests with `ws://` or `wss://` protocols and establishes WebSocket connections instead of standard HTTP requests. For all other protocols, it passes through with zero overhead.

## Performance

- **Zero overhead for HTTP requests**: Single `startsWith()` check
- **Minimal allocations**: Only creates WebSocket instance when protocol matches
- **Native WebSocket API**: No wrapper overhead

## API

### `websocket()`

Creates a middleware that intercepts WebSocket protocol requests.

**Returns:** `MiddlewareFn`

**Response Type:**

```typescript
interface WebSocketResponse {
  socket: WebSocket;
  protocol: string;
}
```

The WebSocket instance is available in `response.parsedBody.socket`.

## License

MIT
