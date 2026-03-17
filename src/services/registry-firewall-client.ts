import { logger } from '@/lib/logger';

// ==================== 型定義 ====================

export interface RegistryFirewallHealthResponse {
  status: 'healthy' | 'unhealthy' | 'stopped';
  registries?: string[];
  version?: string;
}

export interface BlockLogEntry {
  timestamp: string;
  package_name: string;
  registry: string;
  reason: string;
  severity?: string;
}

export interface BlockLogsResponse {
  blocks: BlockLogEntry[];
  total: number;
}

// ==================== 定数 ====================

const DEFAULT_TIMEOUT_MS = 2000; // NFR-AVA-002: 2秒タイムアウト

// ==================== クライアント ====================

/**
 * Registry Firewall APIクライアント
 *
 * registry-firewallのヘルスチェック、ブロックログ取得を提供する。
 * UIプロキシはnext.config.jsのrewrites設定で実現している。
 * エラー時は例外をスローせず、安全なデフォルト値を返す。
 */
export class RegistryFirewallClient {
  private baseUrl: string;
  private apiToken: string | undefined;
  private timeout: number;

  constructor() {
    this.baseUrl = process.env.REGISTRY_FIREWALL_URL || 'http://registry-firewall:8080';
    this.apiToken = process.env.REGISTRY_FIREWALL_API_TOKEN || undefined;
    this.timeout = DEFAULT_TIMEOUT_MS;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiToken) {
      headers['Authorization'] = `Bearer ${this.apiToken}`;
    }
    return headers;
  }

  /**
   * ヘルスチェック
   *
   * registry-firewallの/healthエンドポイントにアクセスし、ステータスを返す。
   * タイムアウトや接続エラー時は { status: 'stopped' } を返す(例外をスローしない)。
   */
  async getHealth(): Promise<RegistryFirewallHealthResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        headers: this.getHeaders(),
        signal: controller.signal,
      });

      if (response.status === 401 || response.status === 403) {
        logger.warn('Registry firewall authentication failed', { status: response.status });
        return { status: 'unhealthy' };
      }

      if (!response.ok) {
        logger.warn('Registry firewall health check failed', { status: response.status });
        return { status: 'stopped' };
      }

      const data = await response.json();
      return data as RegistryFirewallHealthResponse;
    } catch (error) {
      logger.debug('Registry firewall health check error', { error });
      return { status: 'stopped' };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * ブロックログ取得
   *
   * registry-firewallの/api/blocksエンドポイントからブロックログを取得する。
   * エラー時は空のレスポンスを返す(例外をスローしない)。
   */
  async getBlocks(limit?: number): Promise<BlockLogsResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    try {
      const params = new URLSearchParams();
      if (limit !== undefined) {
        params.set('limit', String(limit));
      }

      const url = `${this.baseUrl}/api/blocks${params.toString() ? `?${params.toString()}` : ''}`;

      const response = await fetch(url, {
        headers: this.getHeaders(),
        signal: controller.signal,
      });

      if (!response.ok) {
        logger.warn('Registry firewall blocks fetch failed', { status: response.status });
        return { blocks: [], total: 0 };
      }

      const data = await response.json();
      return data as BlockLogsResponse;
    } catch (error) {
      logger.debug('Registry firewall blocks fetch error', { error });
      return { blocks: [], total: 0 };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

// ==================== シングルトン ====================

let instance: RegistryFirewallClient | null = null;

/**
 * RegistryFirewallClientのシングルトンインスタンスを取得
 */
export function getRegistryFirewallClient(): RegistryFirewallClient {
  if (!instance) {
    instance = new RegistryFirewallClient();
  }
  return instance;
}
