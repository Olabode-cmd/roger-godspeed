/**
 * responseParser.test.ts
 *
 * Unit tests for parsing standard Responses into GodspeedResponse structures.
 */
import { describe, test, expect } from 'bun:test';
import { parseResponse } from '../../src/core/responseParser';

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
});
