import { defineConfig } from 'vitest/config'
import path from 'path'

/**
 * Dedicated config for the emulator-backed Firestore/Storage security-rules tests.
 *
 * The default `vitest.config.ts` EXCLUDES `tests/rules/**` (they need the JVM
 * emulators and a plain `node` environment, not jsdom), so `vitest run tests/rules`
 * against that config silently collects ZERO files — rules regressions would slip
 * through unnoticed. This config INCLUDES them explicitly so `npm run test:rules`
 * actually exercises the ruleset in CI and locally.
 *
 * Run via `npm run test:rules`, which wraps this in `firebase emulators:exec`.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.{test,spec}.ts'],
    // Emulator round-trips are slower than in-process unit tests.
    testTimeout: 20000,
    hookTimeout: 30000,
    // CRITICAL: all rules test files share ONE emulator datastore, and each
    // beforeEach clears + reseeds it globally. Running files in parallel makes
    // them clobber each other's seeds mid-evaluation — a get() then hits a
    // just-erased /users doc and the rule errors ("Service call error [get]" /
    // "Null value error"), plus concurrent writers hit 409 lock timeouts. Force
    // a single sequential worker so every file owns the emulator exclusively.
    fileParallelism: false,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
