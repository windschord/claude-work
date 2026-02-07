/**
 * Claude Code CLIオプション設定
 */
export interface ClaudeCodeOptions {
  model?: string;           // --model <value>
  allowedTools?: string;    // --allowedTools <value>
  permissionMode?: string;  // --permission-mode <value>
  additionalFlags?: string; // その他フラグ（スペース区切り文字列）
}

/**
 * カスタム環境変数
 */
export interface CustomEnvVars {
  [key: string]: string;
}

/**
 * 環境変数キーのバリデーション正規表現
 */
const ENV_VAR_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Claude Code実行オプションのマージ・ビルドサービス
 */
export class ClaudeOptionsService {
  /**
   * プロジェクトデフォルトとセッション固有設定をマージ
   * セッション固有設定の各フィールドがプロジェクトデフォルトをオーバーライド
   * 空文字列はクリア（未指定に戻す）として扱う
   */
  static mergeOptions(
    projectOptions: ClaudeCodeOptions,
    sessionOptions: ClaudeCodeOptions | null
  ): ClaudeCodeOptions {
    if (!sessionOptions) {
      return { ...projectOptions };
    }

    const merged: ClaudeCodeOptions = {};

    for (const key of ['model', 'allowedTools', 'permissionMode', 'additionalFlags'] as const) {
      if (sessionOptions[key] !== undefined) {
        // 空文字列はクリア（フィールドを含めない）
        if (sessionOptions[key] !== '') {
          merged[key] = sessionOptions[key];
        }
      } else if (projectOptions[key] !== undefined && projectOptions[key] !== '') {
        merged[key] = projectOptions[key];
      }
    }

    return merged;
  }

  /**
   * プロジェクトデフォルトとセッション固有環境変数をマージ
   * セッション固有環境変数がプロジェクトデフォルトをオーバーライド
   */
  static mergeEnvVars(
    projectEnvVars: CustomEnvVars,
    sessionEnvVars: CustomEnvVars | null
  ): CustomEnvVars {
    if (!sessionEnvVars) {
      return { ...projectEnvVars };
    }
    return { ...projectEnvVars, ...sessionEnvVars };
  }

  /**
   * CLIオプションを引数配列に変換
   */
  static buildCliArgs(options: ClaudeCodeOptions): string[] {
    const args: string[] = [];

    if (options.model) {
      args.push('--model', options.model);
    }

    if (options.allowedTools) {
      args.push('--allowedTools', options.allowedTools);
    }

    if (options.permissionMode) {
      args.push('--permission-mode', options.permissionMode);
    }

    if (options.additionalFlags) {
      // 改行・制御文字をスペースに置換
      const sanitized = options.additionalFlags.replace(/[\x00-\x1f\x7f]/g, ' ');
      // スペースで分割して個別の引数として追加
      const flagParts = sanitized.split(/\s+/).filter(Boolean);
      args.push(...flagParts);
    }

    return args;
  }

  /**
   * カスタム環境変数をPTY環境変数にマージ
   */
  static buildEnv(
    baseEnv: Record<string, string>,
    customVars: CustomEnvVars
  ): Record<string, string> {
    const result = { ...baseEnv };
    for (const [key, value] of Object.entries(customVars)) {
      if (this.validateEnvVarKey(key)) {
        result[key] = value;
      }
    }
    return result;
  }

  /**
   * 環境変数キーのバリデーション
   */
  static validateEnvVarKey(key: string): boolean {
    return ENV_VAR_KEY_PATTERN.test(key);
  }

  /**
   * JSON文字列からClaudeCodeOptionsをパース（安全にパース）
   */
  static parseOptions(json: string | null | undefined): ClaudeCodeOptions {
    if (!json) return {};
    try {
      return JSON.parse(json) as ClaudeCodeOptions;
    } catch {
      return {};
    }
  }

  /**
   * JSON文字列からCustomEnvVarsをパース（安全にパース）
   */
  static parseEnvVars(json: string | null | undefined): CustomEnvVars {
    if (!json) return {};
    try {
      return JSON.parse(json) as CustomEnvVars;
    } catch {
      return {};
    }
  }
}
