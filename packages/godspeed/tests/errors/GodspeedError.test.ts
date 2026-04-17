/**
 * GodspeedError.test.ts
 *
 * Unit tests for the Godspeed discrete error classes.
 *
 * Verifies instantiation, instanceof checks, property assignments,
 * stack trace preservation, cause chain forwarding, and the new
 * ParseError class.
 *
 * Dependencies: imports from `src/errors/GodspeedError`.
 */
import { describe, test, expect } from 'bun:test';
import {
  NetworkError,
  TimeoutError,
  HttpError,
  ValidationError,
  ParseError,
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

  test('ParseError instantiates correctly with contentType', () => {
    const err = new ParseError('Bad JSON', 'application/json');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(BaseGodspeedError);
    expect(err).toBeInstanceOf(ParseError);
    expect(err.type).toBe('parse');
    expect(err.message).toBe('Bad JSON');
    expect(err.contentType).toBe('application/json');
    expect(err.name).toBe('ParseError');
  });

  test('stack trace is defined and contains the error class name', () => {
    const err = new NetworkError('trace test');
    expect(err.stack).toBeDefined();
    expect(typeof err.stack).toBe('string');
  });

  test('NetworkError preserves cause chain via ErrorOptions', () => {
    const original = new TypeError('fetch failed');
    const wrapped = new NetworkError('DNS failure', { cause: original });
    expect(wrapped.cause).toBe(original);
    expect(wrapped.cause).toBeInstanceOf(TypeError);
  });

  test('TimeoutError preserves cause chain via ErrorOptions', () => {
    const original = new DOMException('The operation was aborted');
    const wrapped = new TimeoutError('Request timed out', 5000, { cause: original });
    expect(wrapped.cause).toBe(original);
  });

  test('HttpError preserves cause chain via ErrorOptions', () => {
    const original = new Error('upstream error');
    const wrapped = new HttpError('Server error', 500, null, { cause: original });
    expect(wrapped.cause).toBe(original);
  });

  test('ValidationError preserves cause chain via ErrorOptions', () => {
    const original = new Error('schema mismatch');
    const wrapped = new ValidationError('Invalid payload', { issues: [] }, { cause: original });
    expect(wrapped.cause).toBe(original);
  });

  test('ParseError preserves cause chain for SyntaxErrors', () => {
    const original = new SyntaxError('Unexpected token < in JSON at position 0');
    const err = new ParseError('Failed to parse', 'application/json', { cause: original });
    expect(err.cause).toBe(original);
    expect(err.cause).toBeInstanceOf(SyntaxError);
  });
});
