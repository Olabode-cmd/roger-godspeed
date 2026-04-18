# ⚡ @thraggs/godspeed

Godspeed is a high-performance, zero-dependency HTTP client for modern TypeScript environments including Node.js 20+, Bun, Deno, and Cloudflare Workers. 

It is designed precisely for scenarios where latency overhead, memory allocations, and bundle size matter. **In synthetic benchmarks, Godspeed executes >2.5x faster than Axios, 2.75x faster than ApiSauce, and >1.5x faster than Ky.**

### Core Philosophy

Godspeed prioritizes execution speed. Every architectural decision is oriented around reducing microtask hops, limiting object allocations during the request lifecycle, and maintaining strict type safety without reliance on the `any` keyword.

*   **Zero Dependencies:** The core package is entirely self-contained.
*   **Onion Middleware Architecture:** Koa-style pre-compiled closures allow for robust pre-request and post-response processing without heavy array-iteration overhead.
*   **Single-Pass Body Parsing:** Response streams are consumed exactly once, explicitly preventing cloning garbage collection pressure.
*   **Strict Types First:** First-class discriminated union errors and strict generic bindings. No hidden `any` casts.

### Installation

```bash
npm install @thraggs/godspeed
# or
bun add @thraggs/godspeed
```

### Quick Start

```typescript
import { GodspeedClient } from '@thraggs/godspeed';
import { bearerAuth } from '@thraggs/godspeed/middleware';

const client = new GodspeedClient({
  baseURL: 'https://api.example.com',
  timeout: 5000,
  retries: 3 // Built-in True Jitter Exponential Backoff
});

// Easily inject opt-in middleware
client.use(bearerAuth('super_secret_token'));

// A standard GET request
const response = await client.get('/users');

console.log(response.status);
console.log(response.parsedBody);
```

### Automatic Axios Migration
If you are currently using `axios`, you don't even need to rewrite your code. We built an official AST-transformer that natively migrates your application to our high-speed adapter in seconds:
```bash
npx @thraggs/cli migrate ./src
```
