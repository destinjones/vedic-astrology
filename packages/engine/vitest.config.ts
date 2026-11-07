import { defineConfig } from 'vitest/config';

/**
 * Coverage floor for the chart engine. `npm test` runs with coverage, so CI
 * fails when a change drops below these numbers. Raise them as tests are
 * added; do not lower them to get a change through.
 */
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/types.ts', 'src/**/*.d.ts'],
      reporter: ['text-summary', 'json-summary'],
      thresholds: {
        statements: 97,
        lines: 97,
        functions: 93,
        branches: 88,
      },
    },
  },
});
