import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/transform.ts'],
  format: ['esm'],
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: true,
  treeshake: true,
  outExtension() {
    return {
      js: '.js',
    };
  },
});
