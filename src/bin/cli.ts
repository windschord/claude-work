#!/usr/bin/env node

/**
 * ClaudeWork CLI エントリーポイント
 *
 * コマンド:
 *   npx claude-work         フォアグラウンドで起動
 *   npx claude-work start   バックグラウンドで起動（pm2経由）
 *   npx claude-work stop    停止
 *   npx claude-work status  状態確認
 *   npx claude-work logs    ログ表示
 *   npx claude-work help    ヘルプ表示
 *
 * 自動セットアップ:
 * - .envファイルがない場合: .env.exampleからコピー
 * - データベースがない場合: 自動作成
 * - .nextディレクトリがない場合: 自動ビルド
 */

import { spawn, spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import {
  checkNextBuild as checkNextBuildUtil,
  checkDrizzle as checkDrizzleUtil,
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

// ローカルバイナリのパス（npx ではなく node_modules/.bin を直接参照）
// これにより、グローバルバージョンではなくロックされたバージョンが使用される
const binDir = path.join(projectRoot, 'node_modules', '.bin');
const drizzleKitCmd = path.join(binDir, process.platform === 'win32' ? 'drizzle-kit.cmd' : 'drizzle-kit');
const pm2Cmd = path.join(binDir, process.platform === 'win32' ? 'pm2.cmd' : 'pm2');

const PM2_APP_NAME = 'claude-work';

/**
 * ヘルプメッセージを表示
 */
function showHelp(): void {
  console.log(`
ClaudeWork - Claude Code セッション管理ツール

使い方:
  npx claude-work [command]

コマンド:
  (なし)    フォアグラウンドで起動（Ctrl+C で停止）
  start     バックグラウンドで起動（pm2経由）
  stop      バックグラウンドプロセスを停止
  restart   バックグラウンドプロセスを再起動
  status    プロセスの状態を表示
  logs      ログを表示（Ctrl+C で終了）
  help      このヘルプを表示

例:
  npx claude-work          # フォアグラウンドで起動
  npx claude-work start    # バックグラウンドで起動
  npx claude-work stop     # 停止
  npx claude-work logs     # ログを確認
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

/**
 * Drizzle ORMがインストールされているか確認
 */
function checkDrizzle(): boolean {
  return checkDrizzleUtil(projectRoot);
}

/**
 * データベースファイルが存在するか確認
 */
function checkDatabase(): boolean {
  return checkDatabaseUtil(projectRoot);
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

  // drizzle-kit push でスキーマを適用
  const result = spawnSync(drizzleKitCmd, ['push'], {
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
 * BUILD_ID、static、serverディレクトリの存在を検証
 */
function checkNextBuild(): boolean {
  return checkNextBuildUtil(projectRoot);
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
  // 1. Drizzle ORMの確認
  if (!checkDrizzle()) {
    console.error('Drizzle ORM not found. Please run npm install first.');
    return false;
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

/**
 * pm2でバックグラウンド起動
 */
function startDaemon(): void {
  const PORT = process.env.PORT || '3000';
  console.log(`Starting ClaudeWork daemon on port ${PORT}...`);

  const ecosystemPath = path.join(projectRoot, 'ecosystem.config.js');

  const result = spawnSync(pm2Cmd, ['start', ecosystemPath, '--only', PM2_APP_NAME], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production', PORT },
  });

  if (result.status !== 0) {
    console.error('Failed to start daemon');
    process.exit(1);
  }

  console.log(`\nClaudeWork is running at http://localhost:${PORT}`);
  console.log('Use "npx claude-work stop" to stop the server.');
  console.log('Use "npx claude-work logs" to view logs.');
}

/**
 * pm2プロセスを停止
 */
function stopDaemon(): void {
  console.log('Stopping ClaudeWork daemon...');

  const result = spawnSync(pm2Cmd, ['stop', PM2_APP_NAME], {
    cwd: projectRoot,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    console.error('Failed to stop daemon (it may not be running)');
    process.exit(1);
  }

  console.log('ClaudeWork daemon stopped.');
}

/**
 * pm2プロセスを再起動
 */
function restartDaemon(): void {
  console.log('Restarting ClaudeWork daemon...');

  const ecosystemPath = path.join(projectRoot, 'ecosystem.config.js');

  const result = spawnSync(pm2Cmd, ['restart', ecosystemPath, '--only', PM2_APP_NAME], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' },
  });

  if (result.status !== 0) {
    console.error('Failed to restart daemon');
    process.exit(1);
  }

  console.log('ClaudeWork daemon restarted.');
}

/**
 * pm2プロセスの状態を表示
 */
function showStatus(): void {
  spawnSync(pm2Cmd, ['status'], {
    cwd: projectRoot,
    stdio: 'inherit',
  });
}

/**
 * pm2ログを表示
 */
function showLogs(): void {
  console.log('Showing logs (Ctrl+C to exit)...\n');

  const logs = spawn(pm2Cmd, ['logs', PM2_APP_NAME, '--lines', '50'], {
    cwd: projectRoot,
    stdio: 'inherit',
  });

  logs.on('exit', (code) => {
    process.exit(code || 0);
  });
}

// メイン処理
function main(): void {
  // help コマンドは環境セットアップ不要
  if (command === 'help' || command === '-h' || command === '--help') {
    showHelp();
    return;
  }

  // status と logs は環境セットアップ不要
  if (command === 'status') {
    showStatus();
    return;
  }

  if (command === 'logs') {
    showLogs();
    return;
  }

  // stop は環境セットアップ不要
  if (command === 'stop') {
    stopDaemon();
    return;
  }

  // 以下のコマンドは環境セットアップが必要
  console.log('ClaudeWork - Starting up...\n');

  // 環境セットアップ
  setupEnvFile();

  // 初期セットアップを実行
  if (!runSetup()) {
    process.exit(1);
  }

  console.log(''); // 空行

  // コマンドに応じて処理を分岐
  switch (command) {
    case 'start':
      startDaemon();
      break;
    case 'restart':
      restartDaemon();
      break;
    case '':
      // 引数なしの場合はフォアグラウンドで起動
      startForeground();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      showHelp();
      process.exit(1);
  }
}

main();
