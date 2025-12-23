#!/usr/bin/env node

/**
 * ClaudeWork CLI エントリーポイント
 *
 * npx claude-work で起動できるCLIパッケージ
 * Next.jsカスタムサーバーを起動します。
 * .nextディレクトリがない場合は自動的にビルドを実行します。
 * 環境変数の検証はserver.tsで行われます。
 */

import { spawn, spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// .envファイルを読み込む
const dotenvResult = dotenv.config();
if (dotenvResult.error) {
  // .envファイルが見つからない場合は警告のみ（環境変数が直接設定されている場合があるため）
  console.warn('Warning: Could not load .env file:', dotenvResult.error.message);
}

// CommonJSビルド時は__dirnameが利用可能
const currentDir = __dirname;

// プロジェクトルートを解決（dist/src/bin/ から3階層上）
const projectRoot = path.resolve(currentDir, '..', '..', '..');

const PORT = process.env.PORT || '3000';

/**
 * Next.jsビルドが存在するか確認
 */
function checkNextBuild(): boolean {
  const nextDir = path.join(projectRoot, '.next');
  const buildIdPath = path.join(nextDir, 'BUILD_ID');
  return fs.existsSync(nextDir) && fs.existsSync(buildIdPath);
}

/**
 * Next.jsをビルド
 */
function buildNext(): boolean {
  console.log('Building Next.js application...');

  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npmCmd, ['run', 'build:next'], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: { ...process.env },
  });

  if (result.status !== 0) {
    console.error('Failed to build Next.js application');
    return false;
  }

  console.log('Build completed successfully.');
  return true;
}

/**
 * サーバーを起動
 */
function startServer(): void {
  console.log(`Starting ClaudeWork on port ${PORT}...`);

  // server.jsのパスを解決
  const serverPath = path.resolve(currentDir, '..', '..', 'server.js');

  // サーバーをspawn（本番モードで実行）
  const server = spawn('node', [serverPath], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production', PORT },
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
}

// メイン処理
function main(): void {
  // .nextディレクトリの存在確認
  if (!checkNextBuild()) {
    console.log('No production build found. Running build first...');
    if (!buildNext()) {
      process.exit(1);
    }
  }

  // サーバー起動
  startServer();
}

main();
