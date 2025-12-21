#!/usr/bin/env node

/**
 * ClaudeWork CLI エントリーポイント
 *
 * npx claude-work で起動できるCLIパッケージ
 * Next.jsカスタムサーバーを起動します。
 * 環境変数の検証はserver.tsで行われます。
 */

import { spawn } from 'child_process';
import path from 'path';

// CommonJSビルド時は__dirnameが利用可能
const currentDir = __dirname;

const PORT = process.env.PORT || '3000';

console.log(`Starting ClaudeWork on port ${PORT}...`);

// server.jsのパスを解決
// dist/src/bin/cli.js から dist/server.js への相対パス
const serverPath = path.resolve(currentDir, '..', '..', 'server.js');

// サーバーをspawn
const server = spawn('node', [serverPath], {
  stdio: 'inherit',
  env: { ...process.env, PORT },
});

// サーバー終了時の処理
server.on('exit', (code) => {
  process.exit(code || 0);
});

// エラーハンドリング
server.on('error', (error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
