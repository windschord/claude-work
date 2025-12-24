#!/usr/bin/env ts-node
/**
 * 統合テスト: 実際のClaude Codeプロセスでの動作確認
 *
 * このスクリプトは、サーバー起動を支援し、手動統合テストの実行をガイドします。
 *
 * 使用方法:
 *   npm run integration-test
 *
 * 環境変数:
 *   CLAUDE_WORK_TOKEN: 認証トークン（デフォルト: test-token）
 *   SESSION_SECRET: セッション秘密鍵（デフォルト: test-session-secret-32-characters-long）
 *   PORT: サーバーポート（デフォルト: 3000）
 */

import { spawn, ChildProcess } from 'child_process';
import * as readline from 'readline';

// 環境変数のデフォルト値
const DEFAULT_TOKEN = 'test-token';
const DEFAULT_SESSION_SECRET = 'test-session-secret-32-characters-long';
const DEFAULT_PORT = '3000';

// 色付きコンソール出力
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log();
  log(`${'='.repeat(60)}`, 'cyan');
  log(`  ${title}`, 'bright');
  log(`${'='.repeat(60)}`, 'cyan');
  console.log();
}

function logStep(step: number, message: string) {
  log(`${step}. ${message}`, 'blue');
}

function logSuccess(message: string) {
  log(`✓ ${message}`, 'green');
}

function logError(message: string) {
  log(`✗ ${message}`, 'red');
}

function logWarning(message: string) {
  log(`⚠ ${message}`, 'yellow');
}

// サーバープロセスを管理する変数
let serverProcess: ChildProcess | null = null;

// シグナルハンドラーの設定
function setupCleanup() {
  const cleanup = () => {
    if (serverProcess) {
      log('\nサーバーを停止しています...', 'yellow');
      serverProcess.kill('SIGTERM');
      serverProcess = null;
    }
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

// サーバーを起動する関数
async function startServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    const token = process.env.CLAUDE_WORK_TOKEN || DEFAULT_TOKEN;
    const sessionSecret = process.env.SESSION_SECRET || DEFAULT_SESSION_SECRET;
    const port = process.env.PORT || DEFAULT_PORT;

    log(`環境変数:`, 'cyan');
    log(`  CLAUDE_WORK_TOKEN: ${token}`);
    log(`  SESSION_SECRET: ${sessionSecret.substring(0, 10)}...`);
    log(`  PORT: ${port}`);
    console.log();

    log('開発サーバーを起動しています...', 'yellow');

    serverProcess = spawn('npm', ['run', 'dev'], {
      env: {
        ...process.env,
        CLAUDE_WORK_TOKEN: token,
        SESSION_SECRET: sessionSecret,
        PORT: port,
      },
      stdio: 'pipe',
    });

    let startupTimeout: NodeJS.Timeout;

    serverProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      process.stdout.write(output);

      // サーバーが起動したことを検知
      if (output.includes('Ready') || output.includes('started server') || output.includes('Local:')) {
        clearTimeout(startupTimeout);
        logSuccess('サーバーが起動しました');
        console.log();
        resolve();
      }
    });

    serverProcess.stderr?.on('data', (data) => {
      process.stderr.write(data);
    });

    serverProcess.on('error', (error) => {
      logError(`サーバー起動エラー: ${error.message}`);
      reject(error);
    });

    serverProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        logError(`サーバーが異常終了しました (コード: ${code})`);
      }
      serverProcess = null;
    });

    // 30秒後にタイムアウト
    startupTimeout = setTimeout(() => {
      logWarning('サーバーの起動に時間がかかっています...');
      logWarning('手動でブラウザを開いて確認してください');
      resolve();
    }, 30000);
  });
}

// テストチェックリストを表示する関数
function displayTestChecklist() {
  logSection('統合テスト チェックリスト');

  log('以下の項目を手動でテストしてください:', 'bright');
  console.log();

  logStep(1, 'ログインテスト');
  log('   - ブラウザで http://localhost:3000 にアクセス');
  log('   - 認証トークン (test-token) でログイン');
  log('   - ダッシュボードが表示されることを確認');
  console.log();

  logStep(2, 'プロジェクト登録テスト');
  log('   - プロジェクト追加ボタンをクリック');
  log('   - テスト用のGitリポジトリパスを入力');
  log('   - プロジェクトが正常に登録されることを確認');
  console.log();

  logStep(3, 'セッション作成テスト');
  log('   - プロジェクトを開く');
  log('   - セッション作成フォームにプロンプトを入力');
  log('   - セッションが作成され、Claude Codeプロセスが起動することを確認');
  log('   - WebSocket接続が確立されることを確認 (DevToolsのNetworkタブで確認)');
  console.log();

  logStep(4, 'プロンプト送信テスト');
  log('   - セッション詳細ページでプロンプトを送信');
  log('   - Claude Codeからの応答がリアルタイムで表示されることを確認');
  log('   - マークダウンレンダリングとシンタックスハイライトを確認');
  log('   - ツール呼び出し（Read、Write、Bashなど）が表示されることを確認');
  console.log();

  logStep(5, 'Git操作テスト');
  log('   - Diffタブで変更差分が表示されることを確認');
  log('   - Commitsタブでコミット履歴が表示されることを確認');
  log('   - Rebase操作が正常に動作することを確認');
  log('   - Merge操作が正常に動作することを確認');
  console.log();

  logStep(6, 'ターミナルテスト');
  log('   - ターミナルタブを開く');
  log('   - コマンドを入力して実行 (例: ls, pwd, echo "test")');
  log('   - 出力がリアルタイムで表示されることを確認');
  log('   - Ctrl+Cでプロセスを中断できることを確認');
  console.log();

  logStep(7, 'エラーハンドリングテスト');
  log('   - 存在しないセッションにアクセス (404エラー)');
  log('   - 無効なプロンプトを送信 (エラーメッセージ)');
  log('   - ネットワーク切断時の挙動 (WebSocket再接続)');
  console.log();

  logStep(8, 'パフォーマンステスト');
  log('   - 大きなプロンプトを送信');
  log('   - 複数のファイルを同時に編集');
  log('   - 長時間のセッション利用');
  console.log();

  log('\nテスト結果は docs/integration-test-report.md に記録してください', 'bright');
  console.log();
}

// インタラクティブメニューを表示する関数
async function showMenu(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    console.log();
    log('--- メニュー ---', 'cyan');
    log('[1] テストチェックリストを再表示');
    log('[2] ブラウザを開く (macOS)');
    log('[3] サーバーログを表示');
    log('[4] テストレポートを開く');
    log('[q] 終了');
    console.log();

    rl.question('選択してください: ', (answer) => {
      rl.close();

      switch (answer.trim()) {
        case '1':
          displayTestChecklist();
          resolve();
          break;
        case '2':
          spawn('open', ['http://localhost:3000'], { stdio: 'inherit' });
          logSuccess('ブラウザを開きました');
          resolve();
          break;
        case '3':
          log('\nサーバーログは上記に表示されています', 'yellow');
          log('リアルタイムでログが流れます\n', 'yellow');
          resolve();
          break;
        case '4':
          spawn('open', ['docs/integration-test-report.md'], { stdio: 'inherit' });
          logSuccess('テストレポートを開きました');
          resolve();
          break;
        case 'q':
        case 'Q':
          log('\n統合テストを終了します', 'yellow');
          process.exit(0);
          break;
        default:
          logWarning('無効な選択です');
          resolve();
      }
    });
  });
}

// メインループ
async function interactiveLoop() {
  while (true) {
    await showMenu();
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

// メイン関数
async function main() {
  try {
    logSection('Claude Work 統合テスト');

    log('このスクリプトは手動統合テストの実行を支援します', 'bright');
    log('開発サーバーを起動し、テストチェックリストを表示します', 'bright');
    console.log();

    setupCleanup();

    // サーバーを起動
    await startServer();

    // テストチェックリストを表示
    displayTestChecklist();

    // インタラクティブメニュー
    await interactiveLoop();
  } catch (error) {
    logError(`エラーが発生しました: ${error}`);
    process.exit(1);
  }
}

// スクリプト実行
main();
