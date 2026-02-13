import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigService } from '../config-service';
import fs from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('ConfigService', () => {
  let testConfigPath: string;
  let configService: ConfigService;

  beforeEach(async () => {
    // 一時ディレクトリに設定ファイルを作成
    const testDir = path.join(tmpdir(), `config-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    testConfigPath = path.join(testDir, 'settings.json');
    configService = new ConfigService(testConfigPath);
  });

  afterEach(async () => {
    // テストファイルをクリーンアップ
    try {
      const testDir = path.dirname(testConfigPath);
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (_error) {
      // エラーは無視
      void _error;
    }
  });

  describe('load', () => {
    it('設定ファイルが存在しない場合、デフォルト値を使用する', async () => {
      await configService.load();
      const config = configService.getConfig();

      expect(config.git_clone_timeout_minutes).toBe(5);
      expect(config.debug_mode_keep_volumes).toBe(false);
    });

    it('設定ファイルから値を読み込む', async () => {
      const testConfig = {
        git_clone_timeout_minutes: 10,
        debug_mode_keep_volumes: true,
      };

      await fs.mkdir(path.dirname(testConfigPath), { recursive: true });
      await fs.writeFile(testConfigPath, JSON.stringify(testConfig), 'utf-8');
      await configService.load();

      const config = configService.getConfig();
      expect(config.git_clone_timeout_minutes).toBe(10);
      expect(config.debug_mode_keep_volumes).toBe(true);
    });

    it('不正なJSONの場合、デフォルト値を使用する', async () => {
      await fs.mkdir(path.dirname(testConfigPath), { recursive: true });
      await fs.writeFile(testConfigPath, 'invalid json', 'utf-8');
      await configService.load();

      const config = configService.getConfig();
      expect(config.git_clone_timeout_minutes).toBe(5);
      expect(config.debug_mode_keep_volumes).toBe(false);
    });

    it('部分的な設定ファイルの場合、不足分はデフォルト値を使用する', async () => {
      const partialConfig = {
        git_clone_timeout_minutes: 15,
      };

      await fs.mkdir(path.dirname(testConfigPath), { recursive: true });
      await fs.writeFile(testConfigPath, JSON.stringify(partialConfig), 'utf-8');
      await configService.load();

      const config = configService.getConfig();
      expect(config.git_clone_timeout_minutes).toBe(15);
      expect(config.debug_mode_keep_volumes).toBe(false);
    });
  });

  describe('save', () => {
    it('設定をファイルに保存する', async () => {
      await configService.load();
      await configService.save({
        git_clone_timeout_minutes: 20,
        debug_mode_keep_volumes: true,
      });

      const savedContent = await fs.readFile(testConfigPath, 'utf-8');
      const savedConfig = JSON.parse(savedContent);

      expect(savedConfig.git_clone_timeout_minutes).toBe(20);
      expect(savedConfig.debug_mode_keep_volumes).toBe(true);
    });

    it('部分的な更新が可能', async () => {
      await configService.load();
      await configService.save({ git_clone_timeout_minutes: 25 });

      const config = configService.getConfig();
      expect(config.git_clone_timeout_minutes).toBe(25);
      expect(config.debug_mode_keep_volumes).toBe(false);
    });

    it('ディレクトリが存在しない場合は自動作成する', async () => {
      const nonExistentPath = path.join(tmpdir(), `config-test-${Date.now()}`, 'nested', 'settings.json');
      const newConfigService = new ConfigService(nonExistentPath);

      await newConfigService.load();
      await newConfigService.save({ git_clone_timeout_minutes: 30 });

      const exists = await fs.access(nonExistentPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);

      // クリーンアップ
      await fs.rm(path.dirname(path.dirname(nonExistentPath)), { recursive: true, force: true });
    });
  });

  describe('getGitCloneTimeoutMinutes', () => {
    it('タイムアウト値（分）を取得できる', async () => {
      await configService.load();
      expect(configService.getGitCloneTimeoutMinutes()).toBe(5);
    });
  });

  describe('getGitCloneTimeoutMs', () => {
    it('タイムアウト値（ミリ秒）を取得できる', async () => {
      await configService.load();
      expect(configService.getGitCloneTimeoutMs()).toBe(5 * 60 * 1000);
    });

    it('カスタムタイムアウト値を正しくミリ秒に変換する', async () => {
      await configService.load();
      await configService.save({ git_clone_timeout_minutes: 10 });
      expect(configService.getGitCloneTimeoutMs()).toBe(10 * 60 * 1000);
    });
  });

  describe('getDebugModeKeepVolumes', () => {
    it('デバッグモードフラグを取得できる', async () => {
      await configService.load();
      expect(configService.getDebugModeKeepVolumes()).toBe(false);
    });

    it('設定したデバッグモードフラグを取得できる', async () => {
      await configService.load();
      await configService.save({ debug_mode_keep_volumes: true });
      expect(configService.getDebugModeKeepVolumes()).toBe(true);
    });
  });

  describe('getConfig', () => {
    it('設定全体を取得できる', async () => {
      await configService.load();
      const config = configService.getConfig();

      expect(config).toHaveProperty('git_clone_timeout_minutes');
      expect(config).toHaveProperty('debug_mode_keep_volumes');
    });

    it('取得した設定は独立したオブジェクト', async () => {
      await configService.load();
      const config1 = configService.getConfig();
      const config2 = configService.getConfig();

      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });
  });
});
