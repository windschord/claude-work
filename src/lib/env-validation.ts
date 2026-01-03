/**
 * 必須環境変数のバリデーション
 *
 * サーバー起動時に必須の環境変数が設定されているか確認します。
 * 未設定の場合は詳細なエラーメッセージを表示します。
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';

/**
 * 環境変数のバリデーションエラー情報
 */
export interface EnvValidationError {
  /** エラーが発生した環境変数名 */
  variable: string;
  /** エラーメッセージの詳細 */
  message: string;
}

/**
 * 必須環境変数の存在と有効性を検証します
 *
 * 以下の環境変数をチェックします：
 * - DATABASE_URL: データベース接続URL
 *
 * @throws {Error} 必須環境変数が未設定または無効な場合、詳細なエラーメッセージとセットアップ手順を含むエラーをスロー
 */
export function validateRequiredEnvVars(): void {
  const errors: EnvValidationError[] = [];

  // DATABASE_URLのチェック
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === '') {
    errors.push({
      variable: 'DATABASE_URL',
      message: 'DATABASE_URL environment variable is not set. This is required for database connection.',
    });
  }

  // エラーがある場合は詳細なメッセージを表示
  if (errors.length > 0) {
    const errorMessages = errors.map(e => `  - ${e.variable}: ${e.message}`).join('\n');

    throw new Error(
      `Missing required environment variables:\n\n${errorMessages}\n\n` +
      'Please follow these steps:\n' +
      '1. Copy .env.example to .env:\n' +
      '   cp .env.example .env\n\n' +
      '2. Edit .env and set the required variables:\n' +
      '   - DATABASE_URL: Database connection URL (e.g., file:../data/claudework.db)\n\n' +
      'For more details, see README.md and docs/ENV_VARS.md'
    );
  }
}

/**
 * Claude Code CLIのパスを検出します
 *
 * 以下の優先順位でパスを検出します：
 * 1. CLAUDE_CODE_PATH環境変数が設定されている場合はそのパスを使用
 * 2. PATH環境変数からwhichコマンドで自動検出
 *
 * @returns Claude Code CLIの絶対パス
 * @throws {Error} Windows環境、パスが存在しない、またはCLIが見つからない場合
 */
export function detectClaudePath(): string {
  // Windows環境チェック
  if (process.platform === 'win32') {
    throw new Error('Windows is not supported. Please use macOS or Linux.');
  }

  // CLAUDE_CODE_PATHが設定済みの場合
  const envPath = process.env.CLAUDE_CODE_PATH;
  if (envPath) {
    if (!existsSync(envPath)) {
      throw new Error(`CLAUDE_CODE_PATH is set but the path does not exist: ${envPath}`);
    }
    return envPath;
  }

  // PATH環境変数から自動検出
  try {
    const path = execSync('which claude', {
      encoding: 'utf-8',
      timeout: 5000, // 5秒のタイムアウト
    }).trim();
    if (!path) {
      throw new Error('claude command not found');
    }
    return path;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      `claude command not found in PATH. ${errorMessage}\nPlease install Claude Code CLI or set CLAUDE_CODE_PATH environment variable.`
    );
  }
}
