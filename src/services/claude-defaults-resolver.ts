import type { ClaudeDefaults } from './config-service';
import type { ClaudeCodeOptions } from './claude-options-service';
import { ClaudeOptionsService } from './claude-options-service';

/**
 * 環境設定のconfig JSON構造
 */
export interface EnvironmentConfig {
  // 既存フィールド
  skipPermissions?: boolean;  // DEPRECATED: claude_defaults_overrideに移行

  // 新規追加
  claude_defaults_override?: {
    dangerouslySkipPermissions?: boolean | 'inherit';
    worktree?: boolean | 'inherit';
  };

  // その他のフィールドは許容
  [key: string]: unknown;
}

/**
 * 解決済みClaude Codeオプション
 */
export interface ResolvedClaudeOptions {
  dangerouslySkipPermissions: boolean;
  worktree: boolean | string;
  model?: string;
  allowedTools?: string;
  permissionMode?: string;
  additionalFlags?: string;
}

/**
 * ClaudeDefaultsResolver
 *
 * 4層カスケードでClaude Codeの起動オプションを解決する。
 *
 * 解決順序:
 * 1. アプリ共通設定 (ConfigService.claude_defaults)
 * 2. 環境オーバーライド (env.config.claude_defaults_override)
 * 3. プロジェクト設定 (project.claude_code_options)
 * 4. セッション設定 (session.claude_code_options)
 *
 * HOST環境ではdangerouslySkipPermissionsは常にfalseに強制される。
 */
export class ClaudeDefaultsResolver {
  /**
   * 4層カスケードで設定を解決
   */
  static resolve(
    appDefaults: Required<ClaudeDefaults>,
    envConfig: EnvironmentConfig,
    envType: 'HOST' | 'DOCKER' | 'SSH',
    projectOptions: ClaudeCodeOptions,
    sessionOptions: ClaudeCodeOptions | null
  ): ResolvedClaudeOptions {
    // Layer 3-4のマージを先に実行（project -> session）
    // ClaudeOptionsService.mergeOptions() は空文字列によるクリアを正しく処理する
    const merged = ClaudeOptionsService.mergeOptions(projectOptions, sessionOptions);

    // --- dangerouslySkipPermissions ---
    // Layer 1: アプリ共通デフォルト
    let skipPermissions: boolean = appDefaults.dangerouslySkipPermissions ?? false;

    // Layer 2: 環境オーバーライド
    const envOverride = envConfig.claude_defaults_override;
    if (envOverride?.dangerouslySkipPermissions !== undefined && envOverride.dangerouslySkipPermissions !== 'inherit') {
      skipPermissions = envOverride.dangerouslySkipPermissions;
    } else if (envOverride?.dangerouslySkipPermissions === undefined || envOverride?.dangerouslySkipPermissions === 'inherit') {
      // 旧skipPermissionsの後方互換（claude_defaults_overrideが未設定の場合のみ）
      if (envOverride?.dangerouslySkipPermissions === undefined && envConfig.skipPermissions !== undefined) {
        skipPermissions = envConfig.skipPermissions === true;
      }
    }

    // Layer 3-4: マージ済みのプロジェクト/セッション設定を適用
    if (merged.dangerouslySkipPermissions !== undefined) {
      skipPermissions = merged.dangerouslySkipPermissions;
    }

    // HOST環境では常にfalse
    if (envType === 'HOST') {
      skipPermissions = false;
    }

    // --- worktree ---
    // Layer 1: アプリ共通デフォルト
    let worktree: boolean | string = appDefaults.worktree ?? true;

    // Layer 2: 環境オーバーライド
    if (envOverride?.worktree !== undefined && envOverride.worktree !== 'inherit') {
      worktree = envOverride.worktree;
    }

    // Layer 3-4: マージ済みのプロジェクト/セッション設定を適用
    if (merged.worktree !== undefined) {
      worktree = merged.worktree;
    }

    return {
      dangerouslySkipPermissions: skipPermissions,
      worktree,
      model: merged.model,
      allowedTools: merged.allowedTools,
      permissionMode: merged.permissionMode,
      additionalFlags: merged.additionalFlags,
    };
  }
}
