import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    globalSetup: './vitest.global-setup.ts',
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/db.test.ts', '**/process-manager.test.ts'],
    testTimeout: 10000,
    hookTimeout: 10000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'file:./prisma/data/test.db',
    },
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false,
      },
    },
    maxConcurrency: 5,
    isolate: true,
    server: {
      deps: {
        inline: [],
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
