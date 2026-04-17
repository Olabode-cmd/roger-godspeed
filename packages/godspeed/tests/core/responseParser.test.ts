/**
 * responseParser.test.ts
 *
 * Unit tests for parsing standard Responses into GodspeedResponse structures.
 * Includes tests for malformed JSON, empty bodies, and fallback content-type
 * handling to ensure no untyped exceptions escape.
 */
import { describe, test, expect } from 'bun:test';
import { parseResponse } from '../../src/core/responseParser';
import { ParseError } from '../../src/errors/GodspeedError';

describe('responseParser', () => {
  test('should parse JSON correctly into parsedBody', async () => {
    const rawRes = new Response(JSON.stringify({ hello: 'world' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

    const gsRes = await parseResponse(rawRes);
    expect(gsRes.status).toBe(200);
    expect(gsRes.parsedBody).toEqual({ hello: 'world' });
  });

  test('should parse Text correctly into parsedBody', async () => {
    const rawRes = new Response('plain text output', {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });

    const gsRes = await parseResponse(rawRes);
    expect(gsRes.parsedBody).toBe('plain text output');
  });

  test('should parse ArrayBuffer as fallback for binary Types', async () => {
    const buffer = new Uint8Array([1, 2, 3]).buffer;
    const rawRes = new Response(buffer, {
      headers: { 'Content-Type': 'application/octet-stream' }
    });

    const gsRes = await parseResponse(rawRes);
    expect(gsRes.parsedBody).toBeInstanceOf(ArrayBuffer);
  });

  test('should throw ParseError for malformed JSON bodies', async () => {
    const rawRes = new Response('not valid json{{{', {
      headers: { 'Content-Type': 'application/json' }
    });

    try {
      await parseResponse(rawRes);
      expect(true).toBe(false);
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ParseError);
      if (err instanceof ParseError) {
        expect(err.type).toBe('parse');
        expect(err.contentType).toBe('application/json');
        expect(err.cause).toBeInstanceOf(SyntaxError);
      }
    }
  });

  test('should throw ParseError for empty body with JSON content-type', async () => {
    const rawRes = new Response('', {
      headers: { 'Content-Type': 'application/json' }
    });

    try {
      await parseResponse(rawRes);
      expect(true).toBe(false);
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ParseError);
    }
  });

  test('should throw ParseError when server sends HTML with JSON content-type', async () => {
    const rawRes = new Response('<html><body>502 Bad Gateway</body></html>', {
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    });

    try {
      await parseResponse(rawRes);
      expect(true).toBe(false);
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ParseError);
      if (err instanceof ParseError) {
        expect(err.message).toBe('Failed to parse response body as JSON');
      }
    }
  });

  test('should fallback to ArrayBuffer when content-type header is absent', async () => {
    const rawRes = new Response(null, { status: 204 });

    const gsRes = await parseResponse(rawRes);
    expect(gsRes.status).toBe(204);
    expect(gsRes.parsedBody).toBeInstanceOf(ArrayBuffer);
  });

  test('should handle JSON with charset parameter in content-type', async () => {
    const rawRes = new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });

    const gsRes = await parseResponse(rawRes);
    expect(gsRes.parsedBody).toEqual({ ok: true });
  });
});
