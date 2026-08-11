import path, { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

const currentDirectory = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    // Enable globals (describe, it, expect)
    globals: true,

    // Node.js environment for our CLI/server application
    environment: 'node',

    // Test file patterns
    include: ['test/**/*.{test,spec}.{js,ts}', 'src/**/*.{test,spec}.{js,ts}'],
    exclude: ['node_modules', 'dist', 'build'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'test/', 'bin/', '*.config.*', 'scripts/', 'types/'],
      // Realistic coverage thresholds for release
      thresholds: {
        branches: 70,
        functions: 80,
        lines: 75,
        statements: 75,
      },
    },

    // Test timeout for async operations - increased for complex service initialization.
    // hookTimeout matches testTimeout because several suites dynamically import the
    // provider graph inside a hook; the first such import pays a one-time cold
    // transform cost for the vendor SDKs (Vercel AI SDK, AWS, Google) that is far
    // larger than the ~2s runtime import cost measured against the built output.
    testTimeout: 30000,
    hookTimeout: 30000,

    // Reporters
    reporters: ['default', 'html', 'json'],

    // Output files
    outputFile: {
      html: './test/vitest-results/index.html',
      json: './test/vitest-results/results.json',
    },

    // Use forks instead of threads to support process.chdir() in legacy tests.
    pool: 'forks',

    // CLI suites spawn their own Node processes and contain wall-clock assertions.
    // Running test files concurrently makes those assertions measure worker
    // contention instead of CLI behavior.
    fileParallelism: false,

    // Explicit run mode for CI and local verification commands.
    watch: false,

    // Mock configuration
    mockReset: true,
    clearMocks: true,
    restoreMocks: true,
  },

  // Resolve aliases for easier imports
  resolve: {
    alias: {
      '@': path.resolve(currentDirectory, './src'),
      '@test': path.resolve(currentDirectory, './test'),
    },
  },

  // Define globals for TypeScript support
  define: {
    'import.meta.vitest': undefined,
  },
})
