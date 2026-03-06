import { createHash } from 'crypto';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import { logger } from '../lib/logger';
import { isRunningInDocker } from '../lib/environment-detect';

const execFileAsyncBase = promisify(execFile);

/**
 * execFileAsyncのラッパー。options.inputが指定された場合はspawnでstdinにデータを流す。
 * Node.jsのexecFileはinputオプションをサポートしないため、iptables-restore等のstdin入力が必要なコマンドに対応する。
 */
export async function execFileAsync(
  file: string,
  args?: readonly string[],
  options?: { input?: string }
): Promise<{ stdout: string; stderr: string }> {
  if (options?.input !== undefined) {
    return new Promise((resolve, reject) => {
      const child = spawn(file, args as string[]);
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
      child.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });
      child.on('close', (code) => {
        if (code === 0) resolve({ stdout, stderr });
        else reject(new Error(`${file} exited with code ${code}: ${stderr}`));
      });
      child.on('error', reject);
      child.stdin.write(options.input);
      child.stdin.end();
    });
  }
  return execFileAsyncBase(file, args as string[]);
}

export interface ResolvedRule {
  ips: string[];
  port: number | null;
  description?: string;
}

export interface ActiveChainInfo {
  chainName: string;
  referenceCount: number;
  envIdPrefix: string;
}

const CHAIN_PREFIX = 'CWFILTER-';
const IPTABLES_HOST_HELPER = '/usr/local/sbin/iptables-host.sh';

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
 *
 * Docker Compose環境ではコンテナ独自のネットワーク名前空間にはDOCKER-USERチェインが存在しない。
 * nsenterでホストのネットワーク名前空間に入り、iptablesを操作する。
 * 非rootユーザー(node)で実行するため、制限付きヘルパースクリプト(iptables-host.sh)経由で呼び出す。
 */
export class IptablesManager {
  private readonly _execFileAsync: ExecFileAsyncFn;
  private readonly _useNsenter: boolean;

  constructor(execFileAsyncFn?: ExecFileAsyncFn, options?: { useNsenter?: boolean }) {
    this._execFileAsync = execFileAsyncFn ?? (execFileAsync as unknown as ExecFileAsyncFn);
    if (options?.useNsenter !== undefined) {
      this._useNsenter = options.useNsenter;
    } else if (execFileAsyncFn) {
      // テスト等でexecFileAsyncFnが差し込まれる場合はデフォルトでnsenterを使用しない
      this._useNsenter = false;
    } else {
      // Docker環境ではヘルパースクリプト経由でnsenter実行
      this._useNsenter = isRunningInDocker();
    }
  }

  /**
   * iptablesコマンドを実行するヘルパー
   * Docker環境では sudo iptables-host.sh iptables 経由で実行
   */
  private _iptables(args: string[], options?: { input?: string }): Promise<{ stdout: string; stderr: string }> {
    if (this._useNsenter) {
      const sudoArgs = ['-n', IPTABLES_HOST_HELPER, 'iptables', ...args];
      return options
        ? this._execFileAsync('sudo', sudoArgs, options)
        : this._execFileAsync('sudo', sudoArgs);
    }
    return options
      ? this._execFileAsync('iptables', args, options)
      : this._execFileAsync('iptables', args);
  }

  /**
   * iptables-restoreコマンドを実行するヘルパー
   * Docker環境では sudo iptables-host.sh iptables-restore 経由で実行
   */
  private _iptablesRestore(args: string[], options?: { input?: string }): Promise<{ stdout: string; stderr: string }> {
    if (this._useNsenter) {
      const sudoArgs = ['-n', IPTABLES_HOST_HELPER, 'iptables-restore', ...args];
      return options
        ? this._execFileAsync('sudo', sudoArgs, options)
        : this._execFileAsync('sudo', sudoArgs);
    }
    return options
      ? this._execFileAsync('iptables-restore', args, options)
      : this._execFileAsync('iptables-restore', args);
  }

  /**
   * iptablesコマンドが利用可能かチェック（バイナリ存在 + 権限確認）
   */
  async checkAvailability(): Promise<boolean> {
    try {
      await this._iptables(['--version']);
      await this._iptablesRestore(['--version']);
      // 権限確認: DOCKER-USERチェインへのアクセスを検証
      await this._iptables(['-S', 'DOCKER-USER']);
      logger.debug('iptables and iptables-restore are available with sufficient permissions');
      return true;
    } catch (err) {
      logger.warn('iptables is not available or insufficient permissions', { error: err });
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

    await this._iptablesRestore(['--noflush'], { input: rules });

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
    const orphanedChains = activeChains.filter((c) => c.referenceCount === 0);

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
    const { stdout } = await this._iptables(['-L', '-n']);
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
   * 「存在しない」系エラーのみ抑制（冪等性）。権限不足等の想定外エラーは再スローする。
   */
  private async _removeChain(chainName: string): Promise<void> {
    // DOCKER-USERからのジャンプルール削除
    // iptables -S DOCKER-USER でルール一覧を取得し、対象チェインへのジャンプを全て削除
    try {
      const { stdout } = await this._iptables(['-S', 'DOCKER-USER']);
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
          await this._iptables(deleteArgs);
        } catch (err) {
          if (this._isNotFoundError(err)) {
            logger.debug('Jump rule already removed from DOCKER-USER', { chainName, rule });
          } else {
            throw err;
          }
        }
      }
    } catch (err) {
      if (this._isNotFoundError(err)) {
        logger.debug('DOCKER-USER chain does not exist, skipping jump rule cleanup', { chainName });
      } else {
        throw err;
      }
    }

    // チェイン内ルール全削除
    try {
      await this._iptables(['-F', chainName]);
    } catch (err) {
      if (this._isNotFoundError(err)) {
        logger.debug('Chain does not exist, skipping flush', { chainName });
      } else {
        throw err;
      }
    }

    // チェイン削除
    try {
      await this._iptables(['-X', chainName]);
    } catch (err) {
      if (this._isNotFoundError(err)) {
        logger.debug('Chain does not exist, skipping delete', { chainName });
      } else {
        throw err;
      }
    }
  }

  /**
   * iptablesの「存在しない」系エラーかを判定する。
   * チェインやルールが既に存在しない場合のエラーは冪等性のために抑制する。
   */
  private _isNotFoundError(err: unknown): boolean {
    const message = err instanceof Error ? err.message : String(err);
    return (
      message.includes('No chain/target/match') ||
      message.includes('does a matching rule exist') ||
      message.includes('does not exist') ||
      message.includes("doesn't exist")
    );
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
          referenceCount: parseInt(match[3], 10),
          envIdPrefix: match[2],
        });
      }
    }

    return chains;
  }
}

export const iptablesManager = new IptablesManager();
