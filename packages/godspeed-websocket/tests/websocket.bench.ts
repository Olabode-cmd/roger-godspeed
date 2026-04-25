/**
 * websocket.bench.ts
 *
 * Performance benchmarks for WebSocket plugin.
 *
 * Measures the overhead of protocol detection for HTTP requests
 * to ensure zero-cost abstraction when WebSocket is not used.
 *
 * Dependencies: imports websocket from src/index.
 */
import { websocket } from '../src/index';
import type { GodspeedResponse, NextFn } from '@thraggs/godspeed';

const dummyResponse: GodspeedResponse<unknown> = {
  status: 200,
  statusText: 'OK',
  headers: new Headers(),
  parsedBody: { data: 'ok' },
  data: { data: 'ok' },
};

const mockNext: NextFn = async (_req: Request) => dummyResponse;

const iterations = 100_000;

console.log('WebSocket Plugin Benchmarks');
console.log('============================\n');

const httpRequest = new Request('https://api.example.com/data');
const mw = websocket();

const startHttp = Bun.nanoseconds();
for (let i = 0; i < iterations; i++) {
  await mw(httpRequest, mockNext);
}
const endHttp = Bun.nanoseconds();
const httpOverhead = (endHttp - startHttp) / iterations;

console.log(`HTTP pass-through (${iterations} iterations):`);
console.log(`  Average: ${httpOverhead.toFixed(2)}ns per request`);
console.log(`  Total: ${((endHttp - startHttp) / 1_000_000).toFixed(2)}ms\n`);

const noMiddlewareStart = Bun.nanoseconds();
for (let i = 0; i < iterations; i++) {
  await mockNext(httpRequest);
}
const noMiddlewareEnd = Bun.nanoseconds();
const baselineOverhead = (noMiddlewareEnd - noMiddlewareStart) / iterations;

console.log(`Baseline (no middleware, ${iterations} iterations):`);
console.log(`  Average: ${baselineOverhead.toFixed(2)}ns per request`);
console.log(`  Total: ${((noMiddlewareEnd - noMiddlewareStart) / 1_000_000).toFixed(2)}ms\n`);

const pluginOverhead = httpOverhead - baselineOverhead;
console.log(`Plugin overhead: ${pluginOverhead.toFixed(2)}ns per request`);
console.log(`Overhead percentage: ${((pluginOverhead / baselineOverhead) * 100).toFixed(2)}%`);
