/**
 * backoff.test.ts
 *
 * Unit tests for jitter and backoff calculations.
 */
import { describe, test, expect } from 'bun:test';
import { calculateFullJitter } from '../../src/retry/backoff';

describe('backoff - Full Jitter', () => {
  test('delay should always fall between 0 and minimum of cap/exponential', () => {
    for (let i = 0; i < 50; i++) {
        // attempt 1 => max delay 200ms
        const delay = calculateFullJitter(1, 100, 10000);
        expect(delay).toBeGreaterThanOrEqual(0);
        expect(delay).toBeLessThanOrEqual(200);
    }
  });

  test('delay should absolutely respect the cap', () => {
    // attempt 10 usually yields 100 * 1024 = 102400 max. With cap 5000, it shouldn't exceed 5000.
    for (let i = 0; i < 50; i++) {
        const delay = calculateFullJitter(10, 100, 5000);
        expect(delay).toBeGreaterThanOrEqual(0);
        expect(delay).toBeLessThanOrEqual(5000);
    }
  });
});
