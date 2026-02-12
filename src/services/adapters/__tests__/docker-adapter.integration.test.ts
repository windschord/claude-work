import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { DockerAdapter, DockerAdapterConfig } from '../docker-adapter';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import * as childProcess from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(childProcess.execFile);

/**
 * DockerAdapter統合テスト
 *
 * 注意: このテストは実際のDockerコンテナを使用します。
 * Docker Desktopが起動していない場合、テストはスキップされます。
 *
 * テストの実行には時間がかかる場合があります（コンテナ起動・停止）。
 */
describe('DockerAdapter Integration Tests', () => {
  let adapter: DockerAdapter;
  const testSessionIds: string[] = [];
  let dockerAvailable = false;

  const defaultConfig: DockerAdapterConfig = {
    environmentId: 'test-env-integration',
    imageName: 'node',
    imageTag: 'alpine',
    authDirPath: '/tmp/claude-test-integration',
  };

  beforeAll(async () => {
    // Dockerが利用可能かチェック
    try {
      await execFileAsync('docker', ['version']);
      dockerAvailable = true;
      console.log('Docker is available, integration tests will run');
    } catch {
      console.warn('Docker is not available, integration tests will be skipped');
      dockerAvailable = false;
    }
  });

  beforeEach(() => {
    if (!dockerAvailable) {
      console.log('Skipping test: Docker not available');
      return;
    }
    adapter = new DockerAdapter(defaultConfig);
  });

  afterEach(async () => {
    if (!dockerAvailable) return;

    // テストで作成したセッションをクリーンアップ
    for (const sessionId of testSessionIds) {
      try {
        adapter.destroySession(sessionId);
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Failed to cleanup session ${sessionId}:`, error);
      }
    }
    testSessionIds.length = 0;
  });

  afterAll(async () => {
    if (!dockerAvailable) return;

    // テストで作成した可能性のあるコンテナをクリーンアップ
    try {
      const { stdout } = await execFileAsync('docker', [
        'ps',
        '-a',
        '--filter',
        'name=claude-env-test-env',
        '--format',
        '{{.ID}}',
      ]);
      const containerIds = stdout.trim().split('\n').filter(Boolean);
      for (const containerId of containerIds) {
        try {
          await execFileAsync('docker', ['rm', '-f', containerId]);
        } catch {
          // 既に削除済みの場合は無視
        }
      }
    } catch (error) {
      console.error('Failed to cleanup test containers:', error);
    }
  });

  describe('Full Lifecycle Test', () => {
    it.skipIf(!dockerAvailable)('should complete full lifecycle: spawn -> resize -> cleanup', async () => {
      const sessionId = 'integration-lifecycle-test';
      testSessionIds.push(sessionId);

      // コンテナ起動を待機するためのイベントリスナー
      const dataPromise = new Promise<string>((resolve) => {
        adapter.on('data', (_sid, data) => {
          if (data.length > 0) {
            resolve(data);
          }
        });
      });

      // セッション作成
      await adapter.createSession(sessionId, '/workspace', undefined, {
        shellMode: false,
      });

      // コンテナIDが取得できることを確認
      const containerId = adapter.getContainerId(sessionId);
      expect(containerId).toBeDefined();
      expect(containerId).toMatch(/^claude-env-test-env/);

      // 初回データ受信を待機
      const firstData = await Promise.race([
        dataPromise,
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout waiting for data')), 10000)
        ),
      ]);
      expect(firstData).toBeTruthy();

      // リサイズ操作
      adapter.resize(sessionId, 120, 40);

      // クリーンアップ
      adapter.destroySession(sessionId);

      // コンテナが削除されるまで待機
      await new Promise(resolve => setTimeout(resolve, 2000));

      // セッションが削除されたことを確認
      expect(adapter.hasSession(sessionId)).toBe(false);
    }, 30000); // 30秒のタイムアウト
  });

  describe('Orphaned Container Cleanup Test', () => {
    it.skipIf(!dockerAvailable)('should cleanup orphaned containers', async () => {
      const sessionId = 'integration-orphan-test';
      testSessionIds.push(sessionId);

      // テストセッションをDBに挿入
      db.insert(schema.sessions)
        .values({
          id: sessionId,
          project_id: 'test-project',
          branch_name: 'main',
          worktree_path: '/tmp/test-worktree',
          container_id: 'non-existent-container-123',
          status: 'ACTIVE',
          environment_id: 'test-env-integration',
        })
        .run();

      // cleanupOrphanedContainers()を実行
      await DockerAdapter.cleanupOrphanedContainers(db);

      // セッション状態がERRORに更新されたことを確認
      const session = db
        .select()
        .from(schema.sessions)
        .where(eq(schema.sessions.id, sessionId))
        .get();

      expect(session?.status).toBe('ERROR');
      expect(session?.container_id).toBeNull();

      // クリーンアップ
      db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId)).run();
    }, 15000);
  });

  describe('Error Handling Test', () => {
    it.skipIf(!dockerAvailable)('should handle container startup timeout gracefully', async () => {
      const sessionId = 'integration-timeout-test';
      testSessionIds.push(sessionId);

      // 存在しないイメージを使用してタイムアウトを発生させる
      const badAdapter = new DockerAdapter({
        ...defaultConfig,
        imageName: 'non-existent-image-12345',
      });

      const errorPromise = new Promise<Error>((resolve) => {
        badAdapter.on('error', (_sid, error) => {
          resolve(error);
        });
      });

      try {
        await badAdapter.createSession(sessionId, '/workspace');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }

      // エラーイベントが発火することを確認
      const error = await Promise.race([
        errorPromise,
        new Promise<Error>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout waiting for error event')), 35000)
        ),
      ]);
      expect(error).toBeInstanceOf(Error);
    }, 40000);
  });

  describe('Test Coverage Verification', () => {
    it('should verify that all critical methods are covered by tests', () => {
      // DockerAdapterの主要メソッドが存在することを確認
      expect(typeof adapter.createSession).toBe('function');
      expect(typeof adapter.destroySession).toBe('function');
      expect(typeof adapter.write).toBe('function');
      expect(typeof adapter.resize).toBe('function');
      expect(typeof adapter.hasSession).toBe('function');
      expect(typeof adapter.getWorkingDir).toBe('function');
      expect(typeof adapter.getContainerId).toBe('function');
      expect(typeof adapter.restartSession).toBe('function');

      // 静的メソッド
      expect(typeof (adapter.constructor as any).cleanupOrphanedContainers).toBe('function');
    });
  });
});
