# Godspeed

Godspeed is a high-performance, zero-dependency HTTP client for modern TypeScript environments including Node.js 20+, Bun, Deno, and Cloudflare Workers. 

It is designed precisely for scenarios where latency overhead, memory allocations, and bundle size matter.

## Core Philosophy

Godspeed prioritizes execution speed. Every architectural decision is oriented around reducing microtask hops, limiting object allocations during the request lifecycle, and maintaining strict type safety without reliance on the `any` keyword.

*   **Zero Dependencies:** The core package is entirely self-contained.
*   **Onion Middleware Architecture:** Koa-style `next()` composition allows for robust pre-request and post-response processing within a single closure scope.
*   **Single-Pass Body Parsing:** Response streams are consumed exactly once. This explicitly prevents cloning overhead and ensures a highly predictable memory profile.
*   **Strict Types First:** First-class discriminated union errors and strict generic bindings.

## Installation

```bash
bun add @roger/godspeed
```

## Quick Start

```typescript
import { GodspeedClient } from '@roger/godspeed';

const client = new GodspeedClient({
  baseURL: 'https://api.example.com',
  timeout: 5000
});

// A standard GET request
const response = await client.get('/users');

console.log(response.status);
console.log(response.parsedBody);
```

## Documentation

*   [Migrating from Axios](./docs/axios-migration.md)
*   [Contributing Guidelines](./CONTRIBUTING.md)

## License

MIT
