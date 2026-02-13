import fs from 'fs/promises';
import path from 'path';
import { logger } from '@/lib/logger';

/**
 * 設定ファイルの型定義
 */
export interface AppConfig {
  git_clone_timeout_minutes?: number;
  debug_mode_keep_volumes?: boolean;
}

/**
 * デフォルト設定
 */
const DEFAULT_CONFIG: Required<AppConfig> = {
  git_clone_timeout_minutes: 5,
  debug_mode_keep_volumes: false,
};

/**
 * ConfigService
 * アプリケーション設定の管理
 */
export class ConfigService {
  private config: Required<AppConfig>;
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || path.join(process.cwd(), 'data', 'settings.json');
    this.config = { ...DEFAULT_CONFIG };
  }

  /**
   * 設定ファイルを読み込む
   */
  async load(): Promise<void> {
    try {
      const fileContent = await fs.readFile(this.configPath, 'utf-8');
      const loadedConfig = JSON.parse(fileContent) as AppConfig;

      // デフォルト値とマージ
      this.config = {
        git_clone_timeout_minutes: loadedConfig.git_clone_timeout_minutes ?? DEFAULT_CONFIG.git_clone_timeout_minutes,
        debug_mode_keep_volumes: loadedConfig.debug_mode_keep_volumes ?? DEFAULT_CONFIG.debug_mode_keep_volumes,
      };

      logger.info('Configuration loaded', { config: this.config });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.info('Configuration file not found, using defaults', { configPath: this.configPath });
        this.config = { ...DEFAULT_CONFIG };
      } else {
        logger.error('Failed to load configuration, using defaults', { error });
        this.config = { ...DEFAULT_CONFIG };
      }
    }
  }

  /**
   * 設定ファイルを保存する
   */
  async save(config: Partial<AppConfig>): Promise<void> {
    try {
      // 既存の設定とマージ
      this.config = {
        ...this.config,
        ...config,
      };

      // ディレクトリが存在しない場合は作成
      await fs.mkdir(path.dirname(this.configPath), { recursive: true });

      // 設定ファイルに書き込み
      await fs.writeFile(
        this.configPath,
        JSON.stringify(this.config, null, 2),
        'utf-8'
      );

      logger.info('Configuration saved', { config: this.config });
    } catch (error) {
      logger.error('Failed to save configuration', { error });
      throw new Error('Failed to save configuration');
    }
  }

  /**
   * git cloneのタイムアウト値（分）を取得
   */
  getGitCloneTimeoutMinutes(): number {
    return this.config.git_clone_timeout_minutes;
  }

  /**
   * git cloneのタイムアウト値（ミリ秒）を取得
   */
  getGitCloneTimeoutMs(): number {
    return this.config.git_clone_timeout_minutes * 60 * 1000;
  }

  /**
   * デバッグモードでDockerボリュームを保持するかどうか
   */
  getDebugModeKeepVolumes(): boolean {
    return this.config.debug_mode_keep_volumes;
  }

  /**
   * 設定全体を取得
   */
  getConfig(): Required<AppConfig> {
    return { ...this.config };
  }
}

/**
 * シングルトンインスタンス
 */
let configServiceInstance: ConfigService | null = null;

/**
 * ConfigServiceのシングルトンインスタンスを取得
 */
export function getConfigService(): ConfigService {
  if (!configServiceInstance) {
    configServiceInstance = new ConfigService();
  }
  return configServiceInstance;
}

/**
 * ConfigServiceを初期化（設定ファイルを読み込む）
 */
export async function initializeConfigService(): Promise<ConfigService> {
  const service = getConfigService();
  await service.load();
  return service;
}
