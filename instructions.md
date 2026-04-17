# 🚀 Godspeed — AI Pair Programmer Rules

> **NOTICE:** These instructions are non-negotiable. Read them fully before touching any file.

## 📌 Project Identity
**Godspeed** is a performance-critical, zero-dependency TypeScript HTTP client. Every decision—architecture, data structures, control flow, naming—is driven by two questions: 
1. **Is this correct?**
2. **Is this as fast as it can be?**

If you cannot answer **both**, do not write the code.

---

## 🛠 Absolute Rules
- [ ] **No inline comments:** Every file and logical section requires a block comment above it. No comments inside function bodies. If a line needs explanation, rewrite it.
- [ ] **No `any`:** Not in source, not in tests. Use `unknown` and narrow explicitly if types are truly dynamic.
- [ ] **No dependencies (core):** `packages/godspeed/src/` must have **zero** runtime imports from `node_modules` (except `import type`). The CLI package (`packages/cli/`) is exempt and may use external tooling.
- [ ] **No silent failures:** Use typed `GodspeedError` subtypes. Never swallow errors or return `null` as an error signal.
- [ ] **No `// TODO` commits:** If it is unfinished, it does not get committed. Open a GitHub issue instead.

---

## 📝 Commenting Standards

### File-Level Block
Every file must start with this structure:
```typescript
/**
 * [filename]
 *
 * [What this module is responsible for. One to three sentences.]
 *
 * [Why this module exists as a separate concern — what would break or become
 * unclear if its logic lived elsewhere.]
 *
 * [Any non-obvious performance decisions made here, and why.]
 *
 * [Dependencies: list what this module imports from within the project and why.]
 */
```

### Function/Class Level Block
Non-trivial members require the following:
```typescript
/**
 * [What this function does.]
 *
 * [Any performance-critical behavior — e.g., "this function is in the hot path
 * and allocates zero objects on the happy path."]
 *
 * [Edge cases that are explicitly handled and why.]
 */
```

---

## 💻 TypeScript Rules
* **Strict Mode:** Enable `strict: true`, `exactOptionalPropertyTypes: true`, and `noUncheckedIndexedAccess: true`.
* **Definitions:** Prefer `type` for unions/computed shapes; `interface` for extensible object shapes.
* **Assertions:** Never use `as` outside of test files. Fix the type design instead.
* **Error Handling:** Use **Discriminated Unions**. Subtypes must have a `type` string literal for switch-case narrowing.
* **Generics:** Use meaningful names (e.g., `TResponse`). Single letters (`T`, `U`) are only for generic utility wrappers.

---

## ⚡ Performance Rules
*Applies strictly to `src/core/`, `src/retry/`, and `src/middleware/`.*

1.  **Minimize Allocations:** Audit object creation in hot paths (request building/parsing). Merge configs once; reuse results.
2.  **Non-blocking:** No synchronous operations. Consider stream parsing for large JSON payloads.
3.  **Zero Redundancy:** Extract and reuse values (URLs, Headers) instead of re-constructing them in the pipeline.
4.  **Real Jitter:** Use Full Jitter: $random(0, min(cap, base \times 2^{attempt}))$.
5.  **AbortSignal:** Use `AbortSignal.any()` natively. Do not use `setTimeout` for cancellation. Perform a **one-time runtime check** on client instantiation and throw `GodspeedError` if `AbortSignal.any` is unavailable.
6.  **Single-Pass Body:** The raw `Response` body stream is consumed **exactly once** by `responseParser.ts`. It is materialized as `parsedBody: TData` on `GodspeedResponse<TData>`. No middleware or consumer may call `.json()`, `.text()`, or `.clone()` on the underlying response.
7.  **Evidence-Based:** PRs claiming performance gains **must** include benchmarks (`Bun.nanoseconds()` or `Autocannon`).

---

## ⚠️ Error & Middleware Logic

### Error Subtypes
| Error Type | Trigger Condition |
| :--- | :--- |
| **NetworkError** | Wraps native `fetch` failures (DNS, connection). |
| **TimeoutError** | Explicitly for deliberate cancellations. |
| **HttpError** | Non-2xx responses; includes eagerly read body. |
| **ValidationError** | Dumb data carrier: `type`, `message`, `details: unknown`. All formatting and diff logic belongs in validation middleware, never in the error class. |

### Middleware Requirements
* **Purity:** Functions must be pure; no mutable state in closures (except dedicated factories like `cache`).
* **Composition:** The `compose` function must not allocate arrays/closures during the per-request execution path. Pre-compute the dispatch chain at `compose()` time. Implement fast-paths for zero and single middleware.
* **Isolation:** Built-in middleware (auth, logging) must be opt-in and never imported by the core pipeline.
* **Body Access:** Middleware must read from `GodspeedResponse.parsedBody`. Calling `.json()`, `.text()`, or `.clone()` on the raw response is forbidden.

---

## 🔄 Compat & CLI Rules

### Compat Layer (`packages/godspeed/src/compat/`)
* Translation only (e.g., Axios to Godspeed). Core logic is **never** compromised for compatibility.
* The `interceptorAdapter.ts` is explicitly a **best-effort bridge** — documented as a shimmed pipeline with known behavioral differences from native Axios interceptors.
* Higher per-request latency than the core pipeline is acceptable and must be documented.
* A "Known Differences" section in the compat README is required.

### Migration CLI (`packages/cli/`)
* Ships as `@godspeed/cli` — a **separate package** with its own dependency tree.
* May use `jscodeshift`, `recast`, `commander`, or other robust AST tools. The zero-dependency rule does not apply.
* No regex-based code manipulation. All transforms must be AST-based.
* Migration reports always output to `godspeed-migration-report.md`.
* The CLI must flag Axios interceptor patterns that may behave differently under the compat layer.

---

## 🚦 Definition of "Done"
1.  **Function Level:** Typed, block-commented, unit-tested (happy + edge), and profiled.
2.  **File Level:** Function checks passed, file-level comment accurate, zero inline comments.
3.  **Phase Level:** Integration tests pass, and benchmarks show no regressions.

### Git & PRs
* **Commits:** Atomic changes using [Conventional Commits](https://www.conventionalcommits.org/).
* **PR Content:** Must include "What, Why, and Benchmarks."
* **CI/CD:** Zero tolerance for failing tests, TS errors, or Lint errors.