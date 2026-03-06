/**
 * cli.ts の spawnSync 呼び出しテスト
 *
 * 各関数が spawnSync を呼び出す際に cwd と env を正しく設定しているかを検証する。
 *
 * 注意: cli.ts はモジュールトップレベルで main() を呼び出す副作用がある。
 * そのため、child_process, fs, dotenv, cli-utils をモックしてから import する必要がある。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as childProcess from 'child_process';

// child_process をモック（main() 内の spawnSync 呼び出しを無害化する）
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    default: {
      ...actual,
      spawnSync: vi.fn(() => ({ status: 0 })),
      spawn: vi.fn(() => ({ on: vi.fn() })),
    },
    spawnSync: vi.fn(() => ({ status: 0 })),
    spawn: vi.fn(() => ({ on: vi.fn() })),
  };
});

// fs をモック（resolvePm2Cmd の existsSync 等を無害化する）
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: vi.fn(() => false),
      readFileSync: actual.readFileSync,
      copyFileSync: vi.fn(),
      mkdirSync: vi.fn(),
    },
    existsSync: vi.fn(() => false),
    copyFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  };
});

// cli-utils をモック（checkDatabase, checkNextBuild, migrateDatabase を無害化する）
vi.mock('../cli-utils', () => ({
  checkNextBuild: vi.fn(() => true),
  checkDatabase: vi.fn(() => true),
  migrateDatabase: vi.fn(() => true),
}));

// dotenv をモック（.env ファイル読み込みを無害化する）
vi.mock('dotenv', () => ({
  default: { config: vi.fn(() => ({})) },
  config: vi.fn(() => ({})),
}));

// process.exit をモック（実際に終了しないように）
const mockProcessExit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);

import { buildNext, startDaemon, stopDaemon, restartDaemon, showStatus, projectRoot } from '../cli';

describe('cli.ts spawnSync cwd/env 検証', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(childProcess.spawnSync).mockReturnValue({ status: 0 } as ReturnType<typeof childProcess.spawnSync>);
    mockProcessExit.mockImplementation((() => {}) as never);
  });

  describe('buildNext()', () => {
    it('spawnSync に projectRoot を cwd として渡す', () => {
      buildNext();

      expect(childProcess.spawnSync).toHaveBeenCalledWith(
        expect.any(String),
        ['run', 'build:next'],
        expect.objectContaining({
          cwd: projectRoot,
          stdio: 'inherit',
        })
      );
    });

    it('spawnSync の env に NODE_ENV=production が含まれる', () => {
      buildNext();

      const calls = vi.mocked(childProcess.spawnSync).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const options = calls[0][2] as { env?: Record<string, string> };
      expect(options?.env).toBeDefined();
      expect(options?.env?.NODE_ENV).toBe('production');
    });

    it('cwd が process.cwd() ではなく projectRoot である', () => {
      buildNext();

      const calls = vi.mocked(childProcess.spawnSync).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const options = calls[0][2] as { cwd?: string };
      expect(options?.cwd).toBeDefined();
      expect(options?.cwd).not.toBe(process.cwd());
      expect(options?.cwd).toBe(projectRoot);
    });
  });

  describe('startDaemon()', () => {
    it('spawnSync に projectRoot を cwd として渡す', () => {
      startDaemon();

      expect(childProcess.spawnSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['start']),
        expect.objectContaining({
          cwd: projectRoot,
          stdio: 'inherit',
        })
      );
    });

    it('spawnSync の env に NODE_ENV=production が含まれる', () => {
      startDaemon();

      const calls = vi.mocked(childProcess.spawnSync).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const options = calls[0][2] as { env?: Record<string, string> };
      expect(options?.env).toBeDefined();
      expect(options?.env?.NODE_ENV).toBe('production');
    });

    it('spawnSync の env に PORT が含まれる', () => {
      process.env.PORT = '4000';
      startDaemon();

      const calls = vi.mocked(childProcess.spawnSync).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const options = calls[0][2] as { env?: Record<string, string> };
      expect(options?.env).toBeDefined();
      expect(options?.env?.PORT).toBeDefined();
      delete process.env.PORT;
    });

    it('cwd が process.cwd() ではなく projectRoot である', () => {
      startDaemon();

      const calls = vi.mocked(childProcess.spawnSync).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const options = calls[0][2] as { cwd?: string };
      expect(options?.cwd).toBeDefined();
      expect(options?.cwd).not.toBe(process.cwd());
      expect(options?.cwd).toBe(projectRoot);
    });
  });

  describe('stopDaemon()', () => {
    it('spawnSync に projectRoot を cwd として渡す', () => {
      stopDaemon();

      expect(childProcess.spawnSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['stop']),
        expect.objectContaining({
          cwd: projectRoot,
          stdio: 'inherit',
        })
      );
    });

    it('cwd が process.cwd() ではなく projectRoot である', () => {
      stopDaemon();

      const calls = vi.mocked(childProcess.spawnSync).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const options = calls[0][2] as { cwd?: string };
      expect(options?.cwd).toBeDefined();
      expect(options?.cwd).not.toBe(process.cwd());
      expect(options?.cwd).toBe(projectRoot);
    });
  });

  describe('restartDaemon()', () => {
    it('spawnSync に projectRoot を cwd として渡す', () => {
      restartDaemon();

      expect(childProcess.spawnSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['restart']),
        expect.objectContaining({
          cwd: projectRoot,
          stdio: 'inherit',
        })
      );
    });

    it('spawnSync の env に NODE_ENV=production が含まれる', () => {
      restartDaemon();

      const calls = vi.mocked(childProcess.spawnSync).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const options = calls[0][2] as { env?: Record<string, string> };
      expect(options?.env).toBeDefined();
      expect(options?.env?.NODE_ENV).toBe('production');
    });

    it('cwd が process.cwd() ではなく projectRoot である', () => {
      restartDaemon();

      const calls = vi.mocked(childProcess.spawnSync).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const options = calls[0][2] as { cwd?: string };
      expect(options?.cwd).toBeDefined();
      expect(options?.cwd).not.toBe(process.cwd());
      expect(options?.cwd).toBe(projectRoot);
    });
  });

  describe('showStatus()', () => {
    it('spawnSync に projectRoot を cwd として渡す', () => {
      showStatus();

      expect(childProcess.spawnSync).toHaveBeenCalledWith(
        expect.any(String),
        ['status'],
        expect.objectContaining({
          cwd: projectRoot,
          stdio: 'inherit',
        })
      );
    });

    it('cwd が process.cwd() ではなく projectRoot である', () => {
      showStatus();

      const calls = vi.mocked(childProcess.spawnSync).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const options = calls[0][2] as { cwd?: string };
      expect(options?.cwd).toBeDefined();
      expect(options?.cwd).not.toBe(process.cwd());
      expect(options?.cwd).toBe(projectRoot);
    });
  });
});
