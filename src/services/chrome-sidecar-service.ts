import { DockerClient } from './docker-client';
import { logger } from '@/lib/logger';
import { db, schema } from '@/lib/db';
import { eq, isNotNull } from 'drizzle-orm';
import type { ChromeSidecarConfig } from '@/types/environment';

/** Chromeコンテナのメモリ制限 (512MB) */
const CHROME_MEMORY_LIMIT = 512 * 1024 * 1024;

/**
 * サイドカー起動結果
 */
export interface SidecarStartResult {
  /** 起動成功かどうか */
  success: boolean;
  /** Chromeコンテナ名 (成功時) */
  containerName?: string;
  /** ネットワーク名 (成功時) */
  networkName?: string;
  /** ホスト側デバッグポート (ポートマッピング成功時) */
  debugPort?: number;
  /** Chrome内部URL (Claude CodeからのCDP接続先) */
  browserUrl?: string;
  /** 失敗理由 (失敗時) */
  error?: string;
}

/**
 * startSidecar のオプション
 */
export interface StartSidecarOptions {
  /** CDPヘルスチェックのタイムアウト (ミリ秒)。デフォルト: 30000 */
  cdpTimeoutMs?: number;
}

/**
 * ChromeSidecarService
 *
 * セッション単位のChromeサイドカーコンテナを管理する。
 * DockerClientを使用してDocker APIと通信する。
 */
export class ChromeSidecarService {
  private static instance: ChromeSidecarService;

  public static getInstance(): ChromeSidecarService {
    if (!ChromeSidecarService.instance) {
      ChromeSidecarService.instance = new ChromeSidecarService();
    }
    return ChromeSidecarService.instance;
  }

  /** @internal テスト専用: シングルトンインスタンスをリセット */
  public static resetInstance(): void {
    ChromeSidecarService.instance = undefined as unknown as ChromeSidecarService;
  }

  private getContainerName(sessionId: string): string {
    return `cw-chrome-${sessionId}`;
  }

  private getNetworkName(sessionId: string): string {
    return `cw-net-${sessionId}`;
  }

  /**
   * サイドカーChromeを起動する
   */
  async startSidecar(
    sessionId: string,
    config: ChromeSidecarConfig,
    options?: StartSidecarOptions
  ): Promise<SidecarStartResult> {
    const containerName = this.getContainerName(sessionId);
    const networkName = this.getNetworkName(sessionId);
    const cdpTimeoutMs = options?.cdpTimeoutMs ?? 30000;
    const docker = DockerClient.getInstance();

    // 1. ネットワーク作成
    let network;
    try {
      network = await docker.getDockerInstance().createNetwork({
        Name: networkName,
        Driver: 'bridge',
        Labels: {
          'claude-work.session-id': sessionId,
          'claude-work.managed-by': 'claude-work',
        },
      });
    } catch (error) {
      logger.error('ChromeSidecarService: Failed to create network', {
        sessionId,
        networkName,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network creation failed',
      };
    }

    // 2. コンテナ作成
    let container;
    try {
      container = await docker.createContainer({
        name: containerName,
        Image: `${config.image}:${config.tag}`,
        // Entrypoint/Cmdを明示的に指定し、イメージのデフォルトCMD(claude等)を上書き
        Entrypoint: ['/usr/bin/chromium'],
        Cmd: [
          '--headless',
          '--no-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--remote-debugging-address=0.0.0.0',
          '--remote-debugging-port=9222',
        ],
        ExposedPorts: {
          '9222/tcp': {},
        },
        Labels: {
          'claude-work.session-id': sessionId,
          'claude-work.chrome-sidecar': 'true',
          'claude-work.managed-by': 'claude-work',
        },
        HostConfig: {
          PortBindings: {
            '9222/tcp': [{ HostPort: '', HostIp: '127.0.0.1' }],
          },
          CapDrop: ['ALL'],
          SecurityOpt: ['no-new-privileges'],
          Memory: CHROME_MEMORY_LIMIT,
          AutoRemove: true,
          NetworkMode: networkName,
        },
      });
    } catch (error) {
      logger.error('ChromeSidecarService: Failed to create container', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      // ロールバック: ネットワーク削除
      try {
        await network.remove();
      } catch (cleanupError) {
        logger.warn('ChromeSidecarService: Failed to cleanup network after container creation failure', {
          sessionId,
          cleanupError: cleanupError instanceof Error ? cleanupError.message : 'Unknown',
        });
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Container creation failed',
      };
    }

    // 3. コンテナ起動
    try {
      await container.start();
    } catch (error) {
      logger.error('ChromeSidecarService: Failed to start container', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      // ロールバック: コンテナ削除（AutoRemoveは起動後停止時にのみ効くため、未起動コンテナは手動削除が必要）
      try {
        await container.remove({ force: true });
      } catch (containerCleanupError) {
        logger.warn('ChromeSidecarService: Failed to cleanup container after start failure', {
          sessionId,
          containerCleanupError: containerCleanupError instanceof Error ? containerCleanupError.message : 'Unknown',
        });
      }
      // ロールバック: ネットワーク削除
      try {
        await network.remove();
      } catch (cleanupError) {
        logger.warn('ChromeSidecarService: Failed to cleanup network after container start failure', {
          sessionId,
          cleanupError: cleanupError instanceof Error ? cleanupError.message : 'Unknown',
        });
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Container start failed',
      };
    }

    // 4. ポートマッピング取得（CDPヘルスチェックに必要）
    let debugPort: number | undefined;
    try {
      const containerRef = docker.getContainer(containerName);
      const inspectInfo = await containerRef.inspect();
      const portBindings = inspectInfo.NetworkSettings?.Ports?.['9222/tcp'];
      if (portBindings && portBindings.length > 0 && portBindings[0].HostPort) {
        debugPort = parseInt(portBindings[0].HostPort, 10);
      }
    } catch (error) {
      logger.warn('ChromeSidecarService: Failed to get port mapping', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }

    // 5. CDPヘルスチェック（ホスト側ポート経由でHTTP GETポーリング）
    // debugPort未取得時はCDPヘルスチェックをスキップし、コンテナRunning確認のみで成功とする。
    // ポートマッピング失敗時もサイドカーは起動し、chrome_debug_port=NULLで動作継続する。
    if (debugPort) {
      const cdpReady = await this.waitForCDP(debugPort, cdpTimeoutMs);
      if (!cdpReady) {
        logger.warn('ChromeSidecarService: CDP health check timed out', { sessionId, debugPort });
        // クリーンアップ
        try {
          const containerRef = docker.getContainer(containerName);
          await containerRef.stop();
        } catch {
          // AutoRemoveで既に消えている可能性あり
        }
        try {
          await network.remove();
        } catch {
          // best-effort
        }
        return {
          success: false,
          error: `CDP health check timed out after ${cdpTimeoutMs}ms`,
        };
      }
    } else {
      logger.warn('ChromeSidecarService: No debug port available, skipping CDP health check', {
        sessionId,
        containerName,
      });
    }

    // chrome-devtools-mcpがベースURLを受け取り、内部で/json/versionから完全なbrowserUrlを取得する
    const browserUrl = `http://${containerName}:9222`;

    logger.info('ChromeSidecarService: Sidecar started successfully', {
      sessionId,
      containerName,
      networkName,
      debugPort,
      browserUrl,
    });

    return {
      success: true,
      containerName,
      networkName,
      debugPort,
      browserUrl,
    };
  }

  /**
   * サイドカーChromeを停止・削除する
   *
   * @returns 成功/失敗を示すオブジェクト。失敗時はerrorにメッセージを含む。
   */
  async stopSidecar(
    sessionId: string,
    containerName: string,
    networkName?: string
  ): Promise<{ success: boolean; error?: string }> {
    const docker = DockerClient.getInstance();
    const resolvedNetworkName = networkName ?? this.getNetworkName(sessionId);
    const errors: string[] = [];

    // コンテナ停止
    // AutoRemove=trueのコンテナは停止時に自動削除される。
    // 既に削除済みのコンテナに対するstop()は404/304/No such containerエラーを返すため、
    // これらは成功扱いとする（DockerAdapter.stopContainer()と同様のパターン）。
    try {
      const container = docker.getContainer(containerName);
      await container.stop();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown';
      const isAlreadyGone =
        msg.includes('404') ||
        msg.includes('304') ||
        msg.includes('No such container') ||
        msg.includes('not running');
      if (!isAlreadyGone) {
        logger.warn('ChromeSidecarService: Failed to stop chrome container', {
          sessionId,
          containerName,
          error: msg,
        });
        errors.push(`container stop: ${msg}`);
      } else {
        logger.info('ChromeSidecarService: Chrome container already removed (AutoRemove)', {
          sessionId,
          containerName,
        });
      }
    }

    // ネットワーク: 接続中コンテナをbest-effortでdisconnect
    try {
      const network = docker.getDockerInstance().getNetwork(resolvedNetworkName);
      const networkInfo = await network.inspect();
      const containers = networkInfo.Containers || {};
      for (const containerId of Object.keys(containers)) {
        try {
          await network.disconnect({ Container: containerId, Force: true });
        } catch {
          // best-effort
        }
      }
      await network.remove();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown';
      logger.warn('ChromeSidecarService: Failed to remove network', {
        sessionId,
        networkName: resolvedNetworkName,
        error: msg,
      });
      errors.push(`network remove: ${msg}`);
    }

    if (errors.length > 0) {
      return { success: false, error: errors.join('; ') };
    }
    return { success: true };
  }

  /**
   * Claude Codeコンテナをサイドカーネットワークに接続する
   */
  async connectClaudeContainer(
    claudeContainerName: string,
    networkName: string
  ): Promise<void> {
    const docker = DockerClient.getInstance();
    const network = docker.getDockerInstance().getNetwork(networkName);
    await network.connect({
      Container: claudeContainerName,
    });
  }

  /**
   * 孤立したChromeコンテナ・ネットワークをクリーンアップする
   */
  async cleanupOrphaned(): Promise<void> {
    const docker = DockerClient.getInstance();

    // Phase 1: DBベースのクリーンアップ
    const sessionsWithChrome = db.select({
      id: schema.sessions.id,
      chrome_container_id: schema.sessions.chrome_container_id,
    })
      .from(schema.sessions)
      .where(isNotNull(schema.sessions.chrome_container_id))
      .all();

    for (const session of sessionsWithChrome) {
      if (!session.chrome_container_id) continue;

      try {
        const container = docker.getContainer(session.chrome_container_id);
        const inspectInfo = await container.inspect();

        if (inspectInfo.State?.Running) {
          // 実行中のコンテナはスキップ
          continue;
        }
      } catch {
        // コンテナが存在しない（AutoRemoveで削除済み等）
      }

      // 停止済みまたは存在しないコンテナ: DB更新とネットワーク削除
      try {
        const networkName = this.getNetworkName(session.id);
        const network = docker.getDockerInstance().getNetwork(networkName);
        await network.remove();
      } catch {
        // ネットワークも既に削除済みの場合がある
      }

      db.update(schema.sessions)
        .set({
          chrome_container_id: null,
          chrome_debug_port: null,
          updated_at: new Date(),
        })
        .where(eq(schema.sessions.id, session.id))
        .run();

      logger.info('ChromeSidecarService: Cleaned up orphaned sidecar from DB', {
        sessionId: session.id,
        chromeContainerId: session.chrome_container_id,
      });
    }

    // Phase 2: ラベルベースのクリーンアップ
    try {
      const sidecarContainers = await docker.listContainers({
        all: true,
        filters: JSON.stringify({
          label: ['claude-work.chrome-sidecar=true'],
        }),
      });

      for (const containerInfo of sidecarContainers) {
        const containerSessionId = containerInfo.Labels?.['claude-work.session-id'];
        if (!containerSessionId) continue;

        // DBにセッションが存在するか確認
        const sessionExists = db.select({ id: schema.sessions.id })
          .from(schema.sessions)
          .where(eq(schema.sessions.id, containerSessionId))
          .get();

        if (!sessionExists) {
          // 孤立コンテナを停止
          try {
            const container = docker.getContainer(containerInfo.Id);
            await container.stop();
            logger.info('ChromeSidecarService: Stopped orphaned sidecar container', {
              containerId: containerInfo.Id,
              sessionId: containerSessionId,
            });
          } catch {
            // 既に停止済みの場合がある
          }

          // 孤立ネットワークも削除
          try {
            const networkName = this.getNetworkName(containerSessionId);
            const network = docker.getDockerInstance().getNetwork(networkName);
            await network.remove();
            logger.info('ChromeSidecarService: Removed orphaned sidecar network', {
              networkName,
              sessionId: containerSessionId,
            });
          } catch {
            // ネットワークが既に削除済みの場合がある
          }
        }
      }
    } catch (error) {
      logger.warn('ChromeSidecarService: Label-based cleanup failed', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }

    // Phase 2b: 孤立ネットワークの回収
    try {
      const networks = await docker.getDockerInstance().listNetworks({
        filters: JSON.stringify({
          label: ['claude-work.managed-by=claude-work'],
        }),
      });

      for (const networkInfo of networks) {
        // cw-net- プレフィックスのネットワークのみ対象
        if (!networkInfo.Name?.startsWith('cw-net-')) continue;

        try {
          const network = docker.getDockerInstance().getNetwork(networkInfo.Id);
          const detail = await network.inspect();
          const connectedContainers = Object.keys(detail.Containers || {});

          if (connectedContainers.length === 0) {
            await network.remove();
            logger.info('ChromeSidecarService: Removed orphaned network', {
              networkName: networkInfo.Name,
              networkId: networkInfo.Id,
            });
          }
        } catch {
          // best-effort: ネットワークが既に削除済みの場合がある
        }
      }
    } catch (error) {
      logger.warn('ChromeSidecarService: Orphaned network cleanup failed', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
  }

  /**
   * 現在起動中のサイドカー数を取得する
   */
  async getActiveSidecarCount(): Promise<number> {
    const docker = DockerClient.getInstance();
    const containers = await docker.listContainers({
      filters: JSON.stringify({
        label: ['claude-work.chrome-sidecar=true'],
        status: ['running'],
      }),
    });
    return containers.length;
  }

  /**
   * CDPヘルスチェック（内部メソッド）
   *
   * ホスト側ポート経由で http://127.0.0.1:<debugPort>/json/version に
   * HTTP GETポーリングし、CDPが実際に応答可能か検証する。
   */
  private async waitForCDP(
    debugPort: number,
    timeoutMs: number
  ): Promise<boolean> {

    const startTime = Date.now();
    const interval = 1000;
    const url = `http://127.0.0.1:${debugPort}/json/version`;

    while (Date.now() - startTime < timeoutMs) {
      try {
        const controller = new AbortController();
        // 個々のfetchタイムアウト: ポーリング間隔以下に設定し重複を防ぐ
        const fetchTimeout = setTimeout(() => controller.abort(), interval);
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(fetchTimeout);
        if (response.ok) {
          return true;
        }
      } catch {
        // CDPがまだ準備中
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }

    return false;
  }
}
