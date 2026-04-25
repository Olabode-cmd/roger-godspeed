# Building and Publishing Plugins

## Build Process

### Build All Packages

From the workspace root:

```bash
cd packages/godspeed-websocket
npm run build

cd ../godspeed-sse
npm run build
```

### Type Checking

Verify TypeScript types are correct:

```bash
cd packages/godspeed-websocket
npm run typecheck

cd ../godspeed-sse
npm run typecheck
```

### Run Tests

Execute unit tests:

```bash
cd packages/godspeed-websocket
npm test

cd ../godspeed-sse
npm test
```

### Run Benchmarks

Measure performance overhead:

```bash
cd packages/godspeed-websocket
bun tests/websocket.bench.ts

cd ../godspeed-sse
bun tests/sse.bench.ts
```

## Pre-Publish Checklist

- [ ] All tests passing
- [ ] Type checking passes
- [ ] Benchmarks show acceptable overhead (<2%)
- [ ] README is complete with examples
- [ ] Version number updated in package.json
- [ ] CHANGELOG updated (if applicable)
- [ ] No `console.log` statements in production code
- [ ] All files have proper block comments
- [ ] No `any` types in source code

## Publishing to npm

### First Time Setup

```bash
npm login
```

### Publish WebSocket Plugin

```bash
cd packages/godspeed-websocket
npm publish --access public
```

### Publish SSE Plugin

```bash
cd packages/godspeed-sse
npm publish --access public
```

## Version Management

Follow semantic versioning:

- **Patch** (1.0.x): Bug fixes, performance improvements
- **Minor** (1.x.0): New features, backward compatible
- **Major** (x.0.0): Breaking changes

Update version in package.json before publishing:

```bash
npm version patch  # 1.0.0 -> 1.0.1
npm version minor  # 1.0.0 -> 1.1.0
npm version major  # 1.0.0 -> 2.0.0
```

## CI/CD Integration

### GitHub Actions Workflow

Create `.github/workflows/publish-plugins.yml`:

```yaml
name: Publish Plugins

on:
  push:
    tags:
      - 'websocket-v*'
      - 'sse-v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: oven-sh/setup-bun@v1
      
      - name: Install dependencies
        run: bun install
      
      - name: Build packages
        run: |
          cd packages/godspeed-websocket && bun run build
          cd ../godspeed-sse && bun run build
      
      - name: Run tests
        run: |
          cd packages/godspeed-websocket && bun test
          cd ../godspeed-sse && bun test
      
      - name: Publish to npm
        run: |
          echo "//registry.npmjs.org/:_authToken=${{ secrets.NPM_TOKEN }}" > ~/.npmrc
          cd packages/godspeed-websocket && npm publish --access public
          cd ../godspeed-sse && npm publish --access public
```

## Distribution Files

After building, each package should contain:

```
dist/
├── index.cjs       # CommonJS bundle
├── index.mjs       # ESM bundle
├── index.d.ts      # TypeScript declarations
└── types.d.ts      # Type definitions
```

## Bundle Size Targets

- **WebSocket plugin**: <2KB minified
- **SSE plugin**: <3KB minified

Verify with:

```bash
cd packages/godspeed-websocket/dist
ls -lh index.mjs

cd ../../godspeed-sse/dist
ls -lh index.mjs
```

## Testing Published Packages

After publishing, test installation in a fresh project:

```bash
mkdir test-plugins
cd test-plugins
bun init -y

bun add @thraggs/godspeed
bun add @thraggs/godspeed-websocket
bun add @thraggs/godspeed-sse

# Create test file
cat > test.ts << 'EOF'
import { GodspeedClient } from '@thraggs/godspeed';
import { websocket } from '@thraggs/godspeed-websocket';
import { sse } from '@thraggs/godspeed-sse';

const client = new GodspeedClient();
client.use(websocket());
client.use(sse());

console.log('Plugins loaded successfully!');
EOF

bun run test.ts
```

## Rollback Procedure

If a published version has issues:

```bash
# Deprecate the bad version
npm deprecate @thraggs/godspeed-websocket@1.0.1 "Critical bug, use 1.0.2 instead"

# Publish fixed version
npm version patch
npm publish
```

## Documentation Updates

After publishing, update:

1. Main README.md with new plugin versions
2. docs/plugin-integration.md with any API changes
3. CHANGELOG.md with release notes
4. GitHub releases with benchmark results

## Support

For issues or questions:

- GitHub Issues: https://github.com/thraggs/godspeed/issues
- Discussions: https://github.com/thraggs/godspeed/discussions
