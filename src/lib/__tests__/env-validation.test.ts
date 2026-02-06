import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateRequiredEnvVars, detectClaudePath } from '../env-validation';

// Hoisted mocks
const { mockExecSync, mockExistsSync } = vi.hoisted(() => ({
  mockExecSync: vi.fn(),
  mockExistsSync: vi.fn(),
}));

// child_processとfsをモック
vi.mock('child_process', () => {
  const mockExports = {
    execSync: mockExecSync,
  };
  return {
    ...mockExports,
    default: mockExports,
  };
});

vi.mock('fs', () => {
  const mockExports = {
    existsSync: mockExistsSync,
  };
  return {
    ...mockExports,
    default: mockExports,
  };
});

describe('環境変数バリデーション', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('DATABASE_URLが設定されている場合、エラーをスローしない', () => {
    process.env.DATABASE_URL = 'file:../data/test.db';

    expect(() => {
      validateRequiredEnvVars();
    }).not.toThrow();
  });

  it('DATABASE_URLが未設定の場合、エラーをスローする', () => {
    delete process.env.DATABASE_URL;

    expect(() => {
      validateRequiredEnvVars();
    }).toThrow('DATABASE_URL environment variable is not set');
  });

  it('DATABASE_URLが空文字の場合、エラーをスローする', () => {
    process.env.DATABASE_URL = '';

    expect(() => {
      validateRequiredEnvVars();
    }).toThrow('DATABASE_URL environment variable is not set');
  });

  it('DATABASE_URLが空白のみの場合、エラーをスローする', () => {
    process.env.DATABASE_URL = '   ';

    expect(() => {
      validateRequiredEnvVars();
    }).toThrow('DATABASE_URL environment variable is not set');
  });
});

describe('detectClaudePath', () => {
  const originalEnv = process.env;
  const originalPlatform = process.platform;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
    });
  });

  it('Windows環境の場合、エラーをスローする', () => {
    Object.defineProperty(process, 'platform', {
      value: 'win32',
    });

    expect(() => {
      detectClaudePath();
    }).toThrow('Windows is not supported. Please use macOS or Linux.');
  });

  it('CLAUDE_CODE_PATHが設定されており、パスが存在する場合、そのパスを返す', () => {
    const testPath = '/usr/local/bin/claude';
    process.env.CLAUDE_CODE_PATH = testPath;
    mockExistsSync.mockReturnValue(true);

    const result = detectClaudePath();

    expect(result).toBe(testPath);
    expect(mockExistsSync).toHaveBeenCalledWith(testPath);
  });

  it('CLAUDE_CODE_PATHが絶対パスで存在しない場合、エラーをスローする', () => {
    const testPath = '/invalid/path/claude';
    process.env.CLAUDE_CODE_PATH = testPath;
    mockExistsSync.mockReturnValue(false);

    expect(() => {
      detectClaudePath();
    }).toThrow(`CLAUDE_CODE_PATH is set but the path does not exist: ${testPath}`);
  });

  it('CLAUDE_CODE_PATHがコマンド名でwhichで見つかる場合、解決されたパスを返す', () => {
    process.env.CLAUDE_CODE_PATH = 'claude';
    mockExistsSync.mockReturnValue(false);
    const resolvedPath = '/home/user/.local/bin/claude';
    mockExecSync.mockReturnValue(`${resolvedPath}\n`);

    const result = detectClaudePath();

    expect(result).toBe(resolvedPath);
    expect(mockExecSync).toHaveBeenCalledWith('which claude', {
      encoding: 'utf-8',
      timeout: 5000,
    });
  });

  it('CLAUDE_CODE_PATHがコマンド名でwhichでも見つからない場合、エラーをスローする', () => {
    process.env.CLAUDE_CODE_PATH = 'claude';
    mockExistsSync.mockReturnValue(false);
    mockExecSync.mockImplementation(() => {
      throw new Error('command not found');
    });

    expect(() => {
      detectClaudePath();
    }).toThrow(/CLAUDE_CODE_PATH.*claude.*not found/);
  });

  it('CLAUDE_CODE_PATHが未設定で、whichコマンドでclaudeが見つかる場合、そのパスを返す', () => {
    delete process.env.CLAUDE_CODE_PATH;
    const expectedPath = '/usr/local/bin/claude';
    mockExecSync.mockReturnValue(`${expectedPath}\n`);

    const result = detectClaudePath();

    expect(result).toBe(expectedPath);
    expect(mockExecSync).toHaveBeenCalledWith('which claude', {
      encoding: 'utf-8',
      timeout: 5000,
    });
  });

  it('whichコマンドが空文字列を返す場合、エラーをスローする', () => {
    delete process.env.CLAUDE_CODE_PATH;
    mockExecSync.mockReturnValue('');

    expect(() => {
      detectClaudePath();
    }).toThrow(/claude command not found in PATH.*Please install Claude Code CLI or set CLAUDE_CODE_PATH environment variable/s);
  });

  it('whichコマンドが例外をスローする場合、適切なエラーメッセージをスローする', () => {
    delete process.env.CLAUDE_CODE_PATH;
    mockExecSync.mockImplementation(() => {
      throw new Error('command not found');
    });

    expect(() => {
      detectClaudePath();
    }).toThrow(/claude command not found in PATH.*Please install Claude Code CLI or set CLAUDE_CODE_PATH environment variable/s);
  });

  it('macOS環境でPATHから正常に検出できる', () => {
    Object.defineProperty(process, 'platform', {
      value: 'darwin',
    });
    delete process.env.CLAUDE_CODE_PATH;
    const expectedPath = '/opt/homebrew/bin/claude';
    mockExecSync.mockReturnValue(`${expectedPath}\n`);

    const result = detectClaudePath();

    expect(result).toBe(expectedPath);
  });

  it('Linux環境でPATHから正常に検出できる', () => {
    Object.defineProperty(process, 'platform', {
      value: 'linux',
    });
    delete process.env.CLAUDE_CODE_PATH;
    const expectedPath = '/usr/bin/claude';
    mockExecSync.mockReturnValue(`${expectedPath}\n`);

    const result = detectClaudePath();

    expect(result).toBe(expectedPath);
  });
});
