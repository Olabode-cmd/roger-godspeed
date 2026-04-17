/**
 * requestBuilder.test.ts
 *
 * Unit tests for Request construction.
 * Validates payload parsing, URL safe concatenation, protocol-relative
 * URL handling, and explicit baseURL edge cases.
 */
import { describe, test, expect } from 'bun:test';
import { buildRequest } from '../../src/core/requestBuilder';

describe('requestBuilder', () => {
  test('should correctly concat baseURL and path', () => {
    const req = buildRequest('GET', '/users', { baseURL: 'https://api.com/' });
    expect(req.url).toBe('https://api.com/users');
  });

  test('should bypass baseURL if path is completely absolute', () => {
    const req = buildRequest('GET', 'https://other.com/users', { baseURL: 'https://api.com/' });
    expect(req.url).toBe('https://other.com/users');
  });

  test('should serialize strings explicitly', async () => {
    const req = buildRequest('POST', 'https://api.com/data', {}, 'raw string payload');
    expect(req.headers.get('content-type')).toBe('text/plain');
    const text = await req.text();
    expect(text).toBe('raw string payload');
  });

  test('should serialize objects as JSON automatically', async () => {
    const payload = { key: 'value' };
    const req = buildRequest('POST', 'https://api.com/data', {}, payload);
    expect(req.headers.get('content-type')).toBe('application/json');
    const json = await req.json();
    expect(json).toEqual(payload);
  });

  test('should not override content-type if explicitly set by config', () => {
    const req = buildRequest('POST', 'https://api.com/data', { headers: { 'Content-Type': 'application/custom+json' } }, { a: 1 });
    expect(req.headers.get('content-type')).toBe('application/custom+json');
  });

  test('should handle path without leading slash', () => {
    const req = buildRequest('GET', 'users/list', { baseURL: 'https://api.com' });
    expect(req.url).toBe('https://api.com/users/list');
  });

  test('should use path as-is when baseURL is empty string', () => {
    const req = buildRequest('GET', 'https://other.com/data', { baseURL: '' });
    expect(req.url).toBe('https://other.com/data');
  });

  test('should handle baseURL with nested path segments', () => {
    const req = buildRequest('GET', '/endpoint', { baseURL: 'https://api.com/v2' });
    expect(req.url).toBe('https://api.com/v2/endpoint');
  });

  test('should pass Blob body through without JSON serialization', async () => {
    const blob = new Blob(['blob content'], { type: 'application/octet-stream' });
    const req = buildRequest('POST', 'https://api.com/upload', {}, blob);
    const text = await req.text();
    expect(text).toBe('blob content');
  });

  test('should pass FormData body through without JSON serialization', () => {
    const form = new FormData();
    form.append('field', 'value');
    const req = buildRequest('POST', 'https://api.com/form', {}, form);
    expect(req.headers.get('content-type')).not.toBe('application/json');
  });
});
