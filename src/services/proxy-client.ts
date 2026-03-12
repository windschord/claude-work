import { logger } from '@/lib/logger';

// ==================== 定数 ====================

const DEFAULT_BASE_URL = process.env.PROXY_API_URL ?? 'http://network-filter-proxy:8080';
const REQUEST_TIMEOUT_MS = 5000;
const MAX_RETRY_COUNT = 3;

// ==================== 型定義 ====================

export interface ProxyHealthStatus {
  status: 'healthy' | 'unhealthy';
  uptime: number;
  activeConnections: number;
  ruleCount: number;
}

export interface ProxyRuleEntry {
  host: string;
  /** ポート番号。省略または0で全ポート許可 */
  port?: number;
}

export interface ProxyRuleSet {
  source_ip: string;
  entries: ProxyRuleEntry[];
  updated_at: string;
}

export type ProxyRulesMap = Record<string, ProxyRuleSet>;

// ==================== エラークラス ====================

/**
 * proxyへの接続エラー（接続失敗、タイムアウト、サーバーエラー）
 */
export class ProxyConnectionError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'ProxyConnectionError';
  }
}

/**
 * proxyへのリクエストのバリデーションエラー（422レスポンス）
 */
export class ProxyValidationError extends Error {
  constructor(
    message: string,
    public details?: Array<{ field: string; message: string }>
  ) {
    super(message);
    this.name = 'ProxyValidationError';
  }
}

// ==================== ProxyClientクラス ====================

/**
 * network-filter-proxy Management APIと通信するHTTPクライアント
 *
 * - healthCheck: リトライなし
 * - setRules/deleteRules/syncRules: 最大3回試行（2回リトライ、指数バックオフ 1s, 2s）
 * - 全API: タイムアウト5秒
 */
export class ProxyClient {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? DEFAULT_BASE_URL;
  }

  // ==================== ヘルスチェック ====================

  /**
   * proxyのヘルスチェックを行う（リトライなし）
   *
   * @returns ProxyHealthStatus
   * @throws ProxyConnectionError proxyに接続できない場合
   */
  async healthCheck(): Promise<ProxyHealthStatus> {
    const url = `${this.baseUrl}/api/v1/health`;

    let response: Response;
    try {
      response = await this.fetchWithTimeout(url, {});
    } catch (err) {
      throw new ProxyConnectionError(
        'proxyに接続できません',
        err instanceof Error ? err : new Error(String(err))
      );
    }

    if (!response.ok) {
      throw new ProxyConnectionError(
        `proxyがエラーを返しました: HTTP ${response.status}`
      );
    }

    return response.json() as Promise<ProxyHealthStatus>;
  }

  // ==================== ルール取得 ====================

  /**
   * proxyに登録されている全ルールを取得する
   *
   * @returns ProxyRulesMap
   * @throws ProxyConnectionError proxyに接続できない場合
   */
  async getAllRules(): Promise<ProxyRulesMap> {
    const url = `${this.baseUrl}/api/v1/rules`;

    let response: Response;
    try {
      response = await this.fetchWithTimeout(url, {});
    } catch (err) {
      throw new ProxyConnectionError(
        'proxyに接続できません',
        err instanceof Error ? err : new Error(String(err))
      );
    }

    if (!response.ok) {
      throw new ProxyConnectionError(
        `proxyがエラーを返しました: HTTP ${response.status}`
      );
    }

    return response.json() as Promise<ProxyRulesMap>;
  }

  // ==================== ルール設定 ====================

  /**
   * 指定した送信元IPのルールセットを丸ごと置換する（リトライあり）
   *
   * @param sourceIP - コンテナの送信元IPアドレス
   * @param entries - 許可するホスト一覧
   * @returns ProxyRuleSet
   * @throws ProxyValidationError ルール形式が不正な場合（422）
   * @throws ProxyConnectionError proxyに接続できない場合
   */
  async setRules(sourceIP: string, entries: ProxyRuleEntry[]): Promise<ProxyRuleSet> {
    const url = `${this.baseUrl}/api/v1/rules/${sourceIP}`;
    const body = JSON.stringify({ entries });

    return this.withRetry(async () => {
      let response: Response;
      try {
        response = await this.fetchWithTimeout(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body,
        });
      } catch (err) {
        throw new ProxyConnectionError(
          'proxyに接続できません',
          err instanceof Error ? err : new Error(String(err))
        );
      }

      if (response.status === 422) {
        let details: Array<{ field: string; message: string }> | undefined;
        try {
          const errorBody = await response.json() as { details?: Array<{ field: string; message: string }> };
          details = errorBody.details;
        } catch {
          // JSON解析失敗は無視
        }
        throw new ProxyValidationError('ルールのバリデーションに失敗しました', details);
      }

      if (!response.ok) {
        throw new ProxyConnectionError(
          `proxyがエラーを返しました: HTTP ${response.status}`
        );
      }

      return response.json() as Promise<ProxyRuleSet>;
    });
  }

  // ==================== ルール削除 ====================

  /**
   * 指定した送信元IPのルールを削除する（リトライあり）
   *
   * @param sourceIP - コンテナの送信元IPアドレス
   * @throws ProxyConnectionError proxyに接続できない場合
   */
  async deleteRules(sourceIP: string): Promise<void> {
    const url = `${this.baseUrl}/api/v1/rules/${sourceIP}`;

    await this.withRetry(async () => {
      let response: Response;
      try {
        response = await this.fetchWithTimeout(url, { method: 'DELETE' });
      } catch (err) {
        throw new ProxyConnectionError(
          'proxyに接続できません',
          err instanceof Error ? err : new Error(String(err))
        );
      }

      if (!response.ok) {
        throw new ProxyConnectionError(
          `proxyがエラーを返しました: HTTP ${response.status}`
        );
      }
    });
  }

  /**
   * proxyの全ルールを削除する（リトライあり）
   *
   * @throws ProxyConnectionError proxyに接続できない場合
   */
  async deleteAllRules(): Promise<void> {
    const url = `${this.baseUrl}/api/v1/rules`;

    await this.withRetry(async () => {
      let response: Response;
      try {
        response = await this.fetchWithTimeout(url, { method: 'DELETE' });
      } catch (err) {
        throw new ProxyConnectionError(
          'proxyに接続できません',
          err instanceof Error ? err : new Error(String(err))
        );
      }

      if (!response.ok) {
        throw new ProxyConnectionError(
          `proxyがエラーを返しました: HTTP ${response.status}`
        );
      }
    });
  }

  // ==================== ルール同期 ====================

  /**
   * ClaudeWork DBのルールをproxy APIにPUTで同期する（リトライあり）
   *
   * 処理フロー:
   * 1. NetworkFilterServiceからenvironmentIdの全ルールを取得
   * 2. enabled === true のルールのみフィルタ
   * 3. ClaudeWork形式 -> proxy API形式に変換（target -> host, port -> port）
   * 4. PUT /api/v1/rules/{sourceIP} で丸ごと置換
   *
   * @param sourceIP - コンテナの送信元IPアドレス
   * @param environmentId - 環境ID
   * @throws ProxyConnectionError proxyに接続できない場合
   */
  async syncRules(sourceIP: string, environmentId: string): Promise<void> {
    // 循環依存を避けるためdynamic importを使用
    const { networkFilterService } = await import('@/services/network-filter-service');
    const allRules = await networkFilterService.getRules(environmentId);

    const enabledRules = allRules.filter((rule) => rule.enabled === true);

    const entries: ProxyRuleEntry[] = enabledRules.map((rule) => {
      const entry: ProxyRuleEntry = { host: rule.target };
      if (rule.port !== null && rule.port !== undefined) {
        entry.port = rule.port;
      }
      return entry;
    });

    logger.info('proxyにルールを同期中', {
      sourceIP,
      environmentId,
      ruleCount: entries.length,
    });

    await this.setRules(sourceIP, entries);

    logger.info('proxyへのルール同期が完了しました', {
      sourceIP,
      environmentId,
      ruleCount: entries.length,
    });
  }

  // ==================== 内部ヘルパー ====================

  /**
   * タイムアウト付きfetch
   *
   * @param url - リクエストURL
   * @param init - fetchオプション
   * @returns Response
   */
  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => { controller.abort(); }, REQUEST_TIMEOUT_MS);

    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * 指数バックオフによるリトライ（最大3回試行 = 初回 + 2回リトライ）
   *
   * バックオフ: 1s, 2s（MAX_RETRY_COUNT=3のため3回目の試行後はリトライなし）
   * ProxyValidationError はリトライしない（クライアントエラー）
   *
   * @param fn - 実行する非同期関数
   * @returns fnの戻り値
   */
  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < MAX_RETRY_COUNT; attempt++) {
      try {
        return await fn();
      } catch (err) {
        // バリデーションエラーはリトライしない
        if (err instanceof ProxyValidationError) {
          throw err;
        }

        lastError = err instanceof Error ? err : new Error(String(err));

        if (attempt < MAX_RETRY_COUNT - 1) {
          const waitMs = 1000 * Math.pow(2, attempt);
          logger.warn('proxy APIリクエスト失敗、リトライします', {
            attempt: attempt + 1,
            maxRetries: MAX_RETRY_COUNT,
            waitMs,
            error: lastError.message,
          });
          await new Promise<void>((resolve) => { setTimeout(resolve, waitMs); });
        }
      }
    }

    throw lastError instanceof ProxyConnectionError
      ? lastError
      : new ProxyConnectionError('proxyへのリクエストが失敗しました', lastError);
  }
}

/**
 * シングルトンインスタンス
 */
export const proxyClient = new ProxyClient();
