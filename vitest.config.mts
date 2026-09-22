import { availableParallelism } from 'node:os'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/src/**/__tests__/*.ts', 'vscode-client/__tests__/*.ts'],
    clearMocks: true,
    pool: 'threads',
    // Keep file isolation, but bound parallelism to limit subprocess contention.
    maxWorkers: Math.min(4, availableParallelism()),
    sequence: { hooks: 'list' },
  },
})
