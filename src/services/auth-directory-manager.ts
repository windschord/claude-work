import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '@/lib/logger';
import { getEnvironmentsDir } from '@/lib/data-dir';

/**
 * 環境IDの正規表現パターン
 * パストラバーサル攻撃を防止するため、英数字、ハイフン、アンダースコアのみを許可
 */
const VALID_ENVIRONMENT_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * 認証ディレクトリマネージャー
 * Docker環境専用の認証情報ディレクトリを管理
 */
export class AuthDirectoryManager {
  private baseDir: string;

  constructor(baseDir?: string) {
    // デフォルト: getEnvironmentsDir()で解決（DATA_DIR設定時は ${DATA_DIR}/environments）
    this.baseDir = baseDir || getEnvironmentsDir();
  }

  /**
   * 環境IDのバリデーション
   *
   * パストラバーサル攻撃を防ぐため、環境IDを検証します。
   *
   * @param environmentId - 検証する環境ID
   * @throws 不正な文字が含まれる場合にエラーをスロー
   */
  private validateEnvironmentId(environmentId: string): void {
    // 空文字を拒否
    if (!environmentId || environmentId.trim() === '') {
      throw new Error('Invalid environment ID: empty string is not allowed.');
    }

    // ドットのみを拒否
    if (environmentId === '.' || environmentId === '..') {
      throw new Error(
        `Invalid environment ID: "${environmentId}". Relative path notation is not allowed.`
      );
    }

    // パストラバーサル攻撃を防止
    if (environmentId.includes('..')) {
      throw new Error(
        `Invalid environment ID: "${environmentId}". Double dots (..) are not allowed.`
      );
    }

    // スラッシュを拒否
    if (environmentId.includes('/') || environmentId.includes('\\')) {
      throw new Error(
        `Invalid environment ID: "${environmentId}". Path separators are not allowed.`
      );
    }

    // 許可された文字のみを受け入れる
    if (!VALID_ENVIRONMENT_ID_PATTERN.test(environmentId)) {
      throw new Error(
        `Invalid environment ID: "${environmentId}". Only alphanumeric characters, hyphens, and underscores are allowed.`
      );
    }
  }

  /**
   * 環境IDから認証ディレクトリのパスを取得
   */
  getAuthDirPath(environmentId: string): string {
    this.validateEnvironmentId(environmentId);
    return path.join(this.baseDir, environmentId);
  }

  /**
   * 認証ディレクトリを作成
   * @returns 作成したディレクトリのパス
   */
  async createAuthDirectory(environmentId: string): Promise<string> {
    this.validateEnvironmentId(environmentId);
    const envDir = path.join(this.baseDir, environmentId);

    // サブディレクトリを作成
    const claudeDir = path.join(envDir, 'claude');
    const configClaudeDir = path.join(envDir, 'config', 'claude');

    await fs.mkdir(claudeDir, { recursive: true, mode: 0o700 });
    await fs.mkdir(configClaudeDir, { recursive: true, mode: 0o700 });

    logger.info('Created auth directory for environment', {
      environmentId,
      path: envDir,
    });

    return envDir;
  }

  /**
   * 認証ディレクトリを削除
   */
  async deleteAuthDirectory(environmentId: string): Promise<void> {
    this.validateEnvironmentId(environmentId);
    const envDir = path.join(this.baseDir, environmentId);

    try {
      await fs.rm(envDir, { recursive: true, force: true });
      logger.info('Deleted auth directory for environment', {
        environmentId,
        path: envDir,
      });
    } catch (error) {
      logger.warn('Failed to delete auth directory', {
        environmentId,
        path: envDir,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * 認証ディレクトリが存在するか確認
   */
  async exists(environmentId: string): Promise<boolean> {
    this.validateEnvironmentId(environmentId);
    const envDir = path.join(this.baseDir, environmentId);
    try {
      await fs.access(envDir);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 認証済みかどうかを確認
   * Claude認証情報ファイルの存在をチェック
   */
  async isAuthenticated(environmentId: string): Promise<boolean> {
    this.validateEnvironmentId(environmentId);
    const credentialsPath = path.join(
      this.baseDir,
      environmentId,
      'claude',
      '.credentials.json'
    );
    try {
      await fs.access(credentialsPath);
      return true;
    } catch {
      return false;
    }
  }
}

// シングルトンインスタンス
export const authDirectoryManager = new AuthDirectoryManager();
