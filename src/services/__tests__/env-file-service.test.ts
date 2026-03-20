import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { EnvFileService } from '../env-file-service';

describe('EnvFileService', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'env-file-test-'));
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('validatePath', () => {
    it('正当な相対パスを許可し、resolved pathを返す', () => {
      expect(EnvFileService.validatePath('/project', '.env')).toBe('/project/.env');
      expect(EnvFileService.validatePath('/project', '.env.local')).toBe('/project/.env.local');
      expect(EnvFileService.validatePath('/project', 'config/.env')).toBe('/project/config/.env');
    });

    it('../ を含むパスを拒否する', () => {
      expect(() => EnvFileService.validatePath('/project', '../.env')).toThrow();
      expect(() => EnvFileService.validatePath('/project', 'sub/../../.env')).toThrow();
    });

    it('絶対パスを拒否する', () => {
      expect(() => EnvFileService.validatePath('/project', '/etc/passwd')).toThrow();
    });
  });

  describe('listEnvFiles (host)', () => {
    it('.env* ファイルを検出する', async () => {
      await fs.writeFile(path.join(tmpDir, '.env'), 'KEY=value');
      await fs.writeFile(path.join(tmpDir, '.env.local'), 'KEY=value');
      await fs.writeFile(path.join(tmpDir, '.env.production'), 'KEY=value');

      const files = await EnvFileService.listEnvFiles(tmpDir, 'host');
      expect(files).toContain('.env');
      expect(files).toContain('.env.local');
      expect(files).toContain('.env.production');
    });

    it('node_modules 内のファイルを除外する', async () => {
      await fs.mkdir(path.join(tmpDir, 'node_modules', 'pkg'), { recursive: true });
      await fs.writeFile(path.join(tmpDir, '.env'), 'KEY=value');
      await fs.writeFile(path.join(tmpDir, 'node_modules', 'pkg', '.env'), 'KEY=value');

      const files = await EnvFileService.listEnvFiles(tmpDir, 'host');
      expect(files).toContain('.env');
      expect(files).not.toContain('node_modules/pkg/.env');
    });

    it('ファイルが見つからない場合は空配列を返す', async () => {
      const files = await EnvFileService.listEnvFiles(tmpDir, 'host');
      expect(files).toEqual([]);
    });

    it('サブディレクトリの.envファイルも検出する', async () => {
      await fs.mkdir(path.join(tmpDir, 'config'), { recursive: true });
      await fs.writeFile(path.join(tmpDir, 'config', '.env.test'), 'KEY=value');

      const files = await EnvFileService.listEnvFiles(tmpDir, 'host');
      expect(files).toContain('config/.env.test');
    });
  });

  describe('readEnvFile (host)', () => {
    it('ファイル内容を読み込む', async () => {
      await fs.writeFile(path.join(tmpDir, '.env'), 'KEY=value');
      const content = await EnvFileService.readEnvFile(tmpDir, '.env', 'host');
      expect(content).toBe('KEY=value');
    });

    it('パストラバーサルを拒否する', async () => {
      await expect(
        EnvFileService.readEnvFile(tmpDir, '../.env', 'host')
      ).rejects.toThrow();
    });

    it('存在しないファイルでエラーをスローする', async () => {
      await expect(
        EnvFileService.readEnvFile(tmpDir, '.env.nonexistent', 'host')
      ).rejects.toThrow();
    });

    it('1MBを超えるファイルでエラーをスローする', async () => {
      const largeContent = 'K'.repeat(1024 * 1024 + 1);
      await fs.writeFile(path.join(tmpDir, '.env.large'), largeContent);
      await expect(
        EnvFileService.readEnvFile(tmpDir, '.env.large', 'host')
      ).rejects.toThrow(/1MB/);
    });
  });

  describe('readEnvFile (host) - シンボリックリンク対策', () => {
    it('シンボリックリンクで外部ファイルを指す場合エラーをスローする', async () => {
      // tmpDir外にファイルを作成
      const outerDir = await fs.mkdtemp(path.join(os.tmpdir(), 'env-file-outer-'));
      try {
        await fs.writeFile(path.join(outerDir, '.env.secret'), 'SECRET=value');
        await fs.symlink(path.join(outerDir, '.env.secret'), path.join(tmpDir, '.env.link'));

        await expect(
          EnvFileService.readEnvFile(tmpDir, '.env.link', 'host')
        ).rejects.toThrow(/許可されたファイル一覧にありません/);
      } finally {
        await fs.rm(outerDir, { recursive: true, force: true });
      }
    });
  });

  describe('dockerVolumeId null チェック', () => {
    it('listEnvFiles: docker環境でdockerVolumeIdがnullならエラー', async () => {
      await expect(
        EnvFileService.listEnvFiles('/project', 'docker', null)
      ).rejects.toThrow(/dockerVolumeId/);
    });

    it('listEnvFiles: docker環境でdockerVolumeIdがundefinedならエラー', async () => {
      await expect(
        EnvFileService.listEnvFiles('/project', 'docker')
      ).rejects.toThrow(/dockerVolumeId/);
    });

    it('readEnvFile: docker環境でdockerVolumeIdがnullならエラー', async () => {
      await expect(
        EnvFileService.readEnvFile('/project', '.env', 'docker', null)
      ).rejects.toThrow(/dockerVolumeId/);
    });
  });

  describe('listEnvFiles (docker)', () => {
    it('docker run + find でファイル一覧を取得する', async () => {
      const mockRunDocker = vi.spyOn(EnvFileService, '_runDockerCommand')
        .mockResolvedValue({
          stdout: '/workspace/.env\n/workspace/.env.local\n',
          stderr: '',
        });

      const files = await EnvFileService.listEnvFiles('/project', 'docker', 'test-volume');
      expect(files).toContain('.env');
      expect(files).toContain('.env.local');
      expect(mockRunDocker).toHaveBeenCalledWith(
        expect.arrayContaining(['run', '--rm', '-v', 'test-volume:/workspace']),
      );
    });
  });

  describe('readEnvFile (docker)', () => {
    it('docker run + sh -c でファイル内容を取得する', async () => {
      const mockRunDocker = vi.spyOn(EnvFileService, '_runDockerCommand')
        .mockResolvedValueOnce({
          stdout: 'KEY=value\nKEY2=value2',
          stderr: '',
        });

      const content = await EnvFileService.readEnvFile('/project', '.env', 'docker', 'test-volume');
      expect(content).toBe('KEY=value\nKEY2=value2');
      expect(mockRunDocker).toHaveBeenCalledWith(
        expect.arrayContaining(['sh', '-c']),
      );
    });

    it('パストラバーサルを拒否する', async () => {
      await expect(
        EnvFileService.readEnvFile('/project', '../.env', 'docker', 'test-volume')
      ).rejects.toThrow();
    });

    it('1MBを超えるファイルでエラーをスローする', async () => {
      vi.spyOn(EnvFileService, '_runDockerCommand')
        .mockResolvedValueOnce({
          stdout: '___SIZE_EXCEEDED___',
          stderr: '',
        });

      await expect(
        EnvFileService.readEnvFile('/project', '.env', 'docker', 'test-volume')
      ).rejects.toThrow(/1MB/);
    });
  });
});
