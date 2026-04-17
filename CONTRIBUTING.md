# Contributing to Godspeed

First off, thank you for considering contributing to Godspeed. Building a world-class ecosystem requires the sharpest minds, and we are excited to have you here. 

Godspeed is a high-performance, **zero-dependency** tool built with clean architectural principles. To maintain this standard, we act as strict Gatekeepers. We do not accept contributions that compromise speed, safety, or bundle size.

Please read the following policies carefully before opening a Pull Request.

---

## 🏎️ The "Performance Tax" Rule

Godspeed's primary directive is speed. 

Any Pull Request that adds a feature **must include a benchmark** (using `Bun.nanoseconds()` or `Autocannon`). 
- If your change slows down the core pipeline by even **2%**, it will not be merged unless the feature is universally critical.
- Ensure zero unnecessary allocations in hot paths like `compose.ts` or `pipeline.ts`.
- Memory impact will be reviewed just as heavily as execution speed.

## 🏛️ The "Architecture First" Policy

The core engine (`packages/godspeed/src/core`, `middleware`, `retry`) is intentionally locked down. 
- Contributions modifying the fundamental middleware execution engine or request pipeline are expected to be rare. 
- Unless you are fixing a critical bug in the core, please open an Issue to discuss it before spending time writing code.

**Where we need you the most:**
Most contributions should focus on the edges of the ecosystem:
1. **Built-in Middlewares:** Adding opt-in plugins like Firebase Auth middleware, a Sentry error reporter, or Schema Validators.
2. **The Migration CLI:** Updating AST transformations (`packages/cli/`) to expand what the automated Godspeed migrator can do. 

## 🚫 The Zero-Dependency "Roger" Brand

We maintain a strict **zero-dependency rule** for the core `@roger/godspeed` package. 
- If you try to pull in a utility library like `lodash`, `ramda`, or any external validation library into the core, it is an immediate **"No."**
- External tools are only permitted within the `@godspeed/cli` workspace, which exists precisely to keep those dependencies out of the core client.

---

## 🚦 How to Contribute

1. **Test EVERYTHING:** 100% branch coverage is expected on core utilities. We track regressions religiously.
2. **Types First:** We strictly prohibit the use of `any` and expect precise narrowing.
3. **Draft PRs:** Open a Draft PR if you want early feedback on a complex approach.
4. **Be Professional:** Read `INSTRUCTIONS.md` in the repository for detailed coding standards. If a PR doesn't meet the standards, we will politely ask you to update it.

When you're ready, fork the repository, adhere to the architectural decisions outlined in `dev-plan.md`, and Godspeed!
