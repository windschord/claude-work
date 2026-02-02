import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ExecutionEnvironment } from '@/lib/db';

// vi.hoistedでモッククラスを事前定義
const { MockHostAdapter, MockDockerAdapter } = vi.hoisted(() => {
  // コンストラクタ呼び出しをトラックするためにクラスをモック
  const MockHostAdapter = vi.fn();
  const MockDockerAdapter = vi.fn();
  return { MockHostAdapter, MockDockerAdapter };
});

vi.mock('../adapters/host-adapter', () => ({
  HostAdapter: MockHostAdapter,
}));

vi.mock('../adapters/docker-adapter', () => ({
  DockerAdapter: MockDockerAdapter,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// モジュールのインポートはモック設定の後
import { AdapterFactory } from '../adapter-factory';
import { HostAdapter } from '../adapters/host-adapter';
import { DockerAdapter } from '../adapters/docker-adapter';

describe('AdapterFactory', () => {
  beforeEach(() => {
    // 各テスト前にファクトリをリセット
    AdapterFactory.reset();
    vi.clearAllMocks();
  });

  afterEach(() => {
    AdapterFactory.reset();
  });

  describe('getAdapter - HOST環境', () => {
    it('HOST環境に対してHostAdapterを返す', () => {
      const environment: ExecutionEnvironment = {
        id: 'env-host-1',
        name: 'Host Environment',
        type: 'HOST',
        description: null,
        config: '{}',
        auth_dir_path: null,
        is_default: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const adapter = AdapterFactory.getAdapter(environment);

      expect(adapter).toBeDefined();
      expect(HostAdapter).toHaveBeenCalledTimes(1);
    });

    it('HostAdapterはシングルトンとして返される', () => {
      const environment1: ExecutionEnvironment = {
        id: 'env-host-1',
        name: 'Host Environment 1',
        type: 'HOST',
        description: null,
        config: '{}',
        auth_dir_path: null,
        is_default: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const environment2: ExecutionEnvironment = {
        id: 'env-host-2',
        name: 'Host Environment 2',
        type: 'HOST',
        description: null,
        config: '{}',
        auth_dir_path: null,
        is_default: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const adapter1 = AdapterFactory.getAdapter(environment1);
      const adapter2 = AdapterFactory.getAdapter(environment2);

      // 同じインスタンスが返される
      expect(adapter1).toBe(adapter2);
      // コンストラクタは1回のみ呼ばれる
      expect(HostAdapter).toHaveBeenCalledTimes(1);
    });
  });

  describe('getAdapter - DOCKER環境', () => {
    it('DOCKER環境に対してDockerAdapterを返す', () => {
      const environment: ExecutionEnvironment = {
        id: 'env-docker-1',
        name: 'Docker Environment',
        type: 'DOCKER',
        description: null,
        config: JSON.stringify({ imageName: 'my-image', imageTag: 'v1' }),
        auth_dir_path: '/data/environments/env-docker-1',
        is_default: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const adapter = AdapterFactory.getAdapter(environment);

      expect(adapter).toBeDefined();
      expect(DockerAdapter).toHaveBeenCalledTimes(1);
      expect(DockerAdapter).toHaveBeenCalledWith({
        environmentId: 'env-docker-1',
        imageName: 'my-image',
        imageTag: 'v1',
        authDirPath: '/data/environments/env-docker-1',
      });
    });

    it('DockerAdapterは環境IDごとにシングルトン', () => {
      const environment: ExecutionEnvironment = {
        id: 'env-docker-1',
        name: 'Docker Environment',
        type: 'DOCKER',
        description: null,
        config: JSON.stringify({ imageName: 'my-image', imageTag: 'v1' }),
        auth_dir_path: '/data/environments/env-docker-1',
        is_default: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const adapter1 = AdapterFactory.getAdapter(environment);
      const adapter2 = AdapterFactory.getAdapter(environment);

      // 同じインスタンスが返される
      expect(adapter1).toBe(adapter2);
      // コンストラクタは1回のみ呼ばれる
      expect(DockerAdapter).toHaveBeenCalledTimes(1);
    });

    it('異なる環境IDには異なるDockerAdapterが作成される', () => {
      const environment1: ExecutionEnvironment = {
        id: 'env-docker-1',
        name: 'Docker Environment 1',
        type: 'DOCKER',
        description: null,
        config: JSON.stringify({ imageName: 'image1', imageTag: 'v1' }),
        auth_dir_path: '/data/environments/env-docker-1',
        is_default: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const environment2: ExecutionEnvironment = {
        id: 'env-docker-2',
        name: 'Docker Environment 2',
        type: 'DOCKER',
        description: null,
        config: JSON.stringify({ imageName: 'image2', imageTag: 'v2' }),
        auth_dir_path: '/data/environments/env-docker-2',
        is_default: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const adapter1 = AdapterFactory.getAdapter(environment1);
      const adapter2 = AdapterFactory.getAdapter(environment2);

      // 異なるインスタンスが返される
      expect(adapter1).not.toBe(adapter2);
      // コンストラクタは2回呼ばれる
      expect(DockerAdapter).toHaveBeenCalledTimes(2);
    });

    it('configが空の場合はデフォルト値を使用する', () => {
      const environment: ExecutionEnvironment = {
        id: 'env-docker-default',
        name: 'Docker Environment Default',
        type: 'DOCKER',
        description: null,
        config: '{}',
        auth_dir_path: '/data/environments/env-docker-default',
        is_default: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      AdapterFactory.getAdapter(environment);

      expect(DockerAdapter).toHaveBeenCalledWith({
        environmentId: 'env-docker-default',
        imageName: 'claude-code-sandboxed',
        imageTag: 'latest',
        authDirPath: '/data/environments/env-docker-default',
      });
    });
  });

  describe('getAdapter - SSH環境', () => {
    it('SSH環境に対してはエラーを投げる', () => {
      const environment: ExecutionEnvironment = {
        id: 'env-ssh-1',
        name: 'SSH Environment',
        type: 'SSH',
        description: null,
        config: '{}',
        auth_dir_path: null,
        is_default: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      expect(() => AdapterFactory.getAdapter(environment)).toThrow(
        'SSH adapter is not yet implemented'
      );
    });
  });

  describe('getAdapter - 未知の環境タイプ', () => {
    it('未知の環境タイプに対してはエラーを投げる', () => {
      const environment = {
        id: 'env-unknown-1',
        name: 'Unknown Environment',
        type: 'UNKNOWN',
        description: null,
        config: '{}',
        auth_dir_path: null,
        is_default: false,
        created_at: new Date(),
        updated_at: new Date(),
      } as ExecutionEnvironment;

      expect(() => AdapterFactory.getAdapter(environment)).toThrow(
        'Unknown environment type: UNKNOWN'
      );
    });
  });

  describe('removeDockerAdapter', () => {
    it('登録されているDockerAdapterを削除できる', () => {
      const environment: ExecutionEnvironment = {
        id: 'env-docker-remove',
        name: 'Docker Environment',
        type: 'DOCKER',
        description: null,
        config: JSON.stringify({ imageName: 'my-image', imageTag: 'v1' }),
        auth_dir_path: '/data/environments/env-docker-remove',
        is_default: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      // アダプターを作成
      AdapterFactory.getAdapter(environment);
      expect(AdapterFactory.getDockerAdapterCount()).toBe(1);

      // 削除
      AdapterFactory.removeDockerAdapter('env-docker-remove');
      expect(AdapterFactory.getDockerAdapterCount()).toBe(0);
    });

    it('存在しない環境IDを削除しても何も起きない', () => {
      expect(() => {
        AdapterFactory.removeDockerAdapter('non-existent-id');
      }).not.toThrow();
    });

    it('削除後に同じ環境を取得すると新しいアダプターが作成される', () => {
      const environment: ExecutionEnvironment = {
        id: 'env-docker-recreate',
        name: 'Docker Environment',
        type: 'DOCKER',
        description: null,
        config: JSON.stringify({ imageName: 'my-image', imageTag: 'v1' }),
        auth_dir_path: '/data/environments/env-docker-recreate',
        is_default: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      // 最初のアダプター作成
      const adapter1 = AdapterFactory.getAdapter(environment);

      // 削除
      AdapterFactory.removeDockerAdapter('env-docker-recreate');

      // 再度取得すると新しいアダプターが作成される
      const adapter2 = AdapterFactory.getAdapter(environment);

      expect(adapter1).not.toBe(adapter2);
      expect(DockerAdapter).toHaveBeenCalledTimes(2);
    });
  });

  describe('getDockerAdapterCount', () => {
    it('登録されているDockerAdapterの数を返す', () => {
      expect(AdapterFactory.getDockerAdapterCount()).toBe(0);

      const environment1: ExecutionEnvironment = {
        id: 'env-docker-count-1',
        name: 'Docker Environment 1',
        type: 'DOCKER',
        description: null,
        config: '{}',
        auth_dir_path: '/data/environments/env-docker-count-1',
        is_default: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const environment2: ExecutionEnvironment = {
        id: 'env-docker-count-2',
        name: 'Docker Environment 2',
        type: 'DOCKER',
        description: null,
        config: '{}',
        auth_dir_path: '/data/environments/env-docker-count-2',
        is_default: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      AdapterFactory.getAdapter(environment1);
      expect(AdapterFactory.getDockerAdapterCount()).toBe(1);

      AdapterFactory.getAdapter(environment2);
      expect(AdapterFactory.getDockerAdapterCount()).toBe(2);
    });
  });

  describe('reset', () => {
    it('全てのアダプターをリセットする', () => {
      const hostEnv: ExecutionEnvironment = {
        id: 'env-host-reset',
        name: 'Host Environment',
        type: 'HOST',
        description: null,
        config: '{}',
        auth_dir_path: null,
        is_default: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const dockerEnv: ExecutionEnvironment = {
        id: 'env-docker-reset',
        name: 'Docker Environment',
        type: 'DOCKER',
        description: null,
        config: '{}',
        auth_dir_path: '/data/environments/env-docker-reset',
        is_default: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      // アダプターを作成
      AdapterFactory.getAdapter(hostEnv);
      AdapterFactory.getAdapter(dockerEnv);

      expect(HostAdapter).toHaveBeenCalledTimes(1);
      expect(DockerAdapter).toHaveBeenCalledTimes(1);
      expect(AdapterFactory.getDockerAdapterCount()).toBe(1);

      // リセット
      AdapterFactory.reset();

      expect(AdapterFactory.getDockerAdapterCount()).toBe(0);

      // リセット後に再度取得すると新しいアダプターが作成される
      AdapterFactory.getAdapter(hostEnv);
      AdapterFactory.getAdapter(dockerEnv);

      expect(HostAdapter).toHaveBeenCalledTimes(2);
      expect(DockerAdapter).toHaveBeenCalledTimes(2);
    });
  });
});
