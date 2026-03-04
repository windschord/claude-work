import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// vi.hoistedでモックを先に初期化
const {
  mockDbSelectGet,
  mockDbSelectAll,
  mockDbInsertGet,
  mockDbInsertRun,
  mockDbUpdateGet,
  mockDbUpdateRun,
  mockDbDeleteRun,
  mockMkdir,
  mockRm,
  mockAccess,
  mockLogger,
  mockDockerClient,
  mockIsHostEnvironmentAllowed,
} = vi.hoisted(() => ({
  mockDbSelectGet: vi.fn(),
  mockDbSelectAll: vi.fn(),
  mockDbInsertGet: vi.fn(),
  mockDbInsertRun: vi.fn(),
  mockDbUpdateGet: vi.fn(),
  mockDbUpdateRun: vi.fn(),
  mockDbDeleteRun: vi.fn(),
  mockMkdir: vi.fn(),
  mockRm: vi.fn(),
  mockAccess: vi.fn(),
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  mockDockerClient: {
    info: vi.fn(),
    inspectImage: vi.fn(),
    createVolume: vi.fn(),
    removeVolume: vi.fn(),
  },
  mockIsHostEnvironmentAllowed: vi.fn(() => true),
}));

// Drizzle DBのモック
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          get: mockDbSelectGet,
          all: mockDbSelectAll,
        })),
        orderBy: vi.fn(() => ({
          all: mockDbSelectAll,
        })),
        get: mockDbSelectGet,
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => ({
          get: mockDbInsertGet,
        })),
        run: mockDbInsertRun,
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => ({
            get: mockDbUpdateGet,
          })),
          run: mockDbUpdateRun,
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => ({
        run: mockDbDeleteRun,
      })),
    })),
    transaction: vi.fn((callback: (tx: unknown) => unknown) => callback({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            get: mockDbSelectGet,
            all: mockDbSelectAll,
          })),
          orderBy: vi.fn(() => ({
            all: mockDbSelectAll,
          })),
          get: mockDbSelectGet,
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            run: mockDbUpdateRun,
          })),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn(() => ({
            get: mockDbInsertGet,
          })),
        })),
      })),
      delete: vi.fn(() => ({
        where: vi.fn(() => ({
          run: mockDbDeleteRun,
        })),
      })),
    })),
  },
  schema: {
    executionEnvironments: { id: 'id' },
    sessions: { project_id: 'project_id', environment_id: 'environment_id', id: 'id', status: 'status' },
    projects: { id: 'id', environment_id: 'environment_id' },
  },
}));

vi.mock('drizzle-orm', () => {
  const mockSql = Object.assign(
    vi.fn((strings, ...values) => ({ strings, values })),
    {
      join: vi.fn(() => ({})),
    }
  );

  return {
    eq: vi.fn((col, val) => ({ column: col, value: val })),
    and: vi.fn((...conditions) => ({ type: 'and', conditions })),
    inArray: vi.fn((col, values) => ({ column: col, values })),
    asc: vi.fn((col) => ({ column: col, direction: 'asc' })),
    count: vi.fn(() => 'count'),
    sql: mockSql,
  };
});

// loggerのモック
vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
}));

// fs/promisesのモック
vi.mock('fs/promises', () => ({
  mkdir: mockMkdir,
  rm: mockRm,
  access: mockAccess,
  default: {
    mkdir: mockMkdir,
    rm: mockRm,
    access: mockAccess,
  },
}));

// DockerClientのモック
vi.mock('../docker-client', () => ({
  DockerClient: {
    getInstance: () => mockDockerClient,
  },
}));

// environment-detectのモック
vi.mock('@/lib/environment-detect', () => ({
  isHostEnvironmentAllowed: mockIsHostEnvironmentAllowed,
  isRunningInDocker: vi.fn(() => false),
}));

import {
  EnvironmentService,
  CreateEnvironmentInput,
  UpdateEnvironmentInput,
} from '../environment-service';

describe('EnvironmentService', () => {
  let service: EnvironmentService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new EnvironmentService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('環境を正常に作成できる', async () => {
      const input: CreateEnvironmentInput = {
        name: 'Test Docker',
        type: 'DOCKER',
        description: 'Test Docker environment',
        config: { imageName: 'test-image' },
      };

      const expectedResult = {
        id: 'test-id-123',
        name: 'Test Docker',
        type: 'DOCKER',
        description: 'Test Docker environment',
        config: JSON.stringify({ imageName: 'test-image' }),
        auth_dir_path: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDbInsertGet.mockReturnValue(expectedResult);

      const result = await service.create(input);

      expect(result).toEqual(expectedResult);
    });

    it('configがオブジェクトの場合はJSON文字列に変換される', async () => {
      const input: CreateEnvironmentInput = {
        name: 'Test',
        type: 'HOST',
        config: { key: 'value', nested: { foo: 'bar' } },
      };

      mockDbInsertGet.mockReturnValue({
        id: 'id',
        name: 'Test',
        type: 'HOST',
        description: null,
        config: JSON.stringify(input.config),
        auth_dir_path: null,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const result = await service.create(input);

      expect(result.config).toBe(JSON.stringify({ key: 'value', nested: { foo: 'bar' } }));
    });
  });

  describe('findById', () => {
    it('IDで環境を取得できる', async () => {
      const expectedEnv = {
        id: 'env-123',
        name: 'Test Env',
        type: 'DOCKER',
        description: null,
        config: '{}',
        auth_dir_path: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDbSelectGet.mockReturnValue(expectedEnv);

      const result = await service.findById('env-123');

      expect(result).toEqual(expectedEnv);
    });

    it('存在しないIDの場合はnullを返す', async () => {
      mockDbSelectGet.mockReturnValue(undefined);

      const result = await service.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('全ての環境を取得できる', async () => {
      const environments = [
        {
          id: 'env-1',
          name: 'Host Default',
          type: 'HOST',
          description: null,
          config: '{}',
          auth_dir_path: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 'env-2',
          name: 'Docker Dev',
          type: 'DOCKER',
          description: 'Development Docker',
          config: '{"imageName":"dev-image"}',
          auth_dir_path: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockDbSelectAll.mockReturnValue(environments);

      const result = await service.findAll();

      expect(result).toEqual(environments);
    });

    it('環境がない場合は空配列を返す', async () => {
      mockDbSelectAll.mockReturnValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('update', () => {
    it('環境を更新できる', async () => {
      const input: UpdateEnvironmentInput = {
        name: 'Updated Name',
        description: 'Updated description',
      };

      const updatedEnv = {
        id: 'env-123',
        name: 'Updated Name',
        type: 'DOCKER',
        description: 'Updated description',
        config: '{}',
        auth_dir_path: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDbUpdateGet.mockReturnValue(updatedEnv);

      const result = await service.update('env-123', input);

      expect(result).toEqual(updatedEnv);
    });

    it('configを更新する場合はJSON文字列に変換される', async () => {
      const input: UpdateEnvironmentInput = {
        config: { newKey: 'newValue' },
      };

      mockDbUpdateGet.mockReturnValue({
        id: 'env-123',
        name: 'Test',
        type: 'DOCKER',
        description: null,
        config: JSON.stringify(input.config),
        auth_dir_path: null,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const result = await service.update('env-123', input);

      expect(result.config).toBe(JSON.stringify({ newKey: 'newValue' }));
    });
  });

  describe('delete', () => {
    it('環境を削除できる', async () => {
      // デフォルトではない環境
      const env = {
        id: 'env-123',
        name: 'Test Env',
        type: 'DOCKER',
        description: null,
        config: '{}',
        auth_dir_path: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      // findById用のモック（最初の呼び出し）
      mockDbSelectGet.mockReturnValueOnce(env);
      // projects取得用のモック（この環境を使うプロジェクトはなし）
      mockDbSelectAll.mockReturnValueOnce([]);
      // sessions取得用のモック（この環境を使うセッションはなし）
      mockDbSelectAll.mockReturnValueOnce([]);

      await service.delete('env-123');

      expect(mockDbDeleteRun).toHaveBeenCalled();
    });

    it('使用中のプロジェクトがある場合は削除を拒否する', async () => {
      // findById用のモック
      mockDbSelectGet.mockReturnValueOnce({
        id: 'env-123',
        name: 'Test Env',
        type: 'DOCKER',
        description: null,
        config: '{}',
        auth_dir_path: null,
        created_at: new Date(),
        updated_at: new Date(),
      });
      // projects取得用のモック（この環境を使うプロジェクトが2つ）
      mockDbSelectAll.mockReturnValueOnce([
        { id: 'proj-1', name: 'Project A' },
        { id: 'proj-2', name: 'Project B' },
      ]);

      await expect(service.delete('env-123')).rejects.toThrow(
        'この環境は以下のプロジェクトで使用中のため削除できません: Project A, Project B'
      );

      expect(mockDbDeleteRun).not.toHaveBeenCalled();
    });

    it('使用中のセッションがある場合は削除を拒否する', async () => {
      mockDbSelectGet.mockReturnValueOnce({
        id: 'env-123',
        name: 'Test Env',
        type: 'DOCKER',
        description: null,
        config: '{}',
        auth_dir_path: null,
        created_at: new Date(),
        updated_at: new Date(),
      });
      // projects取得用のモック（空）
      mockDbSelectAll.mockReturnValueOnce([]);
      // sessions取得用のモック（この環境を使うセッションが2つ）
      mockDbSelectAll.mockReturnValueOnce([
        { id: 'session-1' },
        { id: 'session-2' },
      ]);

      await expect(service.delete('env-123')).rejects.toThrow(
        'この環境は 2 件のアクティブなセッションで使用中のため削除できません'
      );

      // アクティブ状態フィルタが適用されていることを検証
      const { inArray } = await import('drizzle-orm');
      expect(inArray).toHaveBeenCalledWith('status', ['running', 'initializing']);

      expect(mockDbDeleteRun).not.toHaveBeenCalled();
    });

    it('存在しない環境の削除はエラーになる', async () => {
      mockDbSelectGet.mockReturnValueOnce(undefined);
      // projects取得用のモック（空）
      mockDbSelectAll.mockReturnValueOnce([]);

      await expect(service.delete('non-existent')).rejects.toThrow(
        '環境が見つかりません'
      );

      expect(mockDbDeleteRun).not.toHaveBeenCalled();
    });
  });

  describe('checkStatus', () => {
    it('HOST環境の場合は常に利用可能', async () => {
      mockDbSelectGet.mockReturnValue({
        id: 'host-default',
        name: 'Local Host',
        type: 'HOST',
        description: null,
        config: '{}',
        auth_dir_path: null,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const status = await service.checkStatus('host-default');

      expect(status).toEqual({
        available: true,
        authenticated: true,
      });
    });

    it('存在しない環境の場合はエラー', async () => {
      mockDbSelectGet.mockReturnValue(undefined);

      const status = await service.checkStatus('non-existent');

      expect(status).toEqual({
        available: false,
        authenticated: false,
        error: '環境が見つかりません',
      });
    });

    it('DOCKER環境の場合は基本状態を返す（詳細チェックは後で実装）', async () => {
      // info check success
      mockDockerClient.info.mockResolvedValue({});
      // inspectImage success
      mockDockerClient.inspectImage.mockResolvedValue({});

      mockDbSelectGet.mockReturnValue({
        id: 'docker-env',
        name: 'Docker Dev',
        type: 'DOCKER',
        description: null,
        config: '{"imageName":"test"}',
        auth_dir_path: null,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const status = await service.checkStatus('docker-env');

      expect(status).toHaveProperty('available');
      expect(status).toHaveProperty('authenticated');
    });

    it('SSH環境の場合は基本状態を返す', async () => {
      mockDbSelectGet.mockReturnValue({
        id: 'ssh-env',
        name: 'SSH Server',
        type: 'SSH',
        description: null,
        config: '{"host":"example.com"}',
        auth_dir_path: null,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const status = await service.checkStatus('ssh-env');

      expect(status).toHaveProperty('available');
      expect(status).toHaveProperty('authenticated');
    });
  });

  describe('createAuthDirectory', () => {
    it('認証ディレクトリを作成してパスを返す', async () => {
      const env = {
        id: 'docker-env',
        name: 'Docker Dev',
        type: 'DOCKER',
        description: null,
        config: '{}',
        auth_dir_path: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDbSelectGet.mockReturnValue(env);
      mockMkdir.mockResolvedValue(undefined);

      const result = await service.createAuthDirectory('docker-env');

      expect(result).toContain('docker-env');
      expect(mockMkdir).toHaveBeenCalled();
      expect(mockDbUpdateRun).toHaveBeenCalled();
    });

    it('存在しない環境の場合はエラー', async () => {
      mockDbSelectGet.mockReturnValue(undefined);

      await expect(service.createAuthDirectory('non-existent')).rejects.toThrow(
        '環境が見つかりません'
      );
    });
  });

  describe('deleteAuthDirectory', () => {
    it('認証ディレクトリを削除する', async () => {
      const env = {
        id: 'docker-env',
        name: 'Docker Dev',
        type: 'DOCKER',
        description: null,
        config: '{}',
        auth_dir_path: '/data/environments/docker-env',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDbSelectGet.mockReturnValue(env);
      mockRm.mockResolvedValue(undefined);

      await service.deleteAuthDirectory('docker-env');

      expect(mockRm).toHaveBeenCalledWith(env.auth_dir_path, {
        recursive: true,
        force: true,
      });
      expect(mockDbUpdateRun).toHaveBeenCalled();
    });

    it('auth_dir_pathがnullの場合は何もしない', async () => {
      mockDbSelectGet.mockReturnValue({
        id: 'docker-env',
        name: 'Docker Dev',
        type: 'DOCKER',
        description: null,
        config: '{}',
        auth_dir_path: null,
        created_at: new Date(),
        updated_at: new Date(),
      });

      await service.deleteAuthDirectory('docker-env');

      expect(mockRm).not.toHaveBeenCalled();
      expect(mockDbUpdateRun).not.toHaveBeenCalled();
    });

    it('存在しない環境の場合はエラー', async () => {
      mockDbSelectGet.mockReturnValue(undefined);

      await expect(service.deleteAuthDirectory('non-existent')).rejects.toThrow(
        '環境が見つかりません'
      );
    });
  });

  describe('シングルトンインスタンス', () => {
    it('environmentServiceがエクスポートされている', async () => {
      // 動的インポートでシングルトンを取得
      const envModule = await import('../environment-service');
      expect(envModule.environmentService).toBeInstanceOf(EnvironmentService);
    });
  });

  describe('checkDockerStatus - imageSource handling', () => {
    
    it('should check built image for dockerfile source', async () => {
      // Dockerデーモンが起動している、イメージも存在する場合
      mockDockerClient.info.mockResolvedValue({});
      mockDockerClient.inspectImage.mockResolvedValue({});

      mockDbSelectGet.mockReturnValue({
        id: 'docker-env',
        name: 'Docker Dev',
        type: 'DOCKER',
        description: null,
        config: JSON.stringify({
          imageSource: 'dockerfile',
          buildImageName: 'my-custom-image',
          imageName: 'fallback-image',
        }),
        auth_dir_path: '/data/environments/docker-env',
        created_at: new Date(),
        updated_at: new Date(),
      });

      const status = await service.checkStatus('docker-env');

      expect(status.available).toBe(true);
      expect(status.authenticated).toBe(true);
      expect(status.details?.imageExists).toBe(true);
      // buildImageNameが優先して使用されることを確認
      expect(mockDockerClient.inspectImage).toHaveBeenCalledWith('my-custom-image:latest');
    });

    it('should show appropriate error message for dockerfile source when image not found', async () => {
      // Dockerデーモンは起動しているが、イメージが見つからない
      mockDockerClient.info.mockResolvedValue({});
      mockDockerClient.inspectImage.mockRejectedValue(new Error('No such image'));

      mockDbSelectGet.mockReturnValue({
        id: 'docker-env',
        name: 'Docker Dev',
        type: 'DOCKER',
        description: null,
        config: JSON.stringify({
          imageSource: 'dockerfile',
          buildImageName: 'my-custom-image',
        }),
        auth_dir_path: null,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const status = await service.checkStatus('docker-env');

      expect(status.available).toBe(false);
      expect(status.authenticated).toBe(true);
      expect(status.error).toBe(
        'ビルド済みイメージが見つかりません。環境を再作成してビルドしてください。'
      );
      expect(status.details?.imageExists).toBe(false);
    });

    it('should show appropriate error message for existing source when image not found', async () => {
      // Dockerデーモンは起動しているが、イメージが見つからない（既存イメージ指定）
      mockDockerClient.info.mockResolvedValue({});
      mockDockerClient.inspectImage.mockRejectedValue(new Error('No such image'));

      mockDbSelectGet.mockReturnValue({
        id: 'docker-env',
        name: 'Docker Dev',
        type: 'DOCKER',
        description: null,
        config: JSON.stringify({
          imageSource: 'existing',
          imageName: 'my-existing-image',
          imageTag: 'v1.0',
        }),
        auth_dir_path: null,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const status = await service.checkStatus('docker-env');

      expect(status.available).toBe(false);
      expect(status.authenticated).toBe(true);
      expect(status.error).toBe(
        'イメージ my-existing-image:v1.0 が見つかりません。docker pullまたはビルドしてください。'
      );
      expect(status.details?.imageExists).toBe(false);
    });

    it('should use default values when imageSource is not specified', async () => {
      // imageSourceが指定されていない場合（既存イメージとして扱う）
      mockDockerClient.info.mockResolvedValue({});
      mockDockerClient.inspectImage.mockRejectedValue(new Error('No such image'));

      mockDbSelectGet.mockReturnValue({
        id: 'docker-env',
        name: 'Docker Dev',
        type: 'DOCKER',
        description: null,
        config: JSON.stringify({
          imageName: 'some-image',
        }),
        auth_dir_path: null,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const status = await service.checkStatus('docker-env');

      expect(status.available).toBe(false);
      expect(status.error).toContain('イメージ some-image:latest が見つかりません');
    });

    it('should use imageName as fallback for dockerfile source when buildImageName is not set', async () => {
      mockDockerClient.info.mockResolvedValue({});
      mockDockerClient.inspectImage.mockResolvedValue({});

      mockDbSelectGet.mockReturnValue({
        id: 'docker-env',
        name: 'Docker Dev',
        type: 'DOCKER',
        description: null,
        config: JSON.stringify({
          imageSource: 'dockerfile',
          imageName: 'fallback-image',
          // buildImageNameは未設定
        }),
        auth_dir_path: '/data/environments/docker-env',
        created_at: new Date(),
        updated_at: new Date(),
      });

      const status = await service.checkStatus('docker-env');

      expect(status.available).toBe(true);
      // imageNameがフォールバックとして使用される
      expect(mockDockerClient.inspectImage).toHaveBeenCalledWith('fallback-image:latest');
    });
  });

  describe('HOST環境制限', () => {
    describe('create() - HOST制限', () => {
      it('HOST環境が不許可の場合、HOST環境の作成でエラーをスローする', async () => {
        mockIsHostEnvironmentAllowed.mockReturnValue(false);

        const input: CreateEnvironmentInput = {
          name: 'Test Host',
          type: 'HOST',
          config: {},
        };

        await expect(service.create(input)).rejects.toThrow(
          'HOST環境はこの環境では作成できません'
        );

        expect(mockDbInsertGet).not.toHaveBeenCalled();
      });

      it('HOST環境が許可の場合、HOST環境を正常に作成できる', async () => {
        mockIsHostEnvironmentAllowed.mockReturnValue(true);

        const input: CreateEnvironmentInput = {
          name: 'Test Host',
          type: 'HOST',
          config: {},
        };

        const expectedResult = {
          id: 'host-id',
          name: 'Test Host',
          type: 'HOST',
          description: null,
          config: '{}',
          auth_dir_path: null,
          created_at: new Date(),
          updated_at: new Date(),
        };

        mockDbInsertGet.mockReturnValue(expectedResult);

        const result = await service.create(input);

        expect(result).toEqual(expectedResult);
      });

      it('DOCKER環境はHOST制限に関係なく作成できる', async () => {
        mockIsHostEnvironmentAllowed.mockReturnValue(false);

        const input: CreateEnvironmentInput = {
          name: 'Test Docker',
          type: 'DOCKER',
          config: { imageName: 'test-image' },
        };

        const expectedResult = {
          id: 'docker-id',
          name: 'Test Docker',
          type: 'DOCKER',
          description: null,
          config: JSON.stringify({ imageName: 'test-image' }),
          auth_dir_path: null,
          created_at: new Date(),
          updated_at: new Date(),
        };

        mockDbInsertGet.mockReturnValue(expectedResult);

        const result = await service.create(input);

        expect(result).toEqual(expectedResult);
      });
    });

    describe('checkStatus() - HOST制限', () => {
      it('HOST環境が不許可の場合、available=falseを返す', async () => {
        mockIsHostEnvironmentAllowed.mockReturnValue(false);

        mockDbSelectGet.mockReturnValue({
          id: 'host-default',
          name: 'Local Host',
          type: 'HOST',
          description: null,
          config: '{}',
          auth_dir_path: null,
          created_at: new Date(),
          updated_at: new Date(),
        });

        const status = await service.checkStatus('host-default');

        expect(status.available).toBe(false);
        expect(status.authenticated).toBe(false);
        expect(status.error).toBe('Docker環境内ではHOST環境は利用できません');
      });
    });

  });

  describe('createConfigVolumes', () => {
    it('Docker名前付きVolumeを2つ作成する', async () => {
      const env = {
        id: 'docker-env',
        name: 'Docker Dev',
        type: 'DOCKER',
        description: null,
        config: '{}',
        auth_dir_path: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDbSelectGet.mockReturnValue(env);
      mockDockerClient.createVolume.mockResolvedValue({});

      await service.createConfigVolumes('docker-env');

      expect(mockDockerClient.createVolume).toHaveBeenCalledTimes(2);
      expect(mockDockerClient.createVolume).toHaveBeenCalledWith('claude-config-claude-docker-env');
      expect(mockDockerClient.createVolume).toHaveBeenCalledWith('claude-config-configclaude-docker-env');
    });

    it('存在しない環境の場合はエラーになる', async () => {
      mockDbSelectGet.mockReturnValue(undefined);

      await expect(service.createConfigVolumes('non-existent')).rejects.toThrow(
        '環境が見つかりません'
      );
    });

    it('Volume作成に失敗した場合はエラーがスローされる', async () => {
      const env = {
        id: 'docker-env',
        name: 'Docker Dev',
        type: 'DOCKER',
        description: null,
        config: '{}',
        auth_dir_path: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDbSelectGet.mockReturnValue(env);
      mockDockerClient.createVolume.mockRejectedValue(new Error('Docker API error'));

      await expect(service.createConfigVolumes('docker-env')).rejects.toThrow('Docker API error');
    });
  });

  describe('deleteConfigVolumes', () => {
    it('Docker名前付きVolumeを2つ削除する', async () => {
      const env = {
        id: 'docker-env',
        name: 'Docker Dev',
        type: 'DOCKER',
        description: null,
        config: '{}',
        auth_dir_path: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDbSelectGet.mockReturnValue(env);
      mockDockerClient.removeVolume.mockResolvedValue(undefined);

      await service.deleteConfigVolumes('docker-env');

      expect(mockDockerClient.removeVolume).toHaveBeenCalledTimes(2);
      expect(mockDockerClient.removeVolume).toHaveBeenCalledWith('claude-config-claude-docker-env');
      expect(mockDockerClient.removeVolume).toHaveBeenCalledWith('claude-config-configclaude-docker-env');
    });

    it('存在しない環境の場合はエラーになる', async () => {
      mockDbSelectGet.mockReturnValue(undefined);

      await expect(service.deleteConfigVolumes('non-existent')).rejects.toThrow(
        '環境が見つかりません'
      );
    });

    it('Volume削除失敗は警告ログを出力するがエラーにはならない', async () => {
      const env = {
        id: 'docker-env',
        name: 'Docker Dev',
        type: 'DOCKER',
        description: null,
        config: '{}',
        auth_dir_path: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDbSelectGet.mockReturnValue(env);
      mockDockerClient.removeVolume.mockRejectedValue(new Error('Volume not found'));

      await service.deleteConfigVolumes('docker-env');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        '設定Volume削除失敗',
        expect.objectContaining({
          volume: expect.stringContaining('claude-config-'),
          error: expect.any(Error),
        })
      );
    });
  });

  describe('delete with config volumes', () => {
    it('auth_dir_pathがnullのDocker環境削除時にconfig Volumeも削除する', async () => {
      const env = {
        id: 'docker-env',
        name: 'Docker Dev',
        type: 'DOCKER',
        description: null,
        config: '{}',
        auth_dir_path: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDbSelectGet.mockReturnValueOnce(env);
      mockDbSelectAll.mockReturnValueOnce([]); // projects
      mockDbSelectAll.mockReturnValueOnce([]); // sessions
      mockDockerClient.removeVolume.mockResolvedValue(undefined);

      await service.delete('docker-env');

      expect(mockDockerClient.removeVolume).toHaveBeenCalledWith('claude-config-claude-docker-env');
      expect(mockDockerClient.removeVolume).toHaveBeenCalledWith('claude-config-configclaude-docker-env');
      expect(mockDbDeleteRun).toHaveBeenCalled();
    });

    it('auth_dir_pathが設定されたDocker環境削除時はバインドマウント削除のみ', async () => {
      const env = {
        id: 'docker-env',
        name: 'Docker Dev',
        type: 'DOCKER',
        description: null,
        config: '{}',
        auth_dir_path: '/data/environments/docker-env',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDbSelectGet.mockReturnValueOnce(env);
      mockDbSelectAll.mockReturnValueOnce([]); // projects
      mockDbSelectAll.mockReturnValueOnce([]); // sessions

      await service.delete('docker-env');

      expect(mockDockerClient.removeVolume).not.toHaveBeenCalled();
      expect(mockRm).toHaveBeenCalledWith('/data/environments/docker-env', { recursive: true, force: true });
      expect(mockDbDeleteRun).toHaveBeenCalled();
    });
  });
});
