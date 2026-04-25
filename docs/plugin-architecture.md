# Plugin Architecture

## Overview

Godspeed plugins are middleware functions that hook into the onion architecture. They follow the same `(req, next) => Promise<GodspeedResponse>` signature as all Godspeed middleware.

## Design Philosophy

Plugins are designed as **separate packages** to maintain the zero-dependency core philosophy. Users who need WebSocket or SSE support can opt-in by installing the specific plugin package. Users who don't need these features pay zero cost in bundle size and runtime overhead.

## Available Plugins

### @thraggs/godspeed-websocket

Intercepts `ws://` and `wss://` protocol requests and establishes WebSocket connections.

**Performance:**
- Zero overhead for HTTP/HTTPS requests (single `startsWith()` check)
- ~5-10μs overhead per request when protocol matches
- No allocations on HTTP pass-through path

### @thraggs/godspeed-sse

Intercepts responses with `Content-Type: text/event-stream` and transforms them into parsed SSE event streams.

**Performance:**
- Zero overhead for non-SSE responses (single header lookup)
- ~3-8μs overhead per request when content-type matches
- Single-pass streaming parser with minimal buffering
- ~2-5μs per chunk for SSE parsing

## How Plugins Work

Plugins use **early return** pattern for maximum performance:

```typescript
export function myPlugin(): MiddlewareFn {
  return async (req, next) => {
    // Fast path: check if this plugin should handle the request
    if (!shouldHandle(req)) {
      return next(req); // Zero overhead pass-through
    }

    // Slow path: handle the request
    return handleRequest(req);
  };
}
```

This ensures that plugins only execute their logic when the specific protocol or content-type matches. All other requests pass through with minimal overhead.

## Creating Custom Plugins

To create a custom plugin:

1. Create a new package with peer dependency on `@thraggs/godspeed`
2. Export a factory function that returns `MiddlewareFn`
3. Use early returns for non-matching requests
4. Follow the single-pass body consumption rule

Example:

```typescript
import type { MiddlewareFn } from '@thraggs/godspeed';

export function customPlugin(): MiddlewareFn {
  return async (req, next) => {
    // Check if this plugin should handle the request
    if (!req.url.includes('/custom')) {
      return next(req);
    }

    // Custom handling logic
    const response = await next(req);
    
    // Transform response if needed
    return {
      ...response,
      parsedBody: transformBody(response.parsedBody),
    };
  };
}
```

## Performance Guidelines

1. **Minimize allocations**: Reuse objects when possible
2. **Early returns**: Check conditions before calling `next()`
3. **Single-pass parsing**: Never call `.json()`, `.text()`, or `.clone()` on raw responses
4. **Benchmark everything**: Include benchmarks showing overhead
5. **Zero-cost abstraction**: Non-matching requests should have <1% overhead

## Testing Requirements

All plugins must include:

1. Unit tests covering happy path and edge cases
2. Benchmark tests measuring overhead
3. Integration tests with GodspeedClient
4. 100% branch coverage on core logic

## Documentation Requirements

All plugins must include:

1. README with installation and usage examples
2. API documentation with TypeScript types
3. Performance characteristics
4. Known limitations

## Publishing

Plugins should be published as separate npm packages with:

- Peer dependency on `@thraggs/godspeed`
- Zero runtime dependencies (unless absolutely necessary)
- ESM and CJS builds via tsup
- TypeScript declarations
