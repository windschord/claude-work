import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// vi.hoistedでモックを先に初期化
const {
  mockPrismaExecutionEnvironment,
  mockPrismaSession,
  mockMkdir,
  mockRm,
  mockAccess,
  mockLogger,
  mockExec,
} = vi.hoisted(() => ({
  mockPrismaExecutionEnvironment: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  mockPrismaSession: {
    count: vi.fn(),
  },
  mockMkdir: vi.fn(),
  mockRm: vi.fn(),
  mockAccess: vi.fn(),
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  mockExec: vi.fn(),
}));

// Prisma clientのモック
vi.mock('@/lib/db', () => ({
  prisma: {
    executionEnvironment: mockPrismaExecutionEnvironment,
    session: mockPrismaSession,
  },
}));

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

// child_processのモック
vi.mock('child_process', () => {
  const mockExports = {
    exec: mockExec,
  };
  return {
    ...mockExports,
    default: mockExports,
  };
});

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
        is_default: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPrismaExecutionEnvironment.create.mockResolvedValue(expectedResult);

      const result = await service.create(input);

      expect(result).toEqual(expectedResult);
      expect(mockPrismaExecutionEnvironment.create).toHaveBeenCalledWith({
        data: {
          name: input.name,
          type: input.type,
          description: input.description,
          config: JSON.stringify(input.config),
          is_default: false,
        },
      });
    });

    it('configがオブジェクトの場合はJSON文字列に変換される', async () => {
      const input: CreateEnvironmentInput = {
        name: 'Test',
        type: 'HOST',
        config: { key: 'value', nested: { foo: 'bar' } },
      };

      mockPrismaExecutionEnvironment.create.mockResolvedValue({
        id: 'id',
        name: 'Test',
        type: 'HOST',
        description: null,
        config: JSON.stringify(input.config),
        auth_dir_path: null,
        is_default: false,
        created_at: new Date(),
        updated_at: new Date(),
      });

      await service.create(input);

      expect(mockPrismaExecutionEnvironment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          config: JSON.stringify({ key: 'value', nested: { foo: 'bar' } }),
        }),
      });
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
        is_default: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPrismaExecutionEnvironment.findUnique.mockResolvedValue(expectedEnv);

      const result = await service.findById('env-123');

      expect(result).toEqual(expectedEnv);
      expect(mockPrismaExecutionEnvironment.findUnique).toHaveBeenCalledWith({
        where: { id: 'env-123' },
      });
    });

    it('存在しないIDの場合はnullを返す', async () => {
      mockPrismaExecutionEnvironment.findUnique.mockResolvedValue(null);

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
          is_default: true,
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
          is_default: false,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockPrismaExecutionEnvironment.findMany.mockResolvedValue(environments);

      const result = await service.findAll();

      expect(result).toEqual(environments);
      expect(mockPrismaExecutionEnvironment.findMany).toHaveBeenCalledWith({
        orderBy: { created_at: 'asc' },
      });
    });

    it('環境がない場合は空配列を返す', async () => {
      mockPrismaExecutionEnvironment.findMany.mockResolvedValue([]);

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
        is_default: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPrismaExecutionEnvironment.update.mockResolvedValue(updatedEnv);

      const result = await service.update('env-123', input);

      expect(result).toEqual(updatedEnv);
      expect(mockPrismaExecutionEnvironment.update).toHaveBeenCalledWith({
        where: { id: 'env-123' },
        data: {
          name: 'Updated Name',
          description: 'Updated description',
        },
      });
    });

    it('configを更新する場合はJSON文字列に変換される', async () => {
      const input: UpdateEnvironmentInput = {
        config: { newKey: 'newValue' },
      };

      mockPrismaExecutionEnvironment.update.mockResolvedValue({
        id: 'env-123',
        name: 'Test',
        type: 'DOCKER',
        description: null,
        config: JSON.stringify(input.config),
        auth_dir_path: null,
        is_default: false,
        created_at: new Date(),
        updated_at: new Date(),
      });

      await service.update('env-123', input);

      expect(mockPrismaExecutionEnvironment.update).toHaveBeenCalledWith({
        where: { id: 'env-123' },
        data: {
          config: JSON.stringify({ newKey: 'newValue' }),
        },
      });
    });
  });

  describe('delete', () => {
    it('環境を削除できる', async () => {
      // デフォルトではない環境
      mockPrismaExecutionEnvironment.findUnique.mockResolvedValue({
        id: 'env-123',
        name: 'Test Env',
        type: 'DOCKER',
        description: null,
        config: '{}',
        auth_dir_path: null,
        is_default: false,
        created_at: new Date(),
        updated_at: new Date(),
      });

      mockPrismaSession.count.mockResolvedValue(0);
      mockPrismaExecutionEnvironment.delete.mockResolvedValue({});

      await service.delete('env-123');

      expect(mockPrismaExecutionEnvironment.delete).toHaveBeenCalledWith({
        where: { id: 'env-123' },
      });
    });

    it('デフォルト環境は削除できない', async () => {
      mockPrismaExecutionEnvironment.findUnique.mockResolvedValue({
        id: 'host-default',
        name: 'Local Host',
        type: 'HOST',
        description: null,
        config: '{}',
        auth_dir_path: null,
        is_default: true,
        created_at: new Date(),
        updated_at: new Date(),
      });

      await expect(service.delete('host-default')).rejects.toThrow(
        'デフォルト環境は削除できません'
      );

      expect(mockPrismaExecutionEnvironment.delete).not.toHaveBeenCalled();
    });

    it('使用中のセッションがある場合は警告をログに出力するが削除は許可する', async () => {
      mockPrismaExecutionEnvironment.findUnique.mockResolvedValue({
        id: 'env-123',
        name: 'Test Env',
        type: 'DOCKER',
        description: null,
        config: '{}',
        auth_dir_path: null,
        is_default: false,
        created_at: new Date(),
        updated_at: new Date(),
      });

      mockPrismaSession.count.mockResolvedValue(3);
      mockPrismaExecutionEnvironment.delete.mockResolvedValue({});

      await service.delete('env-123');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('使用中のセッション'),
        expect.objectContaining({ environmentId: 'env-123', sessionCount: 3 })
      );
      expect(mockPrismaExecutionEnvironment.delete).toHaveBeenCalled();
    });

    it('存在しない環境の削除はエラーになる', async () => {
      mockPrismaExecutionEnvironment.findUnique.mockResolvedValue(null);

      await expect(service.delete('non-existent')).rejects.toThrow(
        '環境が見つかりません'
      );

      expect(mockPrismaExecutionEnvironment.delete).not.toHaveBeenCalled();
    });
  });

  describe('getDefault', () => {
    it('デフォルト環境を取得できる', async () => {
      const defaultEnv = {
        id: 'host-default',
        name: 'Local Host',
        type: 'HOST',
        description: null,
        config: '{}',
        auth_dir_path: null,
        is_default: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPrismaExecutionEnvironment.findFirst.mockResolvedValue(defaultEnv);

      const result = await service.getDefault();

      expect(result).toEqual(defaultEnv);
      expect(mockPrismaExecutionEnvironment.findFirst).toHaveBeenCalledWith({
        where: { is_default: true },
      });
    });

    it('デフォルト環境が存在しない場合はエラーになる', async () => {
      mockPrismaExecutionEnvironment.findFirst.mockResolvedValue(null);

      await expect(service.getDefault()).rejects.toThrow(
        'デフォルト環境が見つかりません'
      );
    });
  });

  describe('ensureDefaultExists', () => {
    it('デフォルト環境が存在しない場合は作成する', async () => {
      mockPrismaExecutionEnvironment.findFirst.mockResolvedValue(null);

      const createdEnv = {
        id: 'host-default',
        name: 'Local Host',
        type: 'HOST',
        description: 'デフォルトのホスト環境',
        config: '{}',
        auth_dir_path: null,
        is_default: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPrismaExecutionEnvironment.create.mockResolvedValue(createdEnv);

      await service.ensureDefaultExists();

      expect(mockPrismaExecutionEnvironment.create).toHaveBeenCalledWith({
        data: {
          id: 'host-default',
          name: 'Local Host',
          type: 'HOST',
          description: 'デフォルトのホスト環境',
          config: '{}',
          is_default: true,
        },
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('デフォルト環境を作成'),
        expect.objectContaining({ id: 'host-default' })
      );
    });

    it('デフォルト環境が既に存在する場合は何もしない', async () => {
      mockPrismaExecutionEnvironment.findFirst.mockResolvedValue({
        id: 'host-default',
        name: 'Local Host',
        type: 'HOST',
        description: null,
        config: '{}',
        auth_dir_path: null,
        is_default: true,
        created_at: new Date(),
        updated_at: new Date(),
      });

      await service.ensureDefaultExists();

      expect(mockPrismaExecutionEnvironment.create).not.toHaveBeenCalled();
    });
  });

  describe('checkStatus', () => {
    it('HOST環境の場合は常に利用可能', async () => {
      mockPrismaExecutionEnvironment.findUnique.mockResolvedValue({
        id: 'host-default',
        name: 'Local Host',
        type: 'HOST',
        description: null,
        config: '{}',
        auth_dir_path: null,
        is_default: true,
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
      mockPrismaExecutionEnvironment.findUnique.mockResolvedValue(null);

      const status = await service.checkStatus('non-existent');

      expect(status).toEqual({
        available: false,
        authenticated: false,
        error: '環境が見つかりません',
      });
    });

    it('DOCKER環境の場合は基本状態を返す（詳細チェックは後で実装）', async () => {
      // execのモック設定
      mockExec.mockImplementation(
        (
          command: string,
          _options: unknown,
          callback: (error: Error | null, stdout: string, stderr: string) => void
        ) => {
          callback(null, '', '');
          return {} as ReturnType<typeof mockExec>;
        }
      );

      mockPrismaExecutionEnvironment.findUnique.mockResolvedValue({
        id: 'docker-env',
        name: 'Docker Dev',
        type: 'DOCKER',
        description: null,
        config: '{"imageName":"test"}',
        auth_dir_path: null,
        is_default: false,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const status = await service.checkStatus('docker-env');

      expect(status).toHaveProperty('available');
      expect(status).toHaveProperty('authenticated');
    });

    it('SSH環境の場合は基本状態を返す', async () => {
      mockPrismaExecutionEnvironment.findUnique.mockResolvedValue({
        id: 'ssh-env',
        name: 'SSH Server',
        type: 'SSH',
        description: null,
        config: '{"host":"example.com"}',
        auth_dir_path: null,
        is_default: false,
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
        is_default: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPrismaExecutionEnvironment.findUnique.mockResolvedValue(env);
      mockMkdir.mockResolvedValue(undefined);
      // モックの戻り値として実際のパス文字列を使用（expect.stringContainingはアサーション用）
      const expectedAuthDirPath = '/mock/path/environments/docker-env';
      mockPrismaExecutionEnvironment.update.mockResolvedValue({
        ...env,
        auth_dir_path: expectedAuthDirPath,
      });

      const result = await service.createAuthDirectory('docker-env');

      expect(result).toContain('docker-env');
      expect(mockMkdir).toHaveBeenCalled();
      expect(mockPrismaExecutionEnvironment.update).toHaveBeenCalled();
    });

    it('存在しない環境の場合はエラー', async () => {
      mockPrismaExecutionEnvironment.findUnique.mockResolvedValue(null);

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
        is_default: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPrismaExecutionEnvironment.findUnique.mockResolvedValue(env);
      mockRm.mockResolvedValue(undefined);
      mockPrismaExecutionEnvironment.update.mockResolvedValue({
        ...env,
        auth_dir_path: null,
      });

      await service.deleteAuthDirectory('docker-env');

      expect(mockRm).toHaveBeenCalledWith(env.auth_dir_path, {
        recursive: true,
        force: true,
      });
      expect(mockPrismaExecutionEnvironment.update).toHaveBeenCalledWith({
        where: { id: 'docker-env' },
        data: { auth_dir_path: null },
      });
    });

    it('auth_dir_pathがnullの場合は何もしない', async () => {
      mockPrismaExecutionEnvironment.findUnique.mockResolvedValue({
        id: 'docker-env',
        name: 'Docker Dev',
        type: 'DOCKER',
        description: null,
        config: '{}',
        auth_dir_path: null,
        is_default: false,
        created_at: new Date(),
        updated_at: new Date(),
      });

      await service.deleteAuthDirectory('docker-env');

      expect(mockRm).not.toHaveBeenCalled();
      expect(mockPrismaExecutionEnvironment.update).not.toHaveBeenCalled();
    });

    it('存在しない環境の場合はエラー', async () => {
      mockPrismaExecutionEnvironment.findUnique.mockResolvedValue(null);

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
    // execをコールバック形式でモック
    const setupExecMock = (
      dockerInfoSuccess: boolean,
      imageInspectSuccess: boolean
    ) => {
      mockExec.mockImplementation(
        (
          command: string,
          _options: unknown,
          callback: (error: Error | null, stdout: string, stderr: string) => void
        ) => {
          if (command === 'docker info') {
            if (dockerInfoSuccess) {
              callback(null, 'Docker info output', '');
            } else {
              callback(new Error('Docker daemon not running'), '', '');
            }
          } else if (command.startsWith('docker image inspect')) {
            if (imageInspectSuccess) {
              callback(null, '[]', '');
            } else {
              callback(new Error('Image not found'), '', '');
            }
          } else {
            callback(null, '', '');
          }
          return {} as ReturnType<typeof mockExec>;
        }
      );
    };

    it('should check built image for dockerfile source', async () => {
      // Dockerデーモンが起動している、イメージも存在する場合
      setupExecMock(true, true);

      mockPrismaExecutionEnvironment.findUnique.mockResolvedValue({
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
        is_default: false,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const status = await service.checkStatus('docker-env');

      expect(status.available).toBe(true);
      expect(status.authenticated).toBe(true);
      expect(status.details?.imageExists).toBe(true);
      // buildImageNameが優先して使用されることを確認
      expect(mockExec).toHaveBeenCalledWith(
        'docker image inspect my-custom-image:latest',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should show appropriate error message for dockerfile source when image not found', async () => {
      // Dockerデーモンは起動しているが、イメージが見つからない
      setupExecMock(true, false);

      mockPrismaExecutionEnvironment.findUnique.mockResolvedValue({
        id: 'docker-env',
        name: 'Docker Dev',
        type: 'DOCKER',
        description: null,
        config: JSON.stringify({
          imageSource: 'dockerfile',
          buildImageName: 'my-custom-image',
        }),
        auth_dir_path: null,
        is_default: false,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const status = await service.checkStatus('docker-env');

      expect(status.available).toBe(false);
      expect(status.authenticated).toBe(false);
      expect(status.error).toBe(
        'ビルド済みイメージが見つかりません。環境を再作成してビルドしてください。'
      );
      expect(status.details?.imageExists).toBe(false);
    });

    it('should show appropriate error message for existing source when image not found', async () => {
      // Dockerデーモンは起動しているが、イメージが見つからない（既存イメージ指定）
      setupExecMock(true, false);

      mockPrismaExecutionEnvironment.findUnique.mockResolvedValue({
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
        is_default: false,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const status = await service.checkStatus('docker-env');

      expect(status.available).toBe(false);
      expect(status.authenticated).toBe(false);
      expect(status.error).toBe(
        'イメージ my-existing-image:v1.0 が見つかりません。docker pullまたはビルドしてください。'
      );
      expect(status.details?.imageExists).toBe(false);
    });

    it('should use default values when imageSource is not specified', async () => {
      // imageSourceが指定されていない場合（既存イメージとして扱う）
      setupExecMock(true, false);

      mockPrismaExecutionEnvironment.findUnique.mockResolvedValue({
        id: 'docker-env',
        name: 'Docker Dev',
        type: 'DOCKER',
        description: null,
        config: JSON.stringify({
          imageName: 'some-image',
        }),
        auth_dir_path: null,
        is_default: false,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const status = await service.checkStatus('docker-env');

      expect(status.available).toBe(false);
      expect(status.error).toContain('イメージ some-image:latest が見つかりません');
    });

    it('should use imageName as fallback for dockerfile source when buildImageName is not set', async () => {
      setupExecMock(true, true);

      mockPrismaExecutionEnvironment.findUnique.mockResolvedValue({
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
        is_default: false,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const status = await service.checkStatus('docker-env');

      expect(status.available).toBe(true);
      // imageNameがフォールバックとして使用される
      expect(mockExec).toHaveBeenCalledWith(
        'docker image inspect fallback-image:latest',
        expect.any(Object),
        expect.any(Function)
      );
    });
  });
});
