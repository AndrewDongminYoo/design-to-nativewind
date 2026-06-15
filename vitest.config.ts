import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Scope discovery to our source tree. Globbing the project root would
    // follow the .trunk symlinks into ~/.cache/trunk and collect unrelated tests.
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'build', '.trunk'],
  },
});
