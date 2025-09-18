import path from 'node:path'

import { defineConfig } from 'vitest/config'

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

    // Test timeout for async operations - increased for complex service initialization
    testTimeout: 30000,
    hookTimeout: 15000,

    // Reporters
    reporter: ['default', 'html'],

    // Output files
    outputFile: {
      html: './test/vitest-results/index.html',
      json: './test/vitest-results/results.json',
    },

    // Pool options for better performance
    pool: 'forks', // Use forks instead of threads to support process.chdir()
    poolOptions: {
      forks: {
        singleFork: false,
      },
    },

    // Watch mode configuration
    watch: true,

    // Mock configuration
    mockReset: true,
    clearMocks: true,
    restoreMocks: true,
  },

  // Resolve aliases for easier imports
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@test': path.resolve(__dirname, './test'),
    },
  },

  // Define globals for TypeScript support
  define: {
    'import.meta.vitest': undefined,
  },
})
