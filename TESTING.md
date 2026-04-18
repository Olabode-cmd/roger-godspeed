# 🧪 Roger Godspeed — Testing & Benchmarking Strategy

This document outlines the testing protocols for `roger-godspeed`. Since performance is our defining feature, testing is split into three strict domains: **Logic & Integration**, **Type Safety**, and **Performance Audits**.

## 1. Unit & Integration Testing

We use **Bun Test** for its native TypeScript support, automatic loading, and extremely fast execution speed.

Our test suite is organized by feature domain rather than purely by test type, ensuring tests remain co-located with the specific functional architecture they validate. 

Tests are located in `packages/godspeed/tests/`:
- `core/`: Tests request building, config resolution, pipeline execution, and response parsing.
- `middleware/`: Tests the Koa-style onion composition engine and opt-in plugins (auth, logger, validator).
- `retry/`: Validates exponential backoff math and abort-aware delay integration.
- `compat/`: Validates the Axios adapter's behavior, ensuring promise execution ordering and mapping accuracy.

### Execution Command
Run the test suite seamlessly within the package workspace:
```bash
cd packages/godspeed
bun test
```

## 2. Type Testing

We rely on strict TypeScript compiler checks (`strict: true`, `exactOptionalPropertyTypes: true`). The project enforces zero usage of `any`. We implicitly test our type narrowing and generic bindings directly within the standard test suites.

To verify the absence of type definition errors during CI/CD:
```bash
cd packages/godspeed
bun run typecheck
```

## 3. Performance Audit & Axios Benchmarking

Performance is a hard functional requirement. **If a Pull Request increases overhead by more than 5%, the automated audit fails.** 

Proving that `roger-godspeed` is drastically faster and memory-efficient compared to `axios` is the core reason this library exists. 

### Core Tooling
We do not use `PerformanceObserver` or raw `Date.now()`. We exclusively measure using:
1. **`Bun.nanoseconds()`**: For micro-benchmarking internal allocation overhead.
2. **`Autocannon`**: For holistic HTTP throughput, concurrency load testing, and latency percentiles.

### The Head-to-Head Strategy: Godspeed vs. Axios

Our benchmarking suites (located in `packages/godspeed/tests/benchmarks/`) are designed to directly measure Godspeed against Axios across these critical dimensions:

- **Time to First Byte (TTFB):** Measuring setup latency before the request hits the network interface socket. Godspeed's pre-computed `compose()` pipeline is designed to eliminate the array mapping and dynamic promise chaining setup overhead native to Axios.
- **Memory Allocation & GC Pressure:** Demonstrating the value of our "Single-Pass Body" architecture. We benchmark the memory footprint explicitly to prove that directly mapping the stream to `parsedBody` creates significantly less garbage collection pressure than Axios's internal buffering and cloning.
- **Middleware vs. Interceptor Overhead:** Measuring the execution latency delta between Godspeed's closure-based onion architecture and Axios's flat LIFO/FIFO promise chains under heavy concurrency. The Godspeed core fetch wrapping should be mathematically negligible.

> **Notice for Contributors:** If you are submitting a PR that touches the hot paths (`src/core/`, `src/middleware/`), you must run the benchmark suite and post the delta against Axios in your Pull Request description.