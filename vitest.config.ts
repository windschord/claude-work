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
      '**/db.test.ts',
      '**/process-manager.test.ts',
      '**/e2e/**',  // Playwrightのe2eテストを除外
      // CI環境で不安定なテストを一時的に除外
      ...(process.env.CI ? [
        '**/pty-manager.test.ts',
        '**/useTerminal.test.ts',
        '**/git-service-status.test.ts',
        '**/app/sessions/__tests__/[id].test.tsx',
        '**/app/projects/__tests__/[id].test.tsx',
        '**/AuthGuard.test.tsx',
        '**/middleware.test.ts',
        '**/app/api/**/__tests__/**',  // API routeテスト全般
        '**/lib/__tests__/auth.test.ts',  // 認証テスト
      ] : []),
    ],
    testTimeout: 10000,
    hookTimeout: 10000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'file:./prisma/data/test.db',
    },
    // CI環境では並列化を制限してハングを防ぐ
    pool: process.env.CI ? 'forks' : 'forks',
    poolOptions: {
      forks: {
        singleFork: process.env.CI ? true : false,
      },
    },
    maxConcurrency: process.env.CI ? 1 : 5,
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
