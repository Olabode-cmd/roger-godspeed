# @thraggs/godspeed-sse

Server-Sent Events (SSE) middleware for Godspeed.

## Installation

```bash
bun add @thraggs/godspeed-sse
```

## Usage

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
  console.log('ID:', event.id);
}
```

## How It Works

The plugin intercepts responses with `Content-Type: text/event-stream` and transforms the raw byte stream into parsed SSE events. All other responses pass through untouched with zero overhead.

## Performance

- **Zero overhead for non-SSE responses**: Single header lookup
- **Single-pass parsing**: Events emitted as soon as complete message detected
- **Minimal buffering**: Only incomplete events remain in buffer
- **Stream-based**: No memory accumulation for long-lived connections

## API

### `sse()`

Creates a middleware that intercepts SSE responses.

**Returns:** `MiddlewareFn`

**Event Type:**

```typescript
interface SSEEvent {
  id?: string;
  event?: string;
  data: string;
  retry?: number;
}
```

The parsed event stream is available in `response.parsedBody` as an async iterable `ReadableStream<SSEEvent>`.

## SSE Protocol Support

- `id:` - Event ID
- `event:` - Event type
- `data:` - Event data (supports multi-line)
- `retry:` - Reconnection time in milliseconds

## License

MIT
