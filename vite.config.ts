import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    sourcemap: true,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
        },
      },
    },
  },
  worker: {
    format: 'es',
  },
  server: {
    host: true,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 60_000,
    coverage: {
      provider: 'v8',
      include: ['src/core/**/*.ts'],
      exclude: ['src/core/data/**'],
      reporter: ['text', 'html'],
      // Le cœur du jeu est testé à 100 % : toute régression fait échouer `npm run coverage`.
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 },
    },
  },
});
