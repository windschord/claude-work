/**
 * 必須環境変数のバリデーション
 *
 * サーバー起動時に必須の環境変数が設定されているか確認します。
 * 未設定の場合は詳細なエラーメッセージを表示します。
 */

interface EnvValidationError {
  variable: string;
  message: string;
}

export function validateRequiredEnvVars(): void {
  const errors: EnvValidationError[] = [];

  // CLAUDE_WORK_TOKENのチェック
  if (!process.env.CLAUDE_WORK_TOKEN || process.env.CLAUDE_WORK_TOKEN.trim() === '') {
    errors.push({
      variable: 'CLAUDE_WORK_TOKEN',
      message: 'CLAUDE_WORK_TOKEN environment variable is not set. This is required for authentication.',
    });
  }

  // SESSION_SECRETのチェック
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.trim() === '') {
    errors.push({
      variable: 'SESSION_SECRET',
      message: 'SESSION_SECRET environment variable is not set. This is required for session management.',
    });
  } else if (process.env.SESSION_SECRET.length < 32) {
    errors.push({
      variable: 'SESSION_SECRET',
      message: 'SESSION_SECRET must be at least 32 characters long for security.',
    });
  }

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
      '   - CLAUDE_WORK_TOKEN: A secure random token for authentication\n' +
      '   - SESSION_SECRET: A 32+ character secret for session encryption\n' +
      '   - DATABASE_URL: Database connection URL (e.g., file:./prisma/data/claudework.db)\n\n' +
      'For more details, see README.md and docs/ENV_VARS.md'
    );
  }
}
