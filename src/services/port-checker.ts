import * as net from 'net';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import type { PortMapping } from '@/types/environment';

/**
 * ポートチェックの状態
 */
export type PortCheckStatus = 'available' | 'in_use' | 'unknown';

/**
 * ポートチェック結果
 */
export interface PortCheckResult {
  port: number;
  status: PortCheckStatus;
  usedBy?: string;
  source?: 'os' | 'claudework';
}

/**
 * ポートチェックリクエスト
 */
export interface PortCheckRequest {
  ports: number[];
  excludeEnvironmentId?: string;
}

/**
 * PortChecker
 * ポートの使用状況を確認するサービス
 * - OS レベルのポート使用状況（net.createServer によるバインド試行）
 * - ClaudeWork 環境によるポート使用状況（DBのDOCKER環境のportMappings照合）
 */
export class PortChecker {
  /**
   * 複数ポートを一括チェックする
   * @param request - チェックするポートリストと除外環境ID
   * @returns 各ポートのチェック結果
   */
  async checkPorts(request: PortCheckRequest): Promise<PortCheckResult[]> {
    const { ports, excludeEnvironmentId } = request;
    return Promise.all(
      ports.map((port) => this.checkSinglePort(port, excludeEnvironmentId))
    );
  }

  /**
   * 単一ポートのチェックを行う
   * OS チェックと ClaudeWork チェックを合わせて結果を集約する
   * 優先度: in_use > unknown > available
   * @param port - チェックするポート番号
   * @param excludeEnvironmentId - 除外する環境ID（自環境）
   * @returns ポートチェック結果
   */
  async checkSinglePort(
    port: number,
    excludeEnvironmentId?: string
  ): Promise<PortCheckResult> {
    const [osResult, cwResults] = await Promise.all([
      this.checkHostPort(port),
      this.checkClaudeWorkPorts([port], excludeEnvironmentId),
    ]);

    const cwResult = cwResults[0];

    // OS で使用中なら最優先
    if (osResult.status === 'in_use') {
      return osResult;
    }

    // ClaudeWork 環境で使用中
    if (cwResult && cwResult.status === 'in_use') {
      return cwResult;
    }

    // OS で unknown
    if (osResult.status === 'unknown') {
      return osResult;
    }

    // どちらも available
    return { port, status: 'available' };
  }

  /**
   * OS レベルでポートが使用中かどうかをチェックする
   * net.createServer でバインドを試み、結果を判定する
   * @param port - チェックするポート番号
   * @returns ポートチェック結果
   */
  checkHostPort(port: number): Promise<PortCheckResult> {
    return new Promise((resolve) => {
      let resolved = false;
      const server = net.createServer();

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          server.close(() => {
            resolve({ port, status: 'unknown' });
          });
        }
      }, 500);

      server.on('error', (err: NodeJS.ErrnoException) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);
        if (err.code === 'EADDRINUSE') {
          server.close(() => {
            resolve({ port, status: 'in_use', source: 'os' });
          });
        } else {
          // EACCES など権限不足の場合は unknown
          server.close(() => {
            resolve({ port, status: 'unknown' });
          });
        }
      });

      server.listen(port, () => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);
        server.close(() => {
          resolve({ port, status: 'available' });
        });
      });
    });
  }

  /**
   * ClaudeWork の DOCKER 環境で使用中のポートかどうかをチェックする
   * DB から DOCKER 環境を取得し、config の portMappings を照合する
   * @param ports - チェックするポート番号の配列
   * @param excludeEnvironmentId - 除外する環境ID（自環境を除外する場合）
   * @returns 各ポートのチェック結果
   */
  async checkClaudeWorkPorts(
    ports: number[],
    excludeEnvironmentId?: string
  ): Promise<PortCheckResult[]> {
    let envs;
    try {
      // DOCKER 環境を全取得
      envs = db
        .select()
        .from(schema.executionEnvironments)
        .where(eq(schema.executionEnvironments.type, 'DOCKER'))
        .all();
    } catch {
      // DB取得失敗時は全ポートをunknownで返す
      return ports.map((port) => ({ port, status: 'unknown' as PortCheckStatus }));
    }

    // 除外環境ID を持つ環境を除く
    const targetEnvs = excludeEnvironmentId
      ? envs.filter((env) => env.id !== excludeEnvironmentId)
      : envs;

    // 各環境の portMappings を収集
    const usedPortMap = new Map<number, string>(); // hostPort -> 環境名

    for (const env of targetEnvs) {
      let config: { portMappings?: PortMapping[] } = {};
      try {
        config = JSON.parse(env.config || '{}');
      } catch {
        // JSON パースエラーは無視（空のconfigとして扱う）
        continue;
      }

      if (!config.portMappings) continue;

      for (const mapping of config.portMappings) {
        if (!usedPortMap.has(mapping.hostPort)) {
          usedPortMap.set(mapping.hostPort, env.name);
        }
      }
    }

    // 各ポートを照合して結果を返す
    return ports.map((port) => {
      const usedBy = usedPortMap.get(port);
      if (usedBy !== undefined) {
        return {
          port,
          status: 'in_use' as PortCheckStatus,
          source: 'claudework' as const,
          usedBy,
        };
      }
      return { port, status: 'available' as PortCheckStatus };
    });
  }
}

/**
 * シングルトンインスタンス
 */
export const portChecker = new PortChecker();

