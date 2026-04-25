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
import type { GodspeedResponse, NextFn } from '../src/types';

const ITERATIONS = 100_000;

async function runBenchmark() {
  console.log('\n=============================================');
  console.log('📊 WebSocket Plugin Benchmark');
  console.log('=============================================\n');

  const dummyResponse: GodspeedResponse<unknown> = {
    status: 200,
    statusText: 'OK',
    headers: new Headers(),
    parsedBody: { data: 'ok' },
    data: { data: 'ok' },
  };

  const mockNext: NextFn = async (_req: Request) => dummyResponse;

  const httpRequest = new Request('https://api.example.com/data');
  const mw = websocket();

  console.log(`🔥 Warming up JIT compiler...`);
  for (let i = 0; i < 1000; i++) {
    await mw(httpRequest, mockNext);
    await mockNext(httpRequest);
  }

  console.log(`\n🌐 Running baseline (no middleware)...`);
  Bun.gc(true);
  const noMiddlewareStart = Bun.nanoseconds();
  for (let i = 0; i < ITERATIONS; i++) {
    await mockNext(httpRequest);
  }
  const noMiddlewareEnd = Bun.nanoseconds();
  const baselineMs = (noMiddlewareEnd - noMiddlewareStart) / 1_000_000;
  const baselinePerReq = (noMiddlewareEnd - noMiddlewareStart) / ITERATIONS;

  console.log(`🚀 Running with WebSocket plugin...`);
  Bun.gc(true);
  const startHttp = Bun.nanoseconds();
  for (let i = 0; i < ITERATIONS; i++) {
    await mw(httpRequest, mockNext);
  }
  const endHttp = Bun.nanoseconds();
  const pluginMs = (endHttp - startHttp) / 1_000_000;
  const pluginPerReq = (endHttp - startHttp) / ITERATIONS;

  const overhead = pluginPerReq - baselinePerReq;
  const overheadPercent = ((overhead / baselinePerReq) * 100);

  console.log('\n=============================================');
  console.log(`📊 RESULTS (${ITERATIONS} iterations)`);
  console.log('=============================================');
  console.log(`Baseline (no middleware):  ${baselineMs.toFixed(2)} ms`);
  console.log(`With WebSocket plugin:     ${pluginMs.toFixed(2)} ms`);
  console.log(`\nPer-request overhead:      ${overhead.toFixed(2)} ns`);
  console.log(`Overhead percentage:       ${overheadPercent.toFixed(2)}%`);
  console.log(`\n🏆 Result: ${overheadPercent < 1 ? '✅ PASS' : '⚠️  REVIEW'} - Target: <1% overhead`);
  console.log('=============================================\n');
}

runBenchmark().catch(console.error);
