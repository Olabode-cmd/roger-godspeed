/**
 * GodspeedClient.test.ts
 *
 * Integrates tests validating the wrapper API surface
 * and middleware freezing mechanism.
 */
import { describe, test, expect } from 'bun:test';
import { GodspeedClient } from '../../src/core/GodspeedClient';

describe('GodspeedClient API Surface', () => {
  test('Prevents middleware patching post-request', async () => {
    const client = new GodspeedClient();
    
    // Valid usage
    client.use(async (req, next) => next(req));

    // Mock fetch to fail instantly instead of hanging on fakeurl.local DNS resolution
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () => Promise.reject(new Error('Mock network failure'));

    // Dispatch a failing request intentionally to trigger memoization
    await client.get('http://fakeurl.local').catch(() => {});

    globalThis.fetch = originalFetch;

    // Try modifying architecture post-memo
    expect(() => {
      client.use(async (req, next) => next(req));
    }).toThrow('Godspeed: Cannot add middleware after requests have been initiated.');
  });
});
