#!/usr/bin/env node

/**
 * ClaudeWork CLI エントリーポイント
 *
 * npx claude-work で起動できるCLIパッケージ
 * 環境変数をチェックし、Next.jsカスタムサーバーを起動します。
 */

import { spawn } from 'child_process';
import path from 'path';
import dotenv from 'dotenv';

// .envファイルを読み込む
dotenv.config();

// CommonJSビルド時は__dirnameが利用可能
const currentDir = __dirname;

const PORT = process.env.PORT || '3000';
const CLAUDE_WORK_TOKEN = process.env.CLAUDE_WORK_TOKEN;
const SESSION_SECRET = process.env.SESSION_SECRET;

// 環境変数チェック
if (!CLAUDE_WORK_TOKEN) {
  console.error('Error: CLAUDE_WORK_TOKEN environment variable is required');
  console.error('Please set CLAUDE_WORK_TOKEN in your .env file or environment');
  process.exit(1);
}

if (!SESSION_SECRET) {
  console.error('Error: SESSION_SECRET environment variable is required');
  console.error('Please set SESSION_SECRET (32+ characters) in your .env file or environment');
  process.exit(1);
}

if (SESSION_SECRET.length < 32) {
  console.error('Error: SESSION_SECRET must be at least 32 characters long');
  process.exit(1);
}

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
