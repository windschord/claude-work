#!/usr/bin/env node

/**
 * ClaudeWork CLI エントリーポイント
 *
 * コマンド:
 *   npx github:windschord/claude-work       フォアグラウンドで起動
 *   npx github:windschord/claude-work help  ヘルプ表示
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
import {
  checkNextBuild as checkNextBuildUtil,
  checkPrismaClient as checkPrismaClientUtil,
  checkDatabase as checkDatabaseUtil,
} from './cli-utils';

// CommonJSビルド時は__dirnameが利用可能
const currentDir = __dirname;

// プロジェクトルートを解決（dist/src/bin/ から3階層上）
const projectRoot = path.resolve(currentDir, '..', '..', '..');

// コマンドライン引数を取得
const args = process.argv.slice(2);
const command = args[0] || '';

// プラットフォーム固有のコマンド
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

/**
 * ヘルプメッセージを表示
 */
function showHelp(): void {
  console.log(`
ClaudeWork - Claude Code セッション管理ツール

使い方:
  npx github:windschord/claude-work [command]

コマンド:
  (なし)    サーバーを起動（Ctrl+C で停止）
  help      このヘルプを表示

初回起動時は自動的に以下をセットアップします:
  - Prismaクライアントの生成
  - データベースの作成
  - Next.jsのビルド
`);
}

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
      console.log('  Created .env file.');
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

/**
 * Prismaクライアントが生成されているか確認
 */
function checkPrismaClient(): boolean {
  return checkPrismaClientUtil(projectRoot);
}

/**
 * Prismaバイナリのパスを取得
 * 通常インストール: projectRoot/node_modules/.bin/prisma
 * npxインストール: projectRoot/../.bin/prisma（依存関係がホイスティングされる）
 */
function getPrismaPath(): string {
  // 通常のnode_modules内のパス
  const localPrismaPath = path.join(projectRoot, 'node_modules', '.bin', 'prisma');
  if (fs.existsSync(localPrismaPath)) {
    return localPrismaPath;
  }

  // npxインストール時のホイスティングされたパス
  const hoistedPrismaPath = path.join(projectRoot, '..', '.bin', 'prisma');
  if (fs.existsSync(hoistedPrismaPath)) {
    return hoistedPrismaPath;
  }

  // フォールバック: ローカルパスを返す（エラーメッセージ用）
  return localPrismaPath;
}

/**
 * Prismaクライアントを生成
 * ローカルのnode_modules内のPrismaを使用（バージョン互換性のため）
 */
function generatePrismaClient(): boolean {
  console.log('Generating Prisma client...');

  const prismaPath = getPrismaPath();
  const result = spawnSync(prismaPath, ['generate'], {
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
  return checkDatabaseUtil(projectRoot);
}

/**
 * データベースディレクトリを作成し、スキーマをプッシュ
 * ローカルのnode_modules内のPrismaを使用（バージョン互換性のため）
 */
function setupDatabase(): boolean {
  console.log('Setting up database...');

  // データベースディレクトリを作成
  const dataDir = path.join(projectRoot, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const prismaPath = getPrismaPath();
  const result = spawnSync(prismaPath, ['db', 'push', '--skip-generate'], {
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
 * Next.jsビルドが存在し、完全かどうかを確認
 */
function checkNextBuild(): boolean {
  return checkNextBuildUtil(projectRoot);
}

/**
 * npx環境かどうかを判定し、ホイスティングされたnode_modulesのパスを返す
 *
 * npxでインストールされた場合、パッケージは以下の構造で配置される:
 *   _npx/xxx/node_modules/           <- ホイスティングされた依存関係（親ディレクトリ自体）
 *   _npx/xxx/node_modules/claude-work <- projectRoot
 *
 * @returns ホイスティングされたnode_modulesのパス、または通常環境ならnull
 */
function getHoistedNodeModulesPath(): string | null {
  const localNodeModules = path.join(projectRoot, 'node_modules');
  const parentDir = path.join(projectRoot, '..');
  const parentDirName = path.basename(parentDir);

  // ローカルのnode_modulesが存在する場合は通常環境
  if (fs.existsSync(localNodeModules)) {
    return null;
  }

  // 親ディレクトリがnode_modulesの場合（npx環境）
  if (parentDirName === 'node_modules' && fs.existsSync(parentDir)) {
    return parentDir;
  }

  return null;
}

/**
 * npx環境でnode_modulesシンボリックリンクを作成
 */
function ensureNodeModulesLink(hoistedPath: string): void {
  const localNodeModules = path.join(projectRoot, 'node_modules');

  if (fs.existsSync(localNodeModules)) {
    return;
  }

  try {
    fs.symlinkSync(hoistedPath, localNodeModules, 'junction');
    console.log('Created node_modules symlink for npx compatibility');
  } catch (error) {
    console.warn('Warning: Failed to create node_modules symlink:', error);
  }
}

/**
 * nextバイナリのパスを取得
 */
function getNextPath(): string {
  // 通常のnode_modules内のパス
  const localNextPath = path.join(projectRoot, 'node_modules', '.bin', 'next');
  if (fs.existsSync(localNextPath)) {
    return localNextPath;
  }

  // npxインストール時のホイスティングされたパス
  const hoistedNextPath = path.join(projectRoot, '..', '.bin', 'next');
  if (fs.existsSync(hoistedNextPath)) {
    return hoistedNextPath;
  }

  // フォールバック
  return localNextPath;
}

/**
 * Next.jsをビルド
 */
function buildNext(): boolean {
  console.log('Building Next.js application...');
  console.log(`  Project root: ${projectRoot}`);

  const hoistedPath = getHoistedNodeModulesPath();
  const buildEnv: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: 'production',
  };

  // npx環境の場合、シンボリックリンクを作成しNODE_PATHも設定
  if (hoistedPath) {
    console.log('Detected npx environment, configuring for hoisted dependencies');
    ensureNodeModulesLink(hoistedPath);
    buildEnv.NODE_PATH = hoistedPath;
  }

  // nextを直接実行（npm runを経由するとcwdが変わる可能性があるため）
  const nextPath = getNextPath();
  console.log(`  Using next at: ${nextPath}`);

  const result = spawnSync(nextPath, ['build'], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: buildEnv,
  });

  if (result.status !== 0) {
    console.error('Failed to build Next.js application');
    return false;
  }

  console.log('Build completed successfully.');
  return true;
}

/**
 * 初期セットアップを実行
 */
function runSetup(): boolean {
  // 1. Prismaクライアントの確認・生成
  if (!checkPrismaClient()) {
    console.log('Prisma client not found. Generating...');
    if (!generatePrismaClient()) {
      return false;
    }
  }

  // 2. データベースの確認・セットアップ
  if (!checkDatabase()) {
    console.log('Database not found. Setting up...');
    if (!setupDatabase()) {
      return false;
    }
  }

  // 3. Next.jsビルドの確認・実行
  if (!checkNextBuild()) {
    console.log('No production build found. Building...');
    if (!buildNext()) {
      return false;
    }
  }

  return true;
}

/**
 * フォアグラウンドでサーバーを起動
 */
function startForeground(): void {
  const PORT = process.env.PORT || '3000';
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
  // help コマンドは環境セットアップ不要
  if (command === 'help' || command === '-h' || command === '--help') {
    showHelp();
    return;
  }

  // 不正なコマンドのチェック
  if (command !== '') {
    console.error(`Unknown command: ${command}`);
    showHelp();
    process.exit(1);
  }

  // 起動処理
  console.log('ClaudeWork - Starting up...\n');

  // 環境セットアップ
  setupEnvFile();

  // 初期セットアップを実行
  if (!runSetup()) {
    process.exit(1);
  }

  console.log(''); // 空行

  // フォアグラウンドで起動
  startForeground();
}

main();
