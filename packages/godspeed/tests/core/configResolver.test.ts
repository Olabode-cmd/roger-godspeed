/**
 * configResolver.test.ts
 *
 * Unit tests for the config merging pure function.
 * Verifies exact optional property merging and header references.
 */
import { describe, test, expect } from 'bun:test';
import { resolveConfig } from '../../src/core/configResolver';
import type { GodspeedConfig } from '../../src/types';

describe('configResolver', () => {
  test('should merge basic properties, preferring requestOptions', () => {
    const base: GodspeedConfig = { baseURL: 'http://base.com', timeout: 5000, retries: 3 };
    const req: GodspeedConfig = { baseURL: 'http://req.com', retries: 0 };

    const result = resolveConfig(base, req);
    expect(result.baseURL).toBe('http://req.com');
    expect(result.timeout).toBe(5000);
    expect(result.retries).toBe(0);
  });

  test('should merge headers creating a new object reference', () => {
    const base: GodspeedConfig = { headers: { 'Authorization': 'Bearer 123', 'Accept': 'text/html' } };
    const req: GodspeedConfig = { headers: { 'Accept': 'application/json', 'X-Custom': 'test' } };

    const result = resolveConfig(base, req);
    expect(result.headers).toEqual({
      'Authorization': 'Bearer 123',
      'Accept': 'application/json',
      'X-Custom': 'test'
    });
    // Ensure mutation of result doesn't bleed into base
    if (result.headers) result.headers['Accept'] = 'mutated';
    expect(base.headers?.['Accept']).toBe('text/html');
  });

  test('should handle missing headers in base or request options safely', () => {
    const base: GodspeedConfig = {};
    const req: GodspeedConfig = { timeout: 1000 };
    const result = resolveConfig(base, req);
    expect(result.headers).toBeUndefined();
    expect(result.timeout).toBe(1000);
  });
});
