import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateRequiredEnvVars, detectClaudePath } from '../env-validation';

// child_processとfsをモック
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(),
}));

describe('環境変数バリデーション', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('すべての必須環境変数が設定されている場合、エラーをスローしない', () => {
    process.env.CLAUDE_WORK_TOKEN = 'test-token';
    process.env.SESSION_SECRET = 'test-secret-32-characters-long!!';
    process.env.DATABASE_URL = 'file:./prisma/data/test.db';

    expect(() => {
      validateRequiredEnvVars();
    }).not.toThrow();
  });

  it('CLAUDE_WORK_TOKENが未設定の場合、エラーをスローする', () => {
    delete process.env.CLAUDE_WORK_TOKEN;
    process.env.SESSION_SECRET = 'test-secret-32-characters-long!!';
    process.env.DATABASE_URL = 'file:./prisma/data/test.db';

    expect(() => {
      validateRequiredEnvVars();
    }).toThrow('CLAUDE_WORK_TOKEN environment variable is not set');
  });

  it('SESSION_SECRETが未設定の場合、エラーをスローする', () => {
    process.env.CLAUDE_WORK_TOKEN = 'test-token';
    delete process.env.SESSION_SECRET;
    process.env.DATABASE_URL = 'file:./prisma/data/test.db';

    expect(() => {
      validateRequiredEnvVars();
    }).toThrow('SESSION_SECRET environment variable is not set');
  });

  it('SESSION_SECRETが32文字未満の場合、エラーをスローする', () => {
    process.env.CLAUDE_WORK_TOKEN = 'test-token';
    process.env.SESSION_SECRET = 'short';
    process.env.DATABASE_URL = 'file:./prisma/data/test.db';

    expect(() => {
      validateRequiredEnvVars();
    }).toThrow('SESSION_SECRET must be at least 32 characters');
  });

  it('DATABASE_URLが未設定の場合、エラーをスローする', () => {
    process.env.CLAUDE_WORK_TOKEN = 'test-token';
    process.env.SESSION_SECRET = 'test-secret-32-characters-long!!';
    delete process.env.DATABASE_URL;

    expect(() => {
      validateRequiredEnvVars();
    }).toThrow('DATABASE_URL environment variable is not set');
  });

  it('複数の環境変数が未設定の場合、すべてのエラーを含むメッセージをスローする', () => {
    delete process.env.CLAUDE_WORK_TOKEN;
    delete process.env.SESSION_SECRET;
    delete process.env.DATABASE_URL;

    expect(() => {
      validateRequiredEnvVars();
    }).toThrow(/CLAUDE_WORK_TOKEN.*SESSION_SECRET.*DATABASE_URL/s);
  });
});

describe('detectClaudePath', () => {
  const originalEnv = process.env;
  const originalPlatform = process.platform;

  beforeEach(async () => {
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

  it('Windows環境の場合、エラーをスローする', async () => {
    Object.defineProperty(process, 'platform', {
      value: 'win32',
    });

    expect(() => {
      detectClaudePath();
    }).toThrow('Windows is not supported. Please use macOS or Linux.');
  });

  it('CLAUDE_CODE_PATHが設定されており、パスが存在する場合、そのパスを返す', async () => {
    const { existsSync } = await import('fs');
    const testPath = '/usr/local/bin/claude';
    process.env.CLAUDE_CODE_PATH = testPath;
    vi.mocked(existsSync).mockReturnValue(true);

    const result = detectClaudePath();

    expect(result).toBe(testPath);
    expect(existsSync).toHaveBeenCalledWith(testPath);
  });

  it('CLAUDE_CODE_PATHが設定されているがパスが存在しない場合、エラーをスローする', async () => {
    const { existsSync } = await import('fs');
    const testPath = '/invalid/path/claude';
    process.env.CLAUDE_CODE_PATH = testPath;
    vi.mocked(existsSync).mockReturnValue(false);

    expect(() => {
      detectClaudePath();
    }).toThrow(`CLAUDE_CODE_PATH is set but the path does not exist: ${testPath}`);
  });

  it('CLAUDE_CODE_PATHが未設定で、whichコマンドでclaudeが見つかる場合、そのパスを返す', async () => {
    const { execSync } = await import('child_process');
    delete process.env.CLAUDE_CODE_PATH;
    const expectedPath = '/usr/local/bin/claude';
    vi.mocked(execSync).mockReturnValue(`${expectedPath}\n` as any);

    const result = detectClaudePath();

    expect(result).toBe(expectedPath);
    expect(execSync).toHaveBeenCalledWith('which claude', { encoding: 'utf-8' });
  });

  it('whichコマンドが空文字列を返す場合、エラーをスローする', async () => {
    const { execSync } = await import('child_process');
    delete process.env.CLAUDE_CODE_PATH;
    vi.mocked(execSync).mockReturnValue('' as any);

    expect(() => {
      detectClaudePath();
    }).toThrow(
      'claude command not found in PATH. Please install Claude Code CLI or set CLAUDE_CODE_PATH environment variable.'
    );
  });

  it('whichコマンドが例外をスローする場合、適切なエラーメッセージをスローする', async () => {
    const { execSync } = await import('child_process');
    delete process.env.CLAUDE_CODE_PATH;
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error('command not found');
    });

    expect(() => {
      detectClaudePath();
    }).toThrow(
      'claude command not found in PATH. Please install Claude Code CLI or set CLAUDE_CODE_PATH environment variable.'
    );
  });

  it('macOS環境でPATHから正常に検出できる', async () => {
    const { execSync } = await import('child_process');
    Object.defineProperty(process, 'platform', {
      value: 'darwin',
    });
    delete process.env.CLAUDE_CODE_PATH;
    const expectedPath = '/opt/homebrew/bin/claude';
    vi.mocked(execSync).mockReturnValue(`${expectedPath}\n` as any);

    const result = detectClaudePath();

    expect(result).toBe(expectedPath);
  });

  it('Linux環境でPATHから正常に検出できる', async () => {
    const { execSync } = await import('child_process');
    Object.defineProperty(process, 'platform', {
      value: 'linux',
    });
    delete process.env.CLAUDE_CODE_PATH;
    const expectedPath = '/usr/bin/claude';
    vi.mocked(execSync).mockReturnValue(`${expectedPath}\n` as any);

    const result = detectClaudePath();

    expect(result).toBe(expectedPath);
  });
});
