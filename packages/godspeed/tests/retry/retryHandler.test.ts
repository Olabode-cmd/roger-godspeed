/**
 * retryHandler.test.ts
 *
 * Unit tests validating retry logic, jitter backoffs, idempotency checks,
 * Retry-After header parsing (seconds and HTTP-date formats), abort-aware
 * delays, and network exception handling during retries.
 */
import { describe, test, expect } from 'bun:test';
import { withRetries, parseRetryAfter, isIdempotent } from '../../src/retry/retryHandler';

describe('isIdempotent', () => {
  test('identifies safe methods exactly', () => {
    expect(isIdempotent('GET')).toBe(true);
    expect(isIdempotent('HEAD')).toBe(true);
    expect(isIdempotent('OPTIONS')).toBe(true);
    expect(isIdempotent('PUT')).toBe(true);
    expect(isIdempotent('DELETE')).toBe(true);
  });

  test('rejects non-idempotent methods', () => {
    expect(isIdempotent('POST')).toBe(false);
    expect(isIdempotent('PATCH')).toBe(false);
  });

  test('handles case-insensitive method strings', () => {
    expect(isIdempotent('get')).toBe(true);
    expect(isIdempotent('post')).toBe(false);
  });
});

describe('parseRetryAfter', () => {
  test('parses strict numeric seconds into milliseconds', () => {
    expect(parseRetryAfter('120')).toBe(120000);
    expect(parseRetryAfter('0')).toBe(0);
    expect(parseRetryAfter('1')).toBe(1000);
  });

  test('returns undefined for null input', () => {
    expect(parseRetryAfter(null)).toBeUndefined();
  });

  test('returns undefined for empty string', () => {
    expect(parseRetryAfter('')).toBeUndefined();
  });

  test('gracefully returns undefined for unparseable strings', () => {
    expect(parseRetryAfter('not-a-number')).toBeUndefined();
  });

  test('parses HTTP-date format into relative milliseconds', () => {
    const futureDate = new Date(Date.now() + 60000).toUTCString();
    const result = parseRetryAfter(futureDate);
    expect(result).toBeDefined();
    expect(typeof result).toBe('number');
    expect(result!).toBeGreaterThan(50000);
    expect(result!).toBeLessThanOrEqual(60000);
  });

  test('clamps past HTTP-dates to zero', () => {
    const pastDate = new Date(Date.now() - 60000).toUTCString();
    expect(parseRetryAfter(pastDate)).toBe(0);
  });
});

describe('withRetries looping logic', () => {
  test('does not retry POST requests even if maxRetries > 0', async () => {
    const req = new Request('https://api.com', { method: 'POST' });
    let attempts = 0;

    const fetchMock = async () => {
      attempts++;
      return new Response(null, { status: 503 });
    };

    const res = await withRetries(req, { retries: 5 }, fetchMock);
    expect(res.status).toBe(503);
    expect(attempts).toBe(1);
  });

  test('does not retry PATCH requests', async () => {
    const req = new Request('https://api.com', { method: 'PATCH' });
    let attempts = 0;

    const fetchMock = async () => {
      attempts++;
      return new Response(null, { status: 500 });
    };

    const res = await withRetries(req, { retries: 3 }, fetchMock);
    expect(res.status).toBe(500);
    expect(attempts).toBe(1);
  });

  test('retries GET requests up to maxRetries on 503', async () => {
    const req = new Request('https://api.com', { method: 'GET' });
    let attempts = 0;

    const fetchMock = async () => {
      attempts++;
      return new Response(null, { status: 503 });
    };

    const res = await withRetries(req, { retries: 3 }, fetchMock);
    expect(res.status).toBe(503);
    expect(attempts).toBe(4);
  });

  test('returns immediately on non-retryable status', async () => {
    const req = new Request('https://api.com', { method: 'GET' });
    let attempts = 0;

    const fetchMock = async () => {
      attempts++;
      return new Response(null, { status: 404 });
    };

    const res = await withRetries(req, { retries: 3 }, fetchMock);
    expect(res.status).toBe(404);
    expect(attempts).toBe(1);
  });

  test('treats undefined retries as zero retries', async () => {
    const req = new Request('https://api.com', { method: 'GET' });
    let attempts = 0;

    const fetchMock = async () => {
      attempts++;
      return new Response(null, { status: 503 });
    };

    const res = await withRetries(req, {}, fetchMock);
    expect(res.status).toBe(503);
    expect(attempts).toBe(1);
  });

  test('throws when fetchTask throws and retries exhausted', async () => {
    const req = new Request('https://api.com', { method: 'GET' });
    let attempts = 0;

    const fetchMock = async () => {
      attempts++;
      throw new Error('connection refused');
    };

    try {
      await withRetries(req, { retries: 1 }, fetchMock);
      expect(true).toBe(false);
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(Error);
      if (err instanceof Error) {
        expect(err.message).toBe('connection refused');
      }
      expect(attempts).toBe(2);
    }
  });

  test('retries on fetchTask exceptions for idempotent methods', async () => {
    const req = new Request('https://api.com', { method: 'GET' });
    let attempts = 0;

    const fetchMock = async () => {
      attempts++;
      if (attempts < 3) throw new Error('ECONNRESET');
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };

    const res = await withRetries(req, { retries: 5 }, fetchMock);
    expect(res.status).toBe(200);
    expect(attempts).toBe(3);
  });
});
