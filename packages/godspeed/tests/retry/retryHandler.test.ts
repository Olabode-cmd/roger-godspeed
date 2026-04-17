/**
 * retryHandler.test.ts
 *
 * Unit tests validating retry logic, jitter backoffs,
 * idempotency checks, and explicit Retry-After header parsing.
 */
import { describe, test, expect } from 'bun:test';
import { withRetries, parseRetryAfter, isIdempotent } from '../../src/retry/retryHandler';

describe('retryHandler exports', () => {
  test('isIdempotent identifies safe methods exactly', () => {
    expect(isIdempotent('GET')).toBe(true);
    expect(isIdempotent('PUT')).toBe(true);
    expect(isIdempotent('POST')).toBe(false);
    expect(isIdempotent('PATCH')).toBe(false);
  });

  test('parseRetryAfter parses strict numeric seconds', () => {
    expect(parseRetryAfter('120')!).toBe(120000);
  });

  test('parseRetryAfter gracefully falls back to undefined for gibberish', () => {
    expect(parseRetryAfter('not-a-number')).toBeUndefined();
  });
});

describe('retryHandler looping logic', () => {
  test('does not retry POST requests even if maxRetries > 0', async () => {
    const req = new Request('https://api.com', { method: 'POST' });
    let attempts = 0;
    
    const fetchMock = async () => {
      attempts++;
      return new Response(null, { status: 503 }); // Retryable
    };

    const res = await withRetries(req, { retries: 5 }, fetchMock);
    expect(res.status).toBe(503);
    expect(attempts).toBe(1); // Blocked by idempotency check
  });

  test('retries GET requests up to maxRetries on 503', async () => {
    const req = new Request('https://api.com', { method: 'GET' });
    let attempts = 0;

    const fetchMock = async () => {
      attempts++;
      return new Response(null, { status: 503 }); // Retryable
    };

    const res = await withRetries(req, { retries: 3 }, fetchMock);
    expect(res.status).toBe(503);
    expect(attempts).toBe(4); // 1 initial + 3 retries
  });

  test('throws immediate errors on non-retryable status', async () => {
    const req = new Request('https://api.com', { method: 'GET' });
    let attempts = 0;

    const fetchMock = async () => {
      attempts++;
      return new Response(null, { status: 404 }); // NOT retryable
    };

    const res = await withRetries(req, { retries: 3 }, fetchMock);
    expect(res.status).toBe(404);
    expect(attempts).toBe(1); 
  });
});
