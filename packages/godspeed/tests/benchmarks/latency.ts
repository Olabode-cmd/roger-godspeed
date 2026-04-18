/**
 * latency.ts
 *
 * Micro-benchmarking script comparing Godspeed vs Axios vs Apisauce.
 * Uses Bun.serve() for a local echo server to measure real TTFB,
 * network stack overhead, and single-pass JSON parsing speed.
 *
 * Measurements are taken using high-resolution Bun.nanoseconds()
 * across thousands of sequential iterations.
 */
import { GodspeedClient } from '../../src/core/GodspeedClient';
import axios from 'axios';
import { create } from 'apisauce';

const ITERATIONS = 10000;

async function runBenchmark() {
  console.log(`\n⏳ Setting up benchmark server...`);
  
  // 1. Create a lightning-fast local echo server
  const server = Bun.serve({
    port: 0, // OS assigned
    fetch() {
      return new Response(JSON.stringify({ status: 'ok', data: [1, 2, 3] }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
  });

  const url = `http://localhost:${server.port}`;

  // 2. Initialize Clients with equivalent middleware/interceptor load
  const godspeed = new GodspeedClient({ baseURL: url });
  godspeed.use(async (req, next) => next(req)); // 1 middleware allocation

  const ax = axios.create({ baseURL: url });
  ax.interceptors.request.use(config => config); // 1 interceptor allocation

  const asauce = create({ baseURL: url });
  asauce.addRequestTransform(request => { 
    // minimal 1 transform allocation to match fairness
  });

  // 3. Warm-up Phase (JIT Compilation)
  console.log(`🔥 Warming up JIT compiler...`);
  for (let i = 0; i < 500; i++) {
    await godspeed.get('/warmup');
    await ax.get('/warmup');
    await asauce.get('/warmup');
  }

  // 4. Godspeed Benchmark
  console.log(`\n🚀 Running Godspeed iterations...`);
  Bun.gc(true); // Force GC to get clean memory baseline
  const startGs = Bun.nanoseconds();
  for (let i = 0; i < ITERATIONS; i++) {
    await godspeed.get('/data');
  }
  const endGs = Bun.nanoseconds();
  const godspeedMs = (endGs - startGs) / 1_000_000;

  // 5. Axios Benchmark
  console.log(`🐢 Running Axios iterations...`);
  Bun.gc(true);
  const startAx = Bun.nanoseconds();
  for (let i = 0; i < ITERATIONS; i++) {
    await ax.get('/data');
  }
  const endAx = Bun.nanoseconds();
  const axiosMs = (endAx - startAx) / 1_000_000;

  // 6. Apisauce Benchmark
  console.log(`🐢 Running Apisauce iterations...`);
  Bun.gc(true);
  const startAs = Bun.nanoseconds();
  for (let i = 0; i < ITERATIONS; i++) {
    await asauce.get('/data');
  }
  const endAs = Bun.nanoseconds();
  const sauceMs = (endAs - startAs) / 1_000_000;


  // 7. Results
  console.log(`\n=============================================`);
  console.log(`📊 BENCHMARK RESULTS (${ITERATIONS} Sequential Requests)`);
  console.log(`=============================================`);
  console.log(`Godspeed (Native):    ${godspeedMs.toFixed(2)} ms`);
  console.log(`Axios:                ${axiosMs.toFixed(2)} ms`);
  console.log(`Apisauce:             ${sauceMs.toFixed(2)} ms`);
  
  console.log(`\n🏆 Godspeed vs Axios:    ${(axiosMs / godspeedMs).toFixed(2)}x faster`);
  console.log(`🏆 Godspeed vs Apisauce: ${(sauceMs / godspeedMs).toFixed(2)}x faster`);
  console.log(`=============================================\n`);

  server.stop(true);
}

runBenchmark().catch(console.error);
