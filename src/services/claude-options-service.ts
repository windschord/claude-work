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
 * 大文字英字・数字・アンダースコアのみ許可（POSIXの環境変数命名規則に準拠）
 */
const ENV_VAR_KEY_PATTERN = /^[A-Z_][A-Z0-9_]*$/;

/**
 * 制御文字を検出する正規表現（RegExpコンストラクタで定義）
 * \x00-\x1f: C0制御文字, \x7f: DEL
 */
const CONTROL_CHARS_REGEX = new RegExp('[\\x00-\\x1f\\x7f]', 'g');

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
      const sanitized = options.additionalFlags.replace(CONTROL_CHARS_REGEX, ' ');
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
      if (!this.validateEnvVarKey(key)) {
        continue;
      }
      if (typeof value === 'string') {
        result[key] = value;
      }
      // 非文字列の値は無視（型安全性のため）
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
   * ClaudeCodeOptionsのバリデーション（API層用）
   * 各フィールドが文字列であることを検証
   * @returns バリデーション成功時はClaudeCodeOptions、失敗時はnull
   */
  static validateClaudeCodeOptions(value: unknown): ClaudeCodeOptions | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const obj = value as Record<string, unknown>;
    const result: ClaudeCodeOptions = {};

    for (const key of ['model', 'allowedTools', 'permissionMode', 'additionalFlags'] as const) {
      if (key in obj) {
        const fieldValue = obj[key];
        if (typeof fieldValue !== 'string' && fieldValue !== undefined) {
          return null; // 非文字列フィールドがある場合は失敗
        }
        if (typeof fieldValue === 'string') {
          result[key] = fieldValue;
        }
      }
    }

    return result;
  }

  /**
   * CustomEnvVarsのバリデーション（API層用）
   * キーが正規表現にマッチし、値が文字列であることを検証
   * @returns バリデーション成功時はCustomEnvVars、失敗時はnull
   */
  static validateCustomEnvVars(value: unknown): CustomEnvVars | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const obj = value as Record<string, unknown>;
    const result: CustomEnvVars = {};

    for (const [key, val] of Object.entries(obj)) {
      // キーの形式を検証
      if (!this.validateEnvVarKey(key)) {
        return null; // 無効なキーがある場合は失敗
      }
      // 値が文字列であることを検証
      if (typeof val !== 'string') {
        return null; // 非文字列の値がある場合は失敗
      }
      result[key] = val;
    }

    return result;
  }

  /**
   * JSON文字列からClaudeCodeOptionsをパース（安全にパース）
   * 配列・null・プリミティブ等はplain objectではないため空objectを返す
   * パース後にバリデーション関数を使用して型安全性を確保
   */
  static parseOptions(json: string | null | undefined): ClaudeCodeOptions {
    if (!json) return {};
    try {
      const parsed = JSON.parse(json);
      // バリデーション関数を使用して型安全性を確保
      const validated = this.validateClaudeCodeOptions(parsed);
      return validated ?? {};
    } catch {
      return {};
    }
  }

  /**
   * JSON文字列からCustomEnvVarsをパース（安全にパース）
   * 配列・null・プリミティブ等はplain objectではないため空objectを返す
   * パース後に無効なキーや非文字列値を除外
   */
  static parseEnvVars(json: string | null | undefined): CustomEnvVars {
    if (!json) return {};
    try {
      const parsed = JSON.parse(json);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {};
      }
      // 値が文字列でないエントリや無効なキーを除外（APIバリデーションより緩い動作）
      const result: CustomEnvVars = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === 'string' && this.validateEnvVarKey(key)) {
          result[key] = value;
        }
      }
      return result;
    } catch {
      return {};
    }
  }
}
