import fs from 'fs/promises';
import path from 'path';
import { logger } from '@/lib/logger';

/**
 * Claude Codeのデフォルト設定
 */
export interface ClaudeDefaults {
  dangerouslySkipPermissions?: boolean;
  worktree?: boolean;
}

/**
 * 設定ファイルの型定義
 */
export interface AppConfig {
  git_clone_timeout_minutes?: number;
  debug_mode_keep_volumes?: boolean;
  registry_firewall_enabled?: boolean;
  claude_defaults?: ClaudeDefaults;
}

/**
 * デフォルト設定
 */
const DEFAULT_CLAUDE_DEFAULTS: Required<ClaudeDefaults> = {
  dangerouslySkipPermissions: false,
  worktree: true,
};

const DEFAULT_CONFIG: Required<AppConfig> = {
  git_clone_timeout_minutes: 5,
  debug_mode_keep_volumes: false,
  registry_firewall_enabled: true,
  claude_defaults: { ...DEFAULT_CLAUDE_DEFAULTS },
};

/**
 * ネストオブジェクト(claude_defaults)を含む設定のdeep copy
 */
const cloneConfig = (config: Required<AppConfig>): Required<AppConfig> => ({
  ...config,
  claude_defaults: { ...config.claude_defaults },
});

/**
 * ConfigService
 * アプリケーション設定の管理
 */
export class ConfigService {
  private config: Required<AppConfig>;
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || path.join(process.cwd(), 'data', 'settings.json');
    this.config = cloneConfig(DEFAULT_CONFIG);
  }

  /**
   * 設定ファイルを読み込む
   */
  async load(): Promise<void> {
    try {
      const fileContent = await fs.readFile(this.configPath, 'utf-8');
      const loadedConfig = JSON.parse(fileContent) as AppConfig;

      // デフォルト値とマージ
      const loadedClaudeDefaults = loadedConfig.claude_defaults;
      this.config = {
        git_clone_timeout_minutes: loadedConfig.git_clone_timeout_minutes ?? DEFAULT_CONFIG.git_clone_timeout_minutes,
        debug_mode_keep_volumes: loadedConfig.debug_mode_keep_volumes ?? DEFAULT_CONFIG.debug_mode_keep_volumes,
        registry_firewall_enabled:
          typeof loadedConfig.registry_firewall_enabled === 'boolean'
            ? loadedConfig.registry_firewall_enabled
            : DEFAULT_CONFIG.registry_firewall_enabled,
        claude_defaults: {
          dangerouslySkipPermissions:
            typeof loadedClaudeDefaults?.dangerouslySkipPermissions === 'boolean'
              ? loadedClaudeDefaults.dangerouslySkipPermissions
              : DEFAULT_CLAUDE_DEFAULTS.dangerouslySkipPermissions,
          worktree:
            typeof loadedClaudeDefaults?.worktree === 'boolean'
              ? loadedClaudeDefaults.worktree
              : DEFAULT_CLAUDE_DEFAULTS.worktree,
        },
      };

      logger.info('Configuration loaded', { config: this.config });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.info('Configuration file not found, using defaults', { configPath: this.configPath });
        this.config = cloneConfig(DEFAULT_CONFIG);
      } else {
        logger.error('Failed to load configuration, using defaults', { error });
        this.config = cloneConfig(DEFAULT_CONFIG);
      }
    }
  }

  /**
   * 設定ファイルを保存する
   */
  async save(config: Partial<AppConfig>): Promise<void> {
    try {
      // 既存の設定とマージ（claude_defaultsはネストマージ）
      const { claude_defaults: newClaudeDefaults, ...rest } = config;
      this.config = {
        ...this.config,
        ...rest,
        claude_defaults: {
          ...this.config.claude_defaults,
          ...(newClaudeDefaults || {}),
        },
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
   * レジストリファイアウォールが有効かどうか
   */
  getRegistryFirewallEnabled(): boolean {
    return this.config.registry_firewall_enabled;
  }

  /**
   * Claude Codeのデフォルト設定を取得
   */
  getClaudeDefaults(): Required<ClaudeDefaults> {
    return {
      dangerouslySkipPermissions: this.config.claude_defaults.dangerouslySkipPermissions ?? DEFAULT_CLAUDE_DEFAULTS.dangerouslySkipPermissions,
      worktree: this.config.claude_defaults.worktree ?? DEFAULT_CLAUDE_DEFAULTS.worktree,
    };
  }

  /**
   * 設定全体を取得
   */
  getConfig(): Required<AppConfig> {
    return cloneConfig(this.config);
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
 * 設定がロード済みかどうかのフラグ
 */
let configLoaded = false;

/**
 * ConfigServiceを初期化（設定ファイルを読み込む）
 */
export async function initializeConfigService(): Promise<ConfigService> {
  const service = getConfigService();
  await service.load();
  configLoaded = true;
  return service;
}

/**
 * 設定がロード済みであることを保証してConfigServiceを返す（lazy load）
 */

export async function ensureConfigLoaded(): Promise<ConfigService> {
  const service = getConfigService();
  if (!configLoaded) {
    await service.load();
    configLoaded = true;
  }
  return service;
}
