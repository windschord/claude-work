/**
 * Claude Code CLIオプション設定
 */
export interface ClaudeCodeOptions {
  model?: string;           // --model <value>
  allowedTools?: string;    // --allowedTools <value>
  permissionMode?: string;  // --permission-mode <value>
  additionalFlags?: string; // その他フラグ（スペース区切り文字列）
  dangerouslySkipPermissions?: boolean; // --dangerously-skip-permissions（Docker環境のみ）
  worktree?: boolean | string; // --worktree [name]
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
 * Worktree名のバリデーション正規表現
 * 英字・数字・ハイフン・アンダースコア・ドットのみ許可
 * パストラバーサル（../）やスラッシュ（/）を防止
 */
const WORKTREE_NAME_PATTERN = /^[A-Za-z0-9._-]+$/;

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

    // 文字列フィールドのマージ（空文字列はクリア）
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

    // booleanフィールドのマージ（undefinedは上書きなし）
    if (sessionOptions.dangerouslySkipPermissions !== undefined) {
      merged.dangerouslySkipPermissions = sessionOptions.dangerouslySkipPermissions;
    } else if (projectOptions.dangerouslySkipPermissions !== undefined) {
      merged.dangerouslySkipPermissions = projectOptions.dangerouslySkipPermissions;
    }

    // worktreeフィールドのマージ（boolean | string、空文字列はクリア）
    if (sessionOptions.worktree !== undefined) {
      if (sessionOptions.worktree !== '') {
        merged.worktree = sessionOptions.worktree;
      }
    } else if (projectOptions.worktree !== undefined && projectOptions.worktree !== '') {
      merged.worktree = projectOptions.worktree;
    }

    return merged;
  }

  /**
   * アプリケーション共通・プロジェクト・セッションの環境変数を3階層でマージ
   * 優先順位: Application < Project < Session
   */
  static mergeEnvVarsAll(
    appEnvVars: CustomEnvVars,
    projectEnvVars: CustomEnvVars,
    sessionEnvVars: CustomEnvVars | null
  ): CustomEnvVars {
    return {
      ...appEnvVars,
      ...projectEnvVars,
      ...(sessionEnvVars ?? {}),
    };
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

    // dangerouslySkipPermissions は buildCliArgs() では意図的に除外。
    // Docker環境種別やシェルモードに応じた条件付けが必要なため、
    // DockerAdapter.buildDockerArgs() で直接処理する。

    if (options.worktree === true) {
      args.push('--worktree');
    } else if (typeof options.worktree === 'string') {
      const trimmed = options.worktree.trim();
      if (trimmed.length > 0 && WORKTREE_NAME_PATTERN.test(trimmed)) {
        args.push('--worktree', trimmed);
      } else if (trimmed.length > 0) {
        // 不正な名前は無視してbooleanとして扱う
        args.push('--worktree');
      }
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
   * 未知のキーが含まれている場合はnullを返す（タイポ検知）
   * @returns バリデーション成功時はClaudeCodeOptions、失敗時はnull
   */
  static validateClaudeCodeOptions(value: unknown): ClaudeCodeOptions | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const obj = value as Record<string, unknown>;
    const allowedKeys = new Set(['model', 'allowedTools', 'permissionMode', 'additionalFlags', 'dangerouslySkipPermissions', 'worktree']);

    // 未知のキーをチェック
    for (const key of Object.keys(obj)) {
      if (!allowedKeys.has(key)) {
        return null; // 未知のキーがある場合は失敗
      }
    }

    const result: ClaudeCodeOptions = {};

    // 文字列フィールドのバリデーション
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

    // booleanフィールドのバリデーション
    if ('dangerouslySkipPermissions' in obj) {
      const fieldValue = obj.dangerouslySkipPermissions;
      if (typeof fieldValue !== 'boolean' && fieldValue !== undefined) {
        return null; // boolean以外は失敗
      }
      if (typeof fieldValue === 'boolean') {
        result.dangerouslySkipPermissions = fieldValue;
      }
    }

    // worktreeフィールドのバリデーション（boolean | string）
    if ('worktree' in obj) {
      const fieldValue = obj.worktree;
      if (typeof fieldValue !== 'boolean' && typeof fieldValue !== 'string' && fieldValue !== undefined) {
        return null; // boolean/string以外は失敗
      }
      if (typeof fieldValue === 'boolean') {
        result.worktree = fieldValue;
      } else if (typeof fieldValue === 'string') {
        const trimmed = fieldValue.trim();
        if (trimmed.length > 0 && !WORKTREE_NAME_PATTERN.test(trimmed)) {
          return null; // パストラバーサル等の不正な名前は失敗
        }
        result.worktree = trimmed;
      }
    }

    return result;
  }

  /**
   * 未知のキーを検出する（エラーメッセージ用）
   * @returns 未知のキーの配列、なければ空配列
   */
  static getUnknownKeys(value: unknown): string[] {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return [];
    }

    const obj = value as Record<string, unknown>;
    const allowedKeys = new Set(['model', 'allowedTools', 'permissionMode', 'additionalFlags', 'dangerouslySkipPermissions', 'worktree']);

    return Object.keys(obj).filter(key => !allowedKeys.has(key));
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
   * 非文字列フィールドを除外し、有効なフィールドのみを保持（APIバリデーションより緩い動作）
   */
  static parseOptions(json: string | null | undefined): ClaudeCodeOptions {
    if (!json) return {};
    try {
      const parsed = JSON.parse(json);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {};
      }
      // 非文字列フィールドを除外し、有効なフィールドのみを保持
      const result: ClaudeCodeOptions = {};
      for (const key of ['model', 'allowedTools', 'permissionMode', 'additionalFlags'] as const) {
        if (key in parsed && typeof parsed[key] === 'string') {
          result[key] = parsed[key];
        }
      }
      // booleanフィールド
      if ('dangerouslySkipPermissions' in parsed && typeof parsed.dangerouslySkipPermissions === 'boolean') {
        result.dangerouslySkipPermissions = parsed.dangerouslySkipPermissions;
      }
      // worktreeフィールド（boolean | string）
      if ('worktree' in parsed) {
        if (typeof parsed.worktree === 'boolean' || typeof parsed.worktree === 'string') {
          result.worktree = parsed.worktree;
        }
      }
      return result;
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

  /**
   * skipPermissions有効時に矛盾するオプションを除去
   *
   * --dangerously-skip-permissions は全パーミッション確認をスキップするため、
   * --permission-mode と --allowedTools は意味をなさない。
   * dangerouslySkipPermissions自体も常に除去する（DockerAdapter.buildDockerArgs()で別途追加するため）。
   *
   * @returns 除去後のオプションと、除去されたフィールドの警告メッセージ
   */
  static stripConflictingOptions(
    claudeCodeOptions: ClaudeCodeOptions | undefined,
    skipPermissions: boolean
  ): { result: ClaudeCodeOptions | undefined; warnings: string[] } {
    const warnings: string[] = [];
    const sanitized = claudeCodeOptions ? { ...claudeCodeOptions } : undefined;

    if (sanitized) {
      delete sanitized.dangerouslySkipPermissions;
    }

    if (skipPermissions && sanitized) {
      if (sanitized.permissionMode) {
        warnings.push(`ignoring permissionMode: ${sanitized.permissionMode}`);
        delete sanitized.permissionMode;
      }
      if (sanitized.allowedTools) {
        warnings.push(`ignoring allowedTools: ${sanitized.allowedTools}`);
        delete sanitized.allowedTools;
      }
    }

    return { result: sanitized, warnings };
  }

  /**
   * worktreeオプションが有効かどうかを判定
   */
  static hasWorktreeOption(options: ClaudeCodeOptions): boolean {
    if (typeof options.worktree === 'string') return options.worktree.trim().length > 0;
    return options.worktree === true;
  }

  /**
   * Worktree名のバリデーション
   * 英字・数字・ハイフン・アンダースコア・ドットのみ許可
   */
  static validateWorktreeName(name: string): boolean {
    return WORKTREE_NAME_PATTERN.test(name.trim());
  }
}
