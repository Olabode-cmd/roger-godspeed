# Godspeed Use-Case Guide

Godspeed is a zero-dependency, ultra-fast HTTP client. It abandons traditional configuration structures in favor of an **Onion Middleware Pipeline** and native HTTP APIs safely typed for enterprise applications.

Below are the most common advanced use cases.

---

## 1. Automatic Retries & Backoff Protection
You do not need to write custom logic for standard connection errors (DNS timeouts, 502/503/504 errors). 

Godspeed's core engine natively integrates **Full Jitter Exponential Backoff**. It ensures that if massive amounts of clients fail simultaneously, they don't slam your downstream server all at exactly the same time ("Thundering Herd" protection).

```typescript
import { GodspeedClient } from '@thraggs/godspeed';

const client = new GodspeedClient({
  baseURL: 'https://api.example.com',
  timeout: 10000, 
  retries: 3      // Automatically backs off with random Jitter
});

// Post requests are mathematically never retried automatically 
// to prevent duplicate side effects on the server.
await client.post('/data', { secure: true }); 

// GET/HEAD/OPTIONS are safe to retry.
await client.get('/users'); 
```

---

## 2. Dynamic Authentication Middleware
Instead of hardcoding a bearer token in your config, you can use Godspeed's built-in `bearerAuth` middleware. If you pass an async function, Godspeed dynamically awaits it before dispatching the network request, ensuring your token never goes stale.

```typescript
import { GodspeedClient } from '@thraggs/godspeed';
import { bearerAuth } from '@thraggs/godspeed/middleware';

const client = new GodspeedClient({ baseURL: 'https://api.example.com' });

client.use(bearerAuth(async () => {
  // Pull a fresh token from memory, local storage, or AWS Cognito
  return await getFreshJwtToken(); 
}));
```

---

## 3. Strict Schema Validation (Zod / TypeBox)
Typescript natively doesn't guarantee that the data coming back from a server actually matches your generic type constraints. To solve this safely, Godspeed features a built-in `validateResponse` middleware.

```typescript
import { GodspeedClient } from '@thraggs/godspeed';
import { validateResponse } from '@thraggs/godspeed/middleware';
import { z } from 'zod';

const UserSchema = z.object({
  id: z.string(),
  active: z.boolean()
});

const client = new GodspeedClient({ baseURL: 'https://api.example.com' });

// Every request returning data will now safely pass through Zod
client.use(validateResponse(UserSchema));

try {
  const response = await client.get('/user/123');
  // At this point, TS infers response.parsedBody safely via Zod!
  console.log(response.parsedBody.id);
} catch (error) {
  // Throws GodspeedValidationError if the sever lies about its payload
}
```

---

## 4. The 401 Token Refresh Interceptor
If an access token expires, you can pause the entire pipeline, fetch a refresh token, clone the Request natively, and resume the pipeline.

```typescript
client.use(async (req, next) => {
  try {
    return await next(req);
  } catch (err: unknown) {
    if (err instanceof HttpError && err.status === 401) {
      const newToken = await fetchRefreshToken(); 

      const retryReq = new Request(req, {
        headers: { ...req.headers, Authorization: `Bearer ${newToken}` }
      });

      return await next(retryReq);
    }
    throw err;
  }
});
```

---

## 5. Migrating from Axios
For enterprise codebases, we supply an AST-migration script to automatically upgrade thousands of files from Axios to Godspeed without breaking variable scopes.

```bash
# In your terminal
npx @thraggs/cli migrate ./src
```
This tool reads files, safely replaces `import axios from 'axios'` with the `GodspeedClient` compat layer, and flags any manual review situations (like disconnected interceptors) immediately to an auto-generated migration report.
