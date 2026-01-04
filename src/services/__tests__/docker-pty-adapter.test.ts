import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

// ホイストされたモックを作成
const { mockPtySpawn, mockStatSync, mockExistsSync } = vi.hoisted(() => ({
  mockPtySpawn: vi.fn(),
  mockStatSync: vi.fn(() => ({ isDirectory: () => true })),
  mockExistsSync: vi.fn(() => true),
}));

// node-ptyモジュールをモック
vi.mock('node-pty', () => ({
  spawn: mockPtySpawn,
}));

// fsモジュールをモック
vi.mock('fs', () => ({
  statSync: mockStatSync,
  existsSync: mockExistsSync,
}));

// テスト対象
import { DockerPTYAdapter } from '../docker-pty-adapter';

describe('DockerPTYAdapter', () => {
  let adapter: DockerPTYAdapter;
  let mockPtyProcess: EventEmitter & {
    write: ReturnType<typeof vi.fn>;
    resize: ReturnType<typeof vi.fn>;
    kill: ReturnType<typeof vi.fn>;
    onData: (callback: (data: string) => void) => void;
    onExit: (callback: (info: { exitCode: number; signal?: number }) => void) => void;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // モックPTYプロセスを作成
    mockPtyProcess = new EventEmitter() as typeof mockPtyProcess;
    mockPtyProcess.write = vi.fn();
    mockPtyProcess.resize = vi.fn();
    mockPtyProcess.kill = vi.fn();

    // onDataとonExitのコールバックを保持
    let dataCallback: ((data: string) => void) | null = null;
    let exitCallback: ((info: { exitCode: number; signal?: number }) => void) | null = null;

    mockPtyProcess.onData = (callback) => {
      dataCallback = callback;
    };
    mockPtyProcess.onExit = (callback) => {
      exitCallback = callback;
    };

    // イベント発火用のヘルパー
    (mockPtyProcess as EventEmitter & { _emitData: (d: string) => void })._emitData = (
      data: string
    ) => {
      if (dataCallback) dataCallback(data);
    };
    (
      mockPtyProcess as EventEmitter & {
        _emitExit: (i: { exitCode: number; signal?: number }) => void;
      }
    )._emitExit = (info) => {
      if (exitCallback) exitCallback(info);
    };

    mockPtySpawn.mockReturnValue(mockPtyProcess);

    adapter = new DockerPTYAdapter();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('デフォルト設定で初期化される', () => {
      expect(adapter.getImageName()).toBe('claude-code-sandboxed');
      expect(adapter.getImageTag()).toBe('latest');
    });

    it('カスタム設定で初期化される', () => {
      const customAdapter = new DockerPTYAdapter({
        imageName: 'custom-image',
        imageTag: 'v1.0',
      });
      expect(customAdapter.getImageName()).toBe('custom-image');
      expect(customAdapter.getImageTag()).toBe('v1.0');
    });
  });

  describe('createSession', () => {
    it('docker runコマンドでPTYを起動する', () => {
      adapter.createSession('test-session', '/path/to/worktree');

      expect(mockPtySpawn).toHaveBeenCalledWith(
        'docker',
        expect.arrayContaining(['run', '-it', '--rm']),
        expect.objectContaining({
          name: 'xterm-256color',
          cols: 80,
          rows: 24,
        })
      );
    });

    it('セッションIDを正しく登録する', () => {
      adapter.createSession('test-session', '/path/to/worktree');

      expect(adapter.hasSession('test-session')).toBe(true);
    });

    it('作業ディレクトリを記録する', () => {
      adapter.createSession('test-session', '/path/to/worktree');

      expect(adapter.getWorkingDir('test-session')).toBe('/path/to/worktree');
    });

    it('既存セッションがある場合は破棄して再作成する', () => {
      adapter.createSession('test-session', '/path/to/worktree');

      // 既存セッションがあっても再作成可能（古いセッションは破棄される）
      expect(() => {
        adapter.createSession('test-session', '/path/to/worktree');
      }).not.toThrow();

      // killが呼ばれる（destroySession経由）
      expect(mockPtyProcess.kill).toHaveBeenCalled();
    });

    it('初期プロンプトを遅延送信する', () => {
      vi.useFakeTimers();

      adapter.createSession('test-session', '/path/to/worktree', 'Hello Claude');

      // 3秒後にプロンプトが送信される
      vi.advanceTimersByTime(3000);

      expect(mockPtyProcess.write).toHaveBeenCalledWith('Hello Claude\n');

      vi.useRealTimers();
    });
  });

  describe('write', () => {
    it('PTYに入力を送信する', () => {
      adapter.createSession('test-session', '/path/to/worktree');
      adapter.write('test-session', 'test input');

      expect(mockPtyProcess.write).toHaveBeenCalledWith('test input');
    });

    it('存在しないセッションへの書き込みは無視される', () => {
      adapter.write('non-existent', 'test input');

      expect(mockPtyProcess.write).not.toHaveBeenCalled();
    });
  });

  describe('resize', () => {
    it('PTYのサイズを変更する', () => {
      adapter.createSession('test-session', '/path/to/worktree');
      adapter.resize('test-session', 120, 40);

      expect(mockPtyProcess.resize).toHaveBeenCalledWith(120, 40);
    });
  });

  describe('destroySession', () => {
    it('PTYプロセスをkillする', () => {
      adapter.createSession('test-session', '/path/to/worktree');
      adapter.destroySession('test-session');

      expect(mockPtyProcess.kill).toHaveBeenCalled();
    });

    it('セッションをMapから削除する', () => {
      adapter.createSession('test-session', '/path/to/worktree');
      adapter.destroySession('test-session');

      expect(adapter.hasSession('test-session')).toBe(false);
    });
  });

  describe('restartSession', () => {
    it('既存セッションを破棄して新しいセッションを作成する', async () => {
      vi.useFakeTimers();

      adapter.createSession('test-session', '/path/to/worktree', 'initial prompt');

      // spawnの呼び出しをリセット
      mockPtySpawn.mockClear();

      // restartSession呼び出し
      adapter.restartSession('test-session');

      // 即座にkillが呼ばれる
      expect(mockPtyProcess.kill).toHaveBeenCalled();

      // セッションは一旦削除される
      expect(adapter.hasSession('test-session')).toBe(false);

      // 500ms後に再作成される
      await vi.advanceTimersByTimeAsync(500);

      // 新しいセッションが作成される
      expect(mockPtySpawn).toHaveBeenCalledTimes(1);
      expect(adapter.hasSession('test-session')).toBe(true);

      vi.useRealTimers();
    });

    it('同じ作業ディレクトリで再起動する', async () => {
      vi.useFakeTimers();

      adapter.createSession('test-session', '/specific/worktree/path');

      mockPtySpawn.mockClear();
      adapter.restartSession('test-session');

      await vi.advanceTimersByTimeAsync(500);

      // 同じworkingDirでdocker runが呼ばれる
      const args = mockPtySpawn.mock.calls[0][1] as string[];
      // -v フラグとボリュームマウント文字列が連続していることを確認
      const volumeFlagIndex = args.indexOf('-v');
      expect(volumeFlagIndex).toBeGreaterThan(-1);
      const volumeMount = args[volumeFlagIndex + 1];
      expect(volumeMount).toBe('/specific/worktree/path:/workspace');

      vi.useRealTimers();
    });

    it('存在しないセッションの再起動は何もしない', () => {
      adapter.restartSession('non-existent');

      // エラーが発生しないことを確認
      expect(mockPtySpawn).not.toHaveBeenCalled();
    });
  });

  describe('events', () => {
    it('dataイベントを発火する', () => {
      const dataHandler = vi.fn();
      adapter.on('data', dataHandler);

      adapter.createSession('test-session', '/path/to/worktree');

      // PTYからデータを受信
      (mockPtyProcess as EventEmitter & { _emitData: (d: string) => void })._emitData(
        'Hello from Docker'
      );

      expect(dataHandler).toHaveBeenCalledWith('test-session', 'Hello from Docker');
    });

    it('exitイベントを発火する', () => {
      const exitHandler = vi.fn();
      adapter.on('exit', exitHandler);

      adapter.createSession('test-session', '/path/to/worktree');

      // PTY終了
      (
        mockPtyProcess as EventEmitter & {
          _emitExit: (i: { exitCode: number; signal?: number }) => void;
        }
      )._emitExit({ exitCode: 0 });

      expect(exitHandler).toHaveBeenCalledWith('test-session', { exitCode: 0 });
    });
  });

  describe('buildDockerArgs', () => {
    it('基本的なdocker run引数を生成する', () => {
      adapter.createSession('test-session', '/path/to/worktree');

      const args = mockPtySpawn.mock.calls[0][1] as string[];

      expect(args).toContain('run');
      expect(args).toContain('-it');
      expect(args).toContain('--rm');
      expect(args).toContain('claude-code-sandboxed:latest');
    });
  });

  describe('hasSession', () => {
    it('セッションが存在する場合はtrueを返す', () => {
      adapter.createSession('test-session', '/path/to/worktree');

      expect(adapter.hasSession('test-session')).toBe(true);
    });

    it('セッションが存在しない場合はfalseを返す', () => {
      expect(adapter.hasSession('non-existent')).toBe(false);
    });
  });

  describe('getContainerId', () => {
    it('コンテナIDを返す', () => {
      adapter.createSession('test-session', '/path/to/worktree');

      // コンテナIDはセッション作成時にコンテナ名として設定される
      const containerId = adapter.getContainerId('test-session');
      expect(containerId).toBeDefined();
      expect(containerId).toMatch(/^claude-\d+-[a-z0-9]+$/);
    });
  });
});
