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
 * ディレクトリ内のすべてのJSファイルを再帰的に取得
 */
function getJsFiles(dir: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getJsFiles(fullPath));
    } else if (entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * ファイル内の絶対パスを修正
 * ビルド時のパスを実行時のプロジェクトルートに置換
 */
function fixPathsInFile(filePath: string, buildRoot: string, targetRoot: string): boolean {
  let content = fs.readFileSync(filePath, 'utf-8');
  const originalContent = content;

  // ビルド時のプロジェクトルートへの絶対パスを現在のプロジェクトルートに置換
  const escapedBuildRoot = buildRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`"${escapedBuildRoot}/`, 'g');
  content = content.replace(regex, `"${targetRoot}/`);

  // シングルクォートのパターンも置換
  const regexSingle = new RegExp(`'${escapedBuildRoot}/`, 'g');
  content = content.replace(regexSingle, `'${targetRoot}/`);

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    return true;
  }
  return false;
}

/**
 * Next.jsビルド出力内の絶対パスを修正
 * npx経由でインストールされた場合、ビルド時の一時ディレクトリへのパスが
 * 埋め込まれているため、現在のプロジェクトルートに修正する
 */
function fixNextJsBuildPaths(): void {
  const requiredServerFilesPath = path.join(projectRoot, '.next', 'required-server-files.json');
  if (!fs.existsSync(requiredServerFilesPath)) {
    return;
  }

  let buildRoot: string;
  try {
    const content = fs.readFileSync(requiredServerFilesPath, 'utf-8');
    const data = JSON.parse(content);
    buildRoot = data.appDir;
    if (!buildRoot) {
      return;
    }
  } catch {
    return;
  }

  // ビルドルートが現在のプロジェクトルートと同じ場合はスキップ
  if (buildRoot === projectRoot) {
    return;
  }

  console.log('Fixing Next.js build paths for current environment...');

  // .next/server内のJSファイルを修正
  const nextServerDir = path.join(projectRoot, '.next', 'server');
  const jsFiles = getJsFiles(nextServerDir);
  let fixedCount = 0;

  for (const file of jsFiles) {
    if (fixPathsInFile(file, buildRoot, projectRoot)) {
      fixedCount++;
    }
  }

  if (fixedCount > 0) {
    console.log(`  Fixed paths in ${fixedCount} files.`);
  }

  // required-server-files.jsonも修正
  try {
    const content = fs.readFileSync(requiredServerFilesPath, 'utf-8');
    const data = JSON.parse(content);

    data.appDir = projectRoot;
    if (data.config?.outputFileTracingRoot) {
      data.config.outputFileTracingRoot = projectRoot;
    }
    if (data.config?.turbopack?.root) {
      data.config.turbopack.root = projectRoot;
    }

    fs.writeFileSync(requiredServerFilesPath, JSON.stringify(data, null, 2));
    console.log('  Updated required-server-files.json');
  } catch {
    // エラーは無視
  }
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

  // 4. Next.jsビルドパスの修正（npx環境対応）
  fixNextJsBuildPaths();

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
