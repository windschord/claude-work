import { createHash } from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { logger } from '../lib/logger';

export const execFileAsync = promisify(execFile);

export interface ResolvedRule {
  ips: string[];
  port: number | null;
  description?: string;
}

export interface ActiveChainInfo {
  chainName: string;
  ruleCount: number;
  envIdPrefix: string;
}

const CHAIN_PREFIX = 'CWFILTER-';

function buildChainName(envId: string): string {
  const hash = createHash('sha256').update(envId).digest('hex').slice(0, 12);
  return `${CHAIN_PREFIX}${hash}`;
}

type ExecFileAsyncFn = (
  file: string,
  args?: readonly string[],
  options?: { input?: string }
) => Promise<{ stdout: string; stderr: string }>;

/**
 * iptablesコマンドの実行を抽象化し、フィルタリングルールの生成・適用・クリーンアップを行う
 */
export class IptablesManager {
  private readonly _execFileAsync: ExecFileAsyncFn;

  constructor(execFileAsyncFn?: ExecFileAsyncFn) {
    this._execFileAsync = execFileAsyncFn ?? (execFileAsync as unknown as ExecFileAsyncFn);
  }

  /**
   * iptablesコマンドが利用可能かチェック
   */
  async checkAvailability(): Promise<boolean> {
    try {
      await this._execFileAsync('iptables', ['--version']);
      logger.debug('iptables is available');
      return true;
    } catch (err) {
      logger.warn('iptables is not available', { error: err });
      return false;
    }
  }

  /**
   * 環境用のiptablesフィルタチェインを作成し、ホワイトリストルールを適用
   * 既存チェインがある場合は削除してから再作成（冪等性確保）
   */
  async setupFilterChain(
    envId: string,
    resolvedRules: ResolvedRule[],
    containerSubnet: string
  ): Promise<void> {
    const chainName = buildChainName(envId);
    logger.info('Setting up filter chain', { chainName, envId, containerSubnet });

    // 既存チェインがあれば削除（冪等性確保）
    const existingChains = await this.listActiveChains();
    const chainExists = existingChains.some((c) => c.chainName === chainName);
    if (chainExists) {
      logger.info('Chain already exists, removing before recreating', { chainName });
      await this._removeChain(chainName);
    }

    // iptables-restore形式でルールを一括適用
    const rules = this.generateIptablesRules(chainName, resolvedRules, containerSubnet);
    logger.debug('Applying iptables rules', { chainName, rules });

    await this._execFileAsync('iptables-restore', ['--noflush'], { input: rules });

    logger.info('Filter chain setup complete', { chainName });
  }

  /**
   * 環境用のiptablesフィルタチェインを削除
   * チェインが存在しない場合はエラーを抑制（冪等性確保）
   */
  async removeFilterChain(envId: string): Promise<void> {
    const chainName = buildChainName(envId);
    logger.info('Removing filter chain', { chainName, envId });
    await this._removeChain(chainName);
  }

  /**
   * CWFILTER-プレフィックスを持ち、references==0のチェインを孤立チェインとしてクリーンアップ
   */
  async cleanupOrphanedChains(): Promise<void> {
    logger.info('Cleaning up orphaned iptables chains');
    const activeChains = await this.listActiveChains();

    // references==0のチェインのみ対象（使用中のチェインはスキップ）
    const orphanedChains = activeChains.filter((c) => c.ruleCount === 0);

    if (orphanedChains.length === 0) {
      logger.debug('No orphaned chains found');
      return;
    }

    for (const chain of orphanedChains) {
      logger.info('Removing orphaned chain', { chainName: chain.chainName });
      await this._removeChain(chain.chainName);
    }

    logger.info('Orphaned chain cleanup complete', { count: orphanedChains.length });
  }

  /**
   * 現在アクティブなCWFILTERフィルタチェイン一覧を取得
   */
  async listActiveChains(): Promise<ActiveChainInfo[]> {
    const { stdout } = await this._execFileAsync('iptables', ['-L', '-n']);
    return this._parseChains(stdout);
  }

  /**
   * iptables-restore形式のルールセットを生成
   */
  generateIptablesRules(
    chainName: string,
    resolvedRules: ResolvedRule[],
    containerSubnet: string
  ): string {
    const lines: string[] = [];

    lines.push('*filter');
    lines.push(`:${chainName} - [0:0]`);

    // DOCKER-USERからのジャンプ
    lines.push(`-I DOCKER-USER -s ${containerSubnet} -j ${chainName}`);

    // DNS許可
    lines.push(`-A ${chainName} -p udp --dport 53 -j ACCEPT`);
    lines.push(`-A ${chainName} -p tcp --dport 53 -j ACCEPT`);

    // 確立済み接続の許可
    lines.push(`-A ${chainName} -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT`);

    // ホワイトリストルール
    for (const rule of resolvedRules) {
      for (const ip of rule.ips) {
        if (rule.port !== null) {
          lines.push(`-A ${chainName} -d ${ip} -p tcp --dport ${rule.port} -j ACCEPT`);
        } else {
          lines.push(`-A ${chainName} -d ${ip} -j ACCEPT`);
        }
      }
    }

    // デフォルト拒否
    lines.push(`-A ${chainName} -j DROP`);

    lines.push('COMMIT');

    return lines.join('\n') + '\n';
  }

  /**
   * チェイン削除の内部処理（DOCKER-USERからのジャンプ削除、チェインflush、チェイン削除）
   * エラーは抑制（存在しない場合の冪等性）
   */
  private async _removeChain(chainName: string): Promise<void> {
    // DOCKER-USERからのジャンプルール削除
    // iptables -S DOCKER-USER でルール一覧を取得し、対象チェインへのジャンプを全て削除
    try {
      const { stdout } = await this._execFileAsync('iptables', ['-S', 'DOCKER-USER']);
      const jumpRules = stdout
        .split('\n')
        .filter((line) => line.includes(`-j ${chainName}`));

      for (const rule of jumpRules) {
        // "-A DOCKER-USER ..." を "-D DOCKER-USER ..." に変換して削除
        const deleteArgs = rule
          .replace(/^-A /, '-D ')
          .split(' ')
          .filter(Boolean);
        try {
          await this._execFileAsync('iptables', deleteArgs);
        } catch (err) {
          logger.debug('Failed to remove jump rule from DOCKER-USER', {
            chainName,
            rule,
            error: err,
          });
        }
      }
    } catch (err) {
      logger.debug('Failed to list DOCKER-USER rules (may not exist)', {
        chainName,
        error: err,
      });
    }

    // チェイン内ルール全削除
    try {
      await this._execFileAsync('iptables', ['-F', chainName]);
    } catch (err) {
      logger.debug('Failed to flush chain (may not exist)', { chainName, error: err });
    }

    // チェイン削除
    try {
      await this._execFileAsync('iptables', ['-X', chainName]);
    } catch (err) {
      logger.debug('Failed to delete chain (may not exist)', { chainName, error: err });
    }
  }

  /**
   * iptables -L -n の出力からCWFILTERチェインを抽出
   */
  private _parseChains(output: string): ActiveChainInfo[] {
    const chains: ActiveChainInfo[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      // 例: "Chain CWFILTER-aabbccdd (3 references)"
      const match = line.match(/^Chain (CWFILTER-([a-zA-Z0-9]+))\s+\((\d+) references?\)/);
      if (match) {
        chains.push({
          chainName: match[1],
          ruleCount: parseInt(match[3], 10),
          envIdPrefix: match[2],
        });
      }
    }

    return chains;
  }
}

export const iptablesManager = new IptablesManager();
