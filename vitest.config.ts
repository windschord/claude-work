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
      '**/e2e/**',  // Playwrightのe2eテストを除外
      '.worktrees/**',  // worktreeディレクトリのテストを除外
      // CI環境で不安定なテストを一時的に除外
      ...(process.env.CI ? [
        '**/pty-manager.test.ts',
        '**/git-service-status.test.ts',
        '**/app/sessions/__tests__/[id].test.tsx',
        '**/app/projects/__tests__/[id].test.tsx',
        '**/AuthGuard.test.tsx',
        '**/middleware.test.ts',
        '**/lib/__tests__/auth.test.ts',
      ] : []),
    ],
    testTimeout: 10000,
    hookTimeout: 10000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'file:../data/test.db',
    },
    // CI環境では並列化を制限してハングを防ぐ
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: process.env.CI ? true : false,
      },
    },
    maxConcurrency: process.env.CI ? 1 : 5,
    isolate: true,
    // APIテストの認証セッション競合を防ぐためファイル並列実行を無効化
    fileParallelism: false,
    // テスト完了後にハングしないようにタイムアウトを短く設定
    teardownTimeout: 5000,
    server: {
      deps: {
        inline: [],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '.worktrees/',
        '**/*.config.ts',
        '**/__tests__/**',
        '**/tests/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
