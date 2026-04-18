# Migrating from Axios to Godspeed

Transitioning from Axios to Godspeed is designed to be a smooth, straightforward process. We've built dedicated tools to ensure you can upgrade your network layer and immediately benefit from massive performance gains with minimal friction.

Godspeed provides two excellent paths for migration:
1.  **The Compat Layer:** A drop-in bridging adapter (`@roger/godspeed/compat`) that allows you to keep your existing Axios code while running the Godspeed engine under the hood.
2.  **Native Godspeed:** A more direct integration utilizing our high-performance Koa-style middleware pipeline for maximum speed.

For most applications, the Compat Layer gets you 99% of the way there automatically. This guide covers how to use these tools and highlights a few minor adjustments you might need for advanced use cases.

## The Migration CLI

The fastest way to migrate is using our automated AST tool (`@godspeed/cli`). It safely and automatically rewrites your standard `axios` imports to use the Godspeed compat layer.

```bash
bunx @godspeed/cli migrate ./src
```

This single command will update your imports and handle standard `axios.get` and `axios.post` patterns. Your application will immediately start using Godspeed without needing widespread manual rewrites.

## Understanding the Architectural Upgrade

If you choose to write Native Godspeed middleware or rely on highly complex Axios interceptors, there are a few architectural upgrades to be aware of. We opted for a modern, performance-first design, which introduces a few pleasant shifts in how you handle requests.

### 1. Middleware vs. Interceptors

Axios utilizes a "flat" array of interceptors. Godspeed upgrades this to an elegant "Onion" middleware architecture, similar to highly regarded frameworks like Koa.js. A single middleware function handles both the pre-request and post-response phases seamlessly using the `await next()` pattern.

**What to know:**
If you stack multiple middleware functions, the post-response phase naturally resolves in reverse order. The Compat Layer handles translating most Axios interceptors automatically, but if your interceptors rely on a highly specific, order-dependent promise chain, a quick manual review ensures everything behaves exactly as expected.

### 2. Streamlined Body Parsing

To maintain our industry-leading performance, Godspeed implements a "Single-Pass Body" system.

**What to know:**
Instead of manually calling `.json()` and cloning streams multiple times (which degrades performance), Godspeed elegantly parses the stream exactly once. The data is instantly available to all middleware and your application via the robust `parsedBody` property on the response. Changing your logic to read from `parsedBody` instead of interacting with the raw stream is a quick update that pays immediate dividends in memory safety and speed.

### 3. Clearer Error Handling

Axios response error interceptors function similarly to Promise `.catch()` handlers, which can sometimes lead to swallowed errors masking downstream issues.

**What to know:**
Godspeed's onion architecture utilizes standard, predictable `try/catch` error bubbling. Errors bubble cleanly up the middleware stack. This gives you absolute control over scoping and recovering from errors. Translating complex Axios rejection handlers merely requires wrapping your `await next()` calls in standard `try/catch` blocks.

## Known Differences

The compat layer faithfully replicates Axios's interceptor execution order (LIFO for request, FIFO for response) and ejection semantics. However, a few behavioral differences exist due to Godspeed's type-safe, two-phase architecture:

| Axios Behavior | Godspeed Compat Behavior |
|:---|:---|
| Request interceptor rejections flow into response interceptor reject handlers via a single flat promise chain. | Request-phase errors throw before dispatch. Response interceptor reject handlers only see response-phase errors. |
| Rejected handler recovery can return any value (untyped promise chain). | Rejected handler recovery must return the correct phase type (`Request` for request interceptors, `GodspeedResponse` for response interceptors). |
| `response.data` contains the parsed body. | `response.parsedBody` contains the parsed body. |
| `transformRequest` / `transformResponse` supported. | Not supported. Use Godspeed middleware for equivalent functionality. |
| `cancelToken` supported for request cancellation. | Not supported. Use `AbortController` with `AbortSignal`. |
| `onUploadProgress` / `onDownloadProgress` supported. | Not supported. Use native `ReadableStream` progress tracking. |
| `config.data` carries the request body. | Request body is part of the native `Request` object. |

## Summary

Migrating to Godspeed is an exceptionally high-ROI upgrade. By using the Compat Layer and our automated CLI, the vast majority of your codebase can transition seamlessly. For the few advanced interceptors that require manual refactoring, embracing Godspeed's modern middleware patterns will leave your codebase cleaner, safer, and significantly faster.
