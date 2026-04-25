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
import type { GodspeedResponse, NextFn } from '../src/types';

const ITERATIONS = 100_000;

async function runBenchmark() {
  console.log('\n=============================================');
  console.log('📊 SSE Plugin Benchmark');
  console.log('=============================================\n');

  const jsonResponse: GodspeedResponse<unknown> = {
    status: 200,
    statusText: 'OK',
    headers: new Headers({ 'content-type': 'application/json' }),
    parsedBody: { data: 'ok' },
    data: { data: 'ok' },
  };

  const mockNext: NextFn = async (_req: Request) => jsonResponse;

  const httpRequest = new Request('https://api.example.com/data');
  const mw = sse();

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

  console.log(`🚀 Running with SSE plugin...`);
  Bun.gc(true);
  const startJson = Bun.nanoseconds();
  for (let i = 0; i < ITERATIONS; i++) {
    await mw(httpRequest, mockNext);
  }
  const endJson = Bun.nanoseconds();
  const pluginMs = (endJson - startJson) / 1_000_000;
  const pluginPerReq = (endJson - startJson) / ITERATIONS;

  const overhead = pluginPerReq - baselinePerReq;
  const overheadPercent = ((overhead / baselinePerReq) * 100);

  console.log('\n=============================================');
  console.log(`📊 RESULTS (${ITERATIONS} iterations)`);
  console.log('=============================================');
  console.log(`Baseline (no middleware):  ${baselineMs.toFixed(2)} ms`);
  console.log(`With SSE plugin:           ${pluginMs.toFixed(2)} ms`);
  console.log(`\nPer-request overhead:      ${overhead.toFixed(2)} ns`);
  console.log(`Overhead percentage:       ${overheadPercent.toFixed(2)}%`);
  console.log(`\n🏆 Result: ${overheadPercent < 1 ? '✅ PASS' : '⚠️  REVIEW'} - Target: <1% overhead`);
  console.log('=============================================\n');
}

runBenchmark().catch(console.error);
