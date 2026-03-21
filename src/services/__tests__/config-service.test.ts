import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigService, getConfigService, initializeConfigService } from '../config-service';
import fs from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
}));

describe('ConfigService', () => {
  let testConfigPath: string;
  let configService: ConfigService;

  beforeEach(async () => {
    vi.clearAllMocks();
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

  describe('getRegistryFirewallEnabled', () => {
    it('デフォルト値がtrueである', async () => {
      await configService.load();
      expect(configService.getRegistryFirewallEnabled()).toBe(true);
    });

    it('設定したフラグ値を取得できる', async () => {
      await configService.load();
      await configService.save({ registry_firewall_enabled: false });
      expect(configService.getRegistryFirewallEnabled()).toBe(false);
    });

    it('save/loadで値が保持される', async () => {
      await configService.load();
      await configService.save({ registry_firewall_enabled: false });

      const newConfigService = new ConfigService(testConfigPath);
      await newConfigService.load();
      expect(newConfigService.getRegistryFirewallEnabled()).toBe(false);
    });
  });

  describe('registry_firewall_enabled のデフォルト値とロード', () => {
    it('設定ファイルが存在しない場合、registry_firewall_enabledのデフォルト値はtrue', async () => {
      await configService.load();
      const config = configService.getConfig();
      expect(config.registry_firewall_enabled).toBe(true);
    });

    it('部分的な設定ファイルの場合、registry_firewall_enabledはデフォルト値のtrueを使用する', async () => {
      const partialConfig = {
        git_clone_timeout_minutes: 15,
      };

      await fs.mkdir(path.dirname(testConfigPath), { recursive: true });
      await fs.writeFile(testConfigPath, JSON.stringify(partialConfig), 'utf-8');
      await configService.load();

      const config = configService.getConfig();
      expect(config.registry_firewall_enabled).toBe(true);
    });

    it('設定ファイルからregistry_firewall_enabledを読み込む', async () => {
      const testConfig = {
        registry_firewall_enabled: false,
      };

      await fs.mkdir(path.dirname(testConfigPath), { recursive: true });
      await fs.writeFile(testConfigPath, JSON.stringify(testConfig), 'utf-8');
      await configService.load();

      const config = configService.getConfig();
      expect(config.registry_firewall_enabled).toBe(false);
    });
  });

  describe('constructor defaults', () => {
    it('configPathが指定されない場合のデフォルトパスを使用', () => {
      const service = new ConfigService();
      expect(service).toBeInstanceOf(ConfigService);
      const config = service.getConfig();
      expect(config.git_clone_timeout_minutes).toBe(5);
      expect(config.debug_mode_keep_volumes).toBe(false);
    });
  });

  describe('load logging', () => {
    it('設定ファイル読み込み成功時にlogger.infoが呼ばれる', async () => {
      const testConfig = {
        git_clone_timeout_minutes: 10,
        debug_mode_keep_volumes: true,
      };
      await fs.mkdir(path.dirname(testConfigPath), { recursive: true });
      await fs.writeFile(testConfigPath, JSON.stringify(testConfig), 'utf-8');
      await configService.load();

      expect(mockLogger.info).toHaveBeenCalledWith('Configuration loaded', {
        config: expect.objectContaining({
          git_clone_timeout_minutes: 10,
          debug_mode_keep_volumes: true,
        }),
      });
    });

    it('設定ファイルが存在しない場合にlogger.infoが呼ばれる', async () => {
      await configService.load();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Configuration file not found, using defaults',
        { configPath: testConfigPath }
      );
    });

    it('不正なJSON読み込み時にlogger.errorが呼ばれる', async () => {
      await fs.mkdir(path.dirname(testConfigPath), { recursive: true });
      await fs.writeFile(testConfigPath, 'invalid json', 'utf-8');
      await configService.load();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to load configuration, using defaults',
        { error: expect.any(SyntaxError) }
      );
    });

    it('ENOENT以外のエラーでもデフォルト値が使用される', async () => {
      // パーミッションエラーなどをシミュレート
      await fs.mkdir(path.dirname(testConfigPath), { recursive: true });
      await fs.writeFile(testConfigPath, JSON.stringify({ git_clone_timeout_minutes: 10 }), 'utf-8');

      // readFileをモックして非ENOENTエラーを発生させる
      const _origReadFile = fs.readFile;
      vi.spyOn(fs, 'readFile').mockRejectedValueOnce(Object.assign(new Error('Permission denied'), { code: 'EACCES' }));

      await configService.load();
      const config = configService.getConfig();
      expect(config.git_clone_timeout_minutes).toBe(5);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to load configuration, using defaults',
        expect.any(Object)
      );

      vi.mocked(fs.readFile).mockRestore();
    });
  });

  describe('save error handling', () => {
    it('保存失敗時にエラーがスローされる', async () => {
      vi.spyOn(fs, 'mkdir').mockRejectedValueOnce(new Error('Permission denied'));

      await expect(configService.save({ git_clone_timeout_minutes: 10 })).rejects.toThrow('Failed to save configuration');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to save configuration',
        { error: expect.any(Error) }
      );
    });
  });

  describe('save logging', () => {
    it('保存成功時にlogger.infoが呼ばれる', async () => {
      await configService.load();
      await configService.save({ git_clone_timeout_minutes: 20 });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Configuration saved',
        { config: expect.objectContaining({ git_clone_timeout_minutes: 20 }) }
      );
    });
  });

  describe('getConfigService', () => {
    it('シングルトンインスタンスを返す', () => {
      // getConfigServiceのシングルトンをリセットするために動的importを使う
      const service1 = getConfigService();
      const service2 = getConfigService();
      expect(service1).toBe(service2);
    });

    it('ConfigServiceインスタンスを返す', () => {
      const service = getConfigService();
      expect(service).toBeInstanceOf(ConfigService);
    });
  });

  describe('initializeConfigService', () => {
    it('ConfigServiceを初期化して返す', async () => {
      const service = await initializeConfigService();
      expect(service).toBeInstanceOf(ConfigService);
    });
  });

  describe('save merges with existing config', () => {
    it('既存の設定値を維持しつつ新しい値をマージする', async () => {
      await configService.load();
      await configService.save({ git_clone_timeout_minutes: 15 });

      // debug_mode_keep_volumesはデフォルト値のまま
      expect(configService.getConfig().debug_mode_keep_volumes).toBe(false);
      expect(configService.getConfig().git_clone_timeout_minutes).toBe(15);

      // 2回目のsaveでdebug_mode_keep_volumesだけ変更
      await configService.save({ debug_mode_keep_volumes: true });
      expect(configService.getConfig().git_clone_timeout_minutes).toBe(15);
      expect(configService.getConfig().debug_mode_keep_volumes).toBe(true);
    });
  });

  describe('save writes valid JSON', () => {
    it('保存されたファイルはフォーマットされたJSONである', async () => {
      await configService.load();
      await configService.save({ git_clone_timeout_minutes: 7 });

      const content = await fs.readFile(testConfigPath, 'utf-8');
      // 2スペースインデントであること
      expect(content).toContain('  ');
      const parsed = JSON.parse(content);
      expect(parsed.git_clone_timeout_minutes).toBe(7);
    });
  });

  describe('getGitCloneTimeoutMs calculation', () => {
    it('分をミリ秒に正しく変換する (1分 = 60000ms)', async () => {
      await configService.load();
      await configService.save({ git_clone_timeout_minutes: 1 });
      expect(configService.getGitCloneTimeoutMs()).toBe(60000);
    });

    it('0分の場合は0msを返す', async () => {
      await configService.load();
      await configService.save({ git_clone_timeout_minutes: 0 });
      expect(configService.getGitCloneTimeoutMs()).toBe(0);
    });
  });

  describe('claude_defaults', () => {
    it('デフォルト値が正しい', async () => {
      await configService.load();
      const defaults = configService.getClaudeDefaults();
      expect(defaults.dangerouslySkipPermissions).toBe(false);
      expect(defaults.worktree).toBe(true);
    });

    it('getConfigにclaude_defaultsが含まれる', async () => {
      await configService.load();
      const config = configService.getConfig();
      expect(config.claude_defaults).toEqual({
        dangerouslySkipPermissions: false,
        worktree: true,
      });
    });

    it('claude_defaultsを保存・読み込みできる', async () => {
      await configService.load();
      await configService.save({
        claude_defaults: {
          dangerouslySkipPermissions: true,
          worktree: false,
        },
      });

      const defaults = configService.getClaudeDefaults();
      expect(defaults.dangerouslySkipPermissions).toBe(true);
      expect(defaults.worktree).toBe(false);
    });

    it('部分的なclaude_defaults更新をマージする', async () => {
      await configService.load();
      await configService.save({
        claude_defaults: {
          dangerouslySkipPermissions: true,
        },
      });

      const defaults = configService.getClaudeDefaults();
      expect(defaults.dangerouslySkipPermissions).toBe(true);
      expect(defaults.worktree).toBe(true); // デフォルト値を維持
    });

    it('save/loadで値が保持される', async () => {
      await configService.load();
      await configService.save({
        claude_defaults: {
          dangerouslySkipPermissions: true,
          worktree: false,
        },
      });

      const newConfigService = new ConfigService(testConfigPath);
      await newConfigService.load();
      const defaults = newConfigService.getClaudeDefaults();
      expect(defaults.dangerouslySkipPermissions).toBe(true);
      expect(defaults.worktree).toBe(false);
    });

    it('getClaudeDefaultsは独立したオブジェクトを返す', async () => {
      await configService.load();
      const defaults1 = configService.getClaudeDefaults();
      const defaults2 = configService.getClaudeDefaults();
      expect(defaults1).not.toBe(defaults2);
      expect(defaults1).toEqual(defaults2);
    });

    it('設定ファイルにclaude_defaultsが含まれない場合デフォルト値を使用', async () => {
      const partialConfig = {
        git_clone_timeout_minutes: 10,
      };
      await fs.mkdir(path.dirname(testConfigPath), { recursive: true });
      await fs.writeFile(testConfigPath, JSON.stringify(partialConfig), 'utf-8');
      await configService.load();

      const defaults = configService.getClaudeDefaults();
      expect(defaults.dangerouslySkipPermissions).toBe(false);
      expect(defaults.worktree).toBe(true);
    });

    it('他の設定フィールドに影響しない', async () => {
      await configService.load();
      await configService.save({
        claude_defaults: { dangerouslySkipPermissions: true },
      });

      expect(configService.getGitCloneTimeoutMinutes()).toBe(5);
      expect(configService.getDebugModeKeepVolumes()).toBe(false);
      expect(configService.getRegistryFirewallEnabled()).toBe(true);
    });
  });

  describe('custom_env_vars', () => {
    it('custom_env_varsが未設定時はデフォルト{}が返される', async () => {
      await configService.load();
      expect(configService.getCustomEnvVars()).toEqual({});
    });

    it('custom_env_varsが設定されている設定ファイルを読み込み、正しく取得できる', async () => {
      const testConfig = {
        custom_env_vars: { MY_VAR: 'hello', ANOTHER: 'world' },
      };
      await fs.mkdir(path.dirname(testConfigPath), { recursive: true });
      await fs.writeFile(testConfigPath, JSON.stringify(testConfig), 'utf-8');
      await configService.load();

      expect(configService.getCustomEnvVars()).toEqual({ MY_VAR: 'hello', ANOTHER: 'world' });
    });

    it('custom_env_varsを含む設定を保存し、ファイルに書き込まれる', async () => {
      await configService.load();
      await configService.save({ custom_env_vars: { FOO: 'bar' } });

      const savedContent = await fs.readFile(testConfigPath, 'utf-8');
      const savedConfig = JSON.parse(savedContent);
      expect(savedConfig.custom_env_vars).toEqual({ FOO: 'bar' });
    });

    it('getCustomEnvVars()が正しい値を返す', async () => {
      await configService.load();
      await configService.save({ custom_env_vars: { KEY1: 'val1', KEY2: 'val2' } });

      const vars = configService.getCustomEnvVars();
      expect(vars).toEqual({ KEY1: 'val1', KEY2: 'val2' });
    });

    it('getCustomEnvVars()が返すオブジェクトは独立したコピーである', async () => {
      await configService.load();
      await configService.save({ custom_env_vars: { KEY: 'value' } });

      const vars1 = configService.getCustomEnvVars();
      const vars2 = configService.getCustomEnvVars();
      expect(vars1).not.toBe(vars2);
      expect(vars1).toEqual(vars2);
    });

    it('不正なcustom_env_vars(配列)の場合にデフォルト値{}になる', async () => {
      const testConfig = { custom_env_vars: ['not', 'an', 'object'] };
      await fs.mkdir(path.dirname(testConfigPath), { recursive: true });
      await fs.writeFile(testConfigPath, JSON.stringify(testConfig), 'utf-8');
      await configService.load();

      expect(configService.getCustomEnvVars()).toEqual({});
    });

    it('不正なcustom_env_vars(null)の場合にデフォルト値{}になる', async () => {
      const testConfig = { custom_env_vars: null };
      await fs.mkdir(path.dirname(testConfigPath), { recursive: true });
      await fs.writeFile(testConfigPath, JSON.stringify(testConfig), 'utf-8');
      await configService.load();

      expect(configService.getCustomEnvVars()).toEqual({});
    });

    it('値に文字列以外を含むcustom_env_varsはデフォルト値{}になる', async () => {
      const testConfig = { custom_env_vars: { KEY: 123 } };
      await fs.mkdir(path.dirname(testConfigPath), { recursive: true });
      await fs.writeFile(testConfigPath, JSON.stringify(testConfig), 'utf-8');
      await configService.load();

      expect(configService.getCustomEnvVars()).toEqual({})
    });
  });
});
