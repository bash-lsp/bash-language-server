import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/src/**/__tests__/*.ts', 'vscode-client/__tests__/*.ts'],
    clearMocks: true,
    // Keep integration tests from competing for subprocesses and fixture files.
    fileParallelism: false,
    sequence: { hooks: 'list' },
    coverage: {
      provider: 'v8',
      include: ['server/src/**/*.ts', 'vscode-client/src/**/*.ts'],
      exclude: ['**/__tests__/**', '**/*.d.ts'],
      reporter: ['text-summary', 'lcov', 'html'],
    },
  },
})
