#!/usr/bin/env node

/**
 * ClaudeWork CLI エントリーポイント
 *
 * npx claude-work で起動できるCLIパッケージ
 * Next.jsカスタムサーバーを起動します。
 *
 * 自動セットアップ:
 * - .envファイルがない場合: .env.exampleからコピー
 * - Prismaクライアントがない場合: 自動生成
 * - データベースがない場合: 自動作成
 * - .nextディレクトリがない場合: 自動ビルド
 */

import { spawn, spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// CommonJSビルド時は__dirnameが利用可能
const currentDir = __dirname;

// プロジェクトルートを解決（dist/src/bin/ から3階層上）
const projectRoot = path.resolve(currentDir, '..', '..', '..');

/**
 * .envファイルのセットアップ
 */
function setupEnvFile(): void {
  const envPath = path.join(projectRoot, '.env');
  const envExamplePath = path.join(projectRoot, '.env.example');

  if (!fs.existsSync(envPath)) {
    if (fs.existsSync(envExamplePath)) {
      console.log('Creating .env from .env.example...');
      fs.copyFileSync(envExamplePath, envPath);
      console.log('  Created .env file. Please update with your settings.');
    } else {
      console.warn('Warning: No .env or .env.example file found.');
    }
  }

  // .envファイルを読み込む
  const dotenvResult = dotenv.config({ path: envPath });
  if (dotenvResult.error) {
    console.warn('Warning: Could not load .env file from', envPath);
    console.warn('  Error:', dotenvResult.error.message);
  }
}

// 環境セットアップを実行
setupEnvFile();

const PORT = process.env.PORT || '3000';
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

/**
 * Prismaクライアントが生成されているか確認
 */
function checkPrismaClient(): boolean {
  const prismaClientPath = path.join(projectRoot, 'node_modules', '.prisma', 'client');
  return fs.existsSync(prismaClientPath);
}

/**
 * Prismaクライアントを生成
 */
function generatePrismaClient(): boolean {
  console.log('Generating Prisma client...');

  const result = spawnSync(npxCmd, ['prisma', 'generate'], {
    cwd: projectRoot,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    console.error('Failed to generate Prisma client');
    return false;
  }

  console.log('Prisma client generated successfully.');
  return true;
}

/**
 * データベースファイルが存在するか確認
 */
function checkDatabase(): boolean {
  const dbPath = path.join(projectRoot, 'data', 'claudework.db');
  return fs.existsSync(dbPath);
}

/**
 * データベースディレクトリを作成し、スキーマをプッシュ
 */
function setupDatabase(): boolean {
  console.log('Setting up database...');

  // データベースディレクトリを作成
  const dataDir = path.join(projectRoot, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // prisma db push でスキーマを適用
  const result = spawnSync(npxCmd, ['prisma', 'db', 'push', '--skip-generate'], {
    cwd: projectRoot,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    console.error('Failed to setup database');
    return false;
  }

  console.log('Database setup completed.');
  return true;
}

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

  const result = spawnSync(npmCmd, ['run', 'build:next'], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' },
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

  // サーバーをspawn（本番モードで実行、プロジェクトルートをcwdに設定）
  const server = spawn('node', [serverPath], {
    stdio: 'inherit',
    cwd: projectRoot,
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
  console.log('ClaudeWork - Starting up...\n');

  // 1. Prismaクライアントの確認・生成
  if (!checkPrismaClient()) {
    console.log('Prisma client not found. Generating...');
    if (!generatePrismaClient()) {
      process.exit(1);
    }
  }

  // 2. データベースの確認・セットアップ
  if (!checkDatabase()) {
    console.log('Database not found. Setting up...');
    if (!setupDatabase()) {
      process.exit(1);
    }
  }

  // 3. Next.jsビルドの確認・実行
  if (!checkNextBuild()) {
    console.log('No production build found. Building...');
    if (!buildNext()) {
      process.exit(1);
    }
  }

  console.log(''); // 空行

  // サーバー起動
  startServer();
}

main();
