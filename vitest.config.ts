import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-utils/setup.ts'],
    // tests/rules/** require the Firestore/Storage emulators (a JVM) and run
    // only via `npm run test:rules`, never in the default `vitest run`.
    // .claude/** holds harness metadata and agent worktrees (full repo copies) that
    // must never be picked up by the root suite.
    exclude: [...configDefaults.exclude, 'tests/rules/**', '**/.claude/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
