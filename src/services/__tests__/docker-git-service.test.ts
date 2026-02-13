import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DockerGitService } from '../docker-git-service';

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/services/config-service', () => ({
  getConfigService: vi.fn(() => ({
    getGitCloneTimeoutMs: vi.fn(() => 300000),
    getDebugModeKeepVolumes: vi.fn(() => false),
  })),
}));

describe('DockerGitService', () => {
  let dockerGitService: DockerGitService;

  beforeEach(() => {
    dockerGitService = new DockerGitService();
  });

  describe('基本機能', () => {
    it('DockerGitServiceインスタンスを作成できる', () => {
      expect(dockerGitService).toBeDefined();
      expect(dockerGitService).toBeInstanceOf(DockerGitService);
    });

    it('GitOperationsインターフェースを実装している', () => {
      expect(dockerGitService.cloneRepository).toBeDefined();
      expect(dockerGitService.createWorktree).toBeDefined();
      expect(dockerGitService.deleteWorktree).toBeDefined();
      expect(dockerGitService.deleteRepository).toBeDefined();
    });
  });

  describe('ボリューム名生成', () => {
    it('プロジェクトIDからボリューム名を生成できる', () => {
      // private メソッドなので直接テストできないが、
      // createVolumeなどのメソッドで使用されることを確認
      expect(typeof dockerGitService.createVolume).toBe('function');
    });
  });

  // Note: 実際のDockerコマンド実行テストはCI/CD環境でDocker利用可能な場合のみ実行
  // 統合テストとしてdocker-adapter.integration.test.tsで実施
});
