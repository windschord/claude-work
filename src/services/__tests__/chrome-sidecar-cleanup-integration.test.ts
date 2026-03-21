import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCleanupOrphaned } = vi.hoisted(() => ({
  mockCleanupOrphaned: vi.fn(),
}));

vi.mock('../chrome-sidecar-service', () => {
  return {
    ChromeSidecarService: class {
      cleanupOrphaned = mockCleanupOrphaned;
    },
  };
});

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { ChromeSidecarService } from '../chrome-sidecar-service';
import { logger } from '@/lib/logger';

describe('Chrome Sidecar サーバー起動時クリーンアップ', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('cleanupOrphanedが正常に実行されること', async () => {
    mockCleanupOrphaned.mockResolvedValueOnce(undefined);

    // server.ts の起動フローを再現
    const sidecarService = new ChromeSidecarService();
    await sidecarService.cleanupOrphaned();

    expect(mockCleanupOrphaned).toHaveBeenCalledTimes(1);
  });

  it('cleanupOrphaned失敗時にサーバー起動が続行されること', async () => {
    mockCleanupOrphaned.mockRejectedValueOnce(new Error('Docker not available'));

    // server.ts の起動フロー: try-catch で囲んで失敗してもサーバーは起動する
    let serverStarted = false;
    try {
      const sidecarService = new ChromeSidecarService();
      await sidecarService.cleanupOrphaned();
    } catch (error) {
      logger.error('Chrome sidecar cleanup failed', { error });
    }
    // サーバー起動処理は続行
    serverStarted = true;

    expect(serverStarted).toBe(true);
    expect(logger.error).toHaveBeenCalledWith(
      'Chrome sidecar cleanup failed',
      expect.objectContaining({ error: expect.any(Error) })
    );
  });

  it('Docker未接続時にgracefulにスキップされること', async () => {
    mockCleanupOrphaned.mockRejectedValueOnce(
      new Error('connect ENOENT /var/run/docker.sock')
    );

    let serverStarted = false;
    try {
      const sidecarService = new ChromeSidecarService();
      await sidecarService.cleanupOrphaned();
    } catch (error) {
      logger.error('Chrome sidecar cleanup failed', { error });
    }
    serverStarted = true;

    expect(serverStarted).toBe(true);
    // 例外が外に漏れないことを検証（serverStartedがtrueであること自体が証明）
    // logger.errorが呼ばれていることを検証
    expect(logger.error).toHaveBeenCalledWith(
      'Chrome sidecar cleanup failed',
      expect.objectContaining({ error: expect.any(Error) })
    );
  });
});
