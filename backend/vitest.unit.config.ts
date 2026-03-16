import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: '.',
    include: ['tests/unit/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    // No setupFiles -- unit tests do not require MongoDB or Redis
    testTimeout: 30_000,
    hookTimeout: 30_000,
    pool: 'forks',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/types/**'],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
