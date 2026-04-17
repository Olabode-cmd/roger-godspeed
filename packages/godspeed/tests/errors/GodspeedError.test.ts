/**
 * GodspeedError.test.ts
 *
 * Unit tests for the Godspeed discrete error classes.
 *
 * Verifies instantiation, instanceof checks, property assignments,
 * and string representations.
 *
 * Dependencies: imports from `src/errors/GodspeedError`.
 */
import { describe, test, expect } from 'bun:test';
import { 
  NetworkError, 
  TimeoutError, 
  HttpError, 
  ValidationError, 
  BaseGodspeedError 
} from '../../src/errors/GodspeedError';

describe('Error Classes', () => {
  test('NetworkError instantiates correctly', () => {
    const err = new NetworkError('DNS failure');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(BaseGodspeedError);
    expect(err).toBeInstanceOf(NetworkError);
    expect(err.type).toBe('network');
    expect(err.message).toBe('DNS failure');
    expect(err.name).toBe('NetworkError');
  });

  test('TimeoutError instantiates correctly with timeout property', () => {
    const err = new TimeoutError('Request timed out', 5000);
    expect(err).toBeInstanceOf(TimeoutError);
    expect(err.type).toBe('timeout');
    expect(err.message).toBe('Request timed out');
    expect(err.timeoutMs).toBe(5000);
    expect(err.name).toBe('TimeoutError');
  });

  test('HttpError instantiates correctly with status and body', () => {
    const body = { error: 'Not Found' };
    const err = new HttpError('Failed request', 404, body);
    expect(err).toBeInstanceOf(HttpError);
    expect(err.type).toBe('http');
    expect(err.message).toBe('Failed request');
    expect(err.status).toBe(404);
    expect(err.body).toEqual(body);
    expect(err.name).toBe('HttpError');
  });

  test('ValidationError carries unknown details without modifying them', () => {
    const details = [{ path: 'user.name', issue: 'required' }];
    const err = new ValidationError('Payload invalid', details);
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.type).toBe('validation');
    expect(err.message).toBe('Payload invalid');
    expect(err.details).toEqual(details);
    expect(err.name).toBe('ValidationError');
  });
});
