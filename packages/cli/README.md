# ⚡ @thraggs/cli

The official AST migration codemod for the `@thraggs/godspeed` HTTP client.

This CLI tool automatically inspects your codebase and seamlessly migrates legacy `axios` bindings to target Godspeed's high-performance compatibility layer.

### Usage

You can run the utility securely without installing it permanently via `npx` or `bunx`. Just point it at your source directory:

```bash
npx @thraggs/cli migrate ./src
```

### What it does automatically:
1. Swaps `import axios from 'axios'` directly to `import { GodspeedClient as axios } from '@thraggs/godspeed/compat'` across hundreds of files simultaneously.
2. Natively rewrites explicit `axios.create({ ... })` initializer patterns.
3. Analyzes your trees for fragmented Axios interceptor patterns (`axios.interceptors.request.use`), automatically ignoring safe code while explicitly flagging complex Promise-chain anomalies directly to a raw `godspeed-migration-report.md` markdown file for your manual quality assurance.
