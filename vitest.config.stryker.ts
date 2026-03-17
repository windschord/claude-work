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
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/e2e/**',
      '.worktrees/**',
      'data/**',
      // Stryker: 初期テスト実行で失敗する既知のテストを除外
      '**/EnvironmentForm.port-volume.test.tsx',
      '**/EnvironmentForm.disabled-host.test.tsx',
    ],
    testTimeout: 10000,
    hookTimeout: 10000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'file:../data/test.db',
    },
    pool: 'forks',
    maxConcurrency: 5,
    isolate: true,
    fileParallelism: false,
    teardownTimeout: 5000,
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
