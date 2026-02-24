import { describe, it, expect, vi, beforeEach } from 'vitest';

// node-ptyのモック
vi.mock('node-pty', () => ({
  spawn: vi.fn(),
}));

// Drizzleのモック (vi.hoisted を使用してモック関数を先に定義)
const { _mockDbRun, _mockDbWhere, mockDbSet, mockDbFrom } = vi.hoisted(() => {
  const _mockDbRun = vi.fn();
  const _mockDbSelectGet = vi.fn().mockReturnValue(null);
  const _mockDbWhere = vi.fn(() => ({ run: _mockDbRun, get: _mockDbSelectGet }));
  const mockDbSet = vi.fn(() => ({ where: _mockDbWhere }));
  const mockDbFrom = vi.fn(() => ({ where: _mockDbWhere }));
  return { _mockDbRun, _mockDbWhere, mockDbSet, mockDbFrom };
});

vi.mock('@/lib/db', () => ({
  db: {
    query: {
      sessions: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    },
    update: vi.fn(() => ({ set: mockDbSet })),
    select: vi.fn(() => ({ from: mockDbFrom })),
  },
  schema: {
    sessions: { id: 'id', container_id: 'container_id' },
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ column: col, value: val })),
}));

// scrollbackBufferのモック
vi.mock('@/services/scrollback-buffer', () => ({
  scrollbackBuffer: {
    append: vi.fn(),
    getBuffer: vi.fn().mockReturnValue(null),
    clear: vi.fn(),
    has: vi.fn().mockReturnValue(false),
    getByteSize: vi.fn().mockReturnValue(0),
  },
}));

// loggerのモック
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

// fsのモック（SSHディレクトリチェック用）
vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

// osのモック
vi.mock('os', () => ({
  homedir: vi.fn().mockReturnValue('/home/testuser'),
  tmpdir: vi.fn().mockReturnValue('/tmp'),
}));

import { DockerAdapter, DockerAdapterConfig } from '../docker-adapter';
import type { CreateSessionOptions } from '../../environment-adapter';

// buildContainerOptionsをテストするためのサブクラス
class TestableDockerAdapter extends DockerAdapter {
  public testBuildContainerOptions(workingDir: string, options?: CreateSessionOptions) {
    return this.buildContainerOptions(workingDir, options);
  }
}

describe('DockerAdapter skipPermissions', () => {
  let adapter: TestableDockerAdapter;
  const config: DockerAdapterConfig = {
    environmentId: 'test-env-id',
    imageName: 'test-image',
    imageTag: 'latest',
    authDirPath: '/tmp/test-auth/test-env-id',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new TestableDockerAdapter(config);
    // 環境変数をクリア（テスト安定性のため）
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.SSH_AUTH_SOCK;
  });

  it('should add --dangerously-skip-permissions when skipPermissions is true', () => {
    const { createOptions } = adapter.testBuildContainerOptions('/workspace', {
      skipPermissions: true,
    });
    expect(createOptions.Cmd).toContain('--dangerously-skip-permissions');
  });

  it('should not add flag when skipPermissions is false', () => {
    const { createOptions } = adapter.testBuildContainerOptions('/workspace', {
      skipPermissions: false,
    });
    expect(createOptions.Cmd ?? []).not.toContain('--dangerously-skip-permissions');
  });

  it('should not add flag when skipPermissions is undefined', () => {
    const { createOptions } = adapter.testBuildContainerOptions('/workspace', {});
    expect(createOptions.Cmd ?? []).not.toContain('--dangerously-skip-permissions');
  });

  it('should not add flag when options is undefined', () => {
    const { createOptions } = adapter.testBuildContainerOptions('/workspace');
    expect(createOptions.Cmd ?? []).not.toContain('--dangerously-skip-permissions');
  });

  it('should not add flag in shellMode even when skipPermissions is true', () => {
    const { createOptions } = adapter.testBuildContainerOptions('/workspace', {
      shellMode: true,
      skipPermissions: true,
    });
    expect(createOptions.Cmd ?? []).not.toContain('--dangerously-skip-permissions');
  });

  it('should include flag in Cmd array', () => {
    const { createOptions } = adapter.testBuildContainerOptions('/workspace', {
      skipPermissions: true,
    });
    const cmd = createOptions.Cmd ?? [];
    expect(cmd).toContain('--dangerously-skip-permissions');
  });

  it('should not duplicate flag when claudeCodeOptions also has dangerouslySkipPermissions', () => {
    const { createOptions } = adapter.testBuildContainerOptions('/workspace', {
      skipPermissions: true,
      claudeCodeOptions: {
        dangerouslySkipPermissions: true,
      },
    });
    const cmd = createOptions.Cmd ?? [];
    const flagCount = cmd.filter(a => a === '--dangerously-skip-permissions').length;
    // buildCliArgsからは追加されないので1回のみ
    expect(flagCount).toBe(1);
  });
});
