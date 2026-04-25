/**
 * sse.bench.ts
 *
 * Performance benchmarks for SSE plugin.
 *
 * Measures the overhead of content-type detection for non-SSE responses
 * to ensure zero-cost abstraction when SSE is not used.
 *
 * Dependencies: imports sse from src/index.
 */
import { sse } from '../src/index';
import type { GodspeedResponse, NextFn } from '@thraggs/godspeed';

const jsonResponse: GodspeedResponse<unknown> = {
  status: 200,
  statusText: 'OK',
  headers: new Headers({ 'content-type': 'application/json' }),
  parsedBody: { data: 'ok' },
  data: { data: 'ok' },
};

const mockNext: NextFn = async (_req: Request) => jsonResponse;

const iterations = 100_000;

console.log('SSE Plugin Benchmarks');
console.log('=====================\n');

const httpRequest = new Request('https://api.example.com/data');
const mw = sse();

const startJson = Bun.nanoseconds();
for (let i = 0; i < iterations; i++) {
  await mw(httpRequest, mockNext);
}
const endJson = Bun.nanoseconds();
const jsonOverhead = (endJson - startJson) / iterations;

console.log(`JSON pass-through (${iterations} iterations):`);
console.log(`  Average: ${jsonOverhead.toFixed(2)}ns per request`);
console.log(`  Total: ${((endJson - startJson) / 1_000_000).toFixed(2)}ms\n`);

const noMiddlewareStart = Bun.nanoseconds();
for (let i = 0; i < iterations; i++) {
  await mockNext(httpRequest);
}
const noMiddlewareEnd = Bun.nanoseconds();
const baselineOverhead = (noMiddlewareEnd - noMiddlewareStart) / iterations;

console.log(`Baseline (no middleware, ${iterations} iterations):`);
console.log(`  Average: ${baselineOverhead.toFixed(2)}ns per request`);
console.log(`  Total: ${((noMiddlewareEnd - noMiddlewareStart) / 1_000_000).toFixed(2)}ms\n`);

const pluginOverhead = jsonOverhead - baselineOverhead;
console.log(`Plugin overhead: ${pluginOverhead.toFixed(2)}ns per request`);
console.log(`Overhead percentage: ${((pluginOverhead / baselineOverhead) * 100).toFixed(2)}%`);
