import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DockerAdapter } from '../docker-adapter';

// Mock child_process module
vi.mock('child_process', async () => {
  return {
    spawn: vi.fn(),
  };
});

describe('DockerAdapter Git Operations', () => {
  let adapter: DockerAdapter;
  let mockSpawn: any;

  beforeEach(async () => {
    const childProcess = await import('child_process');
    mockSpawn = childProcess.spawn as any;

    adapter = new DockerAdapter({
      environmentId: 'test-env',
      imageName: 'node',
      imageTag: '20-alpine',
      authDirPath: '/tmp/test-auth',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('gitClone', () => {
    it('should clone a repository successfully', async () => {
      // Mock spawn to simulate successful git clone
      const mockStdout = 'Cloning into /workspace/target...\nDone.';
      const mockStderr = '';

      const mockProcess = {
        stdout: {
          on: vi.fn((event, handler) => {
            if (event === 'data') {
              setTimeout(() => handler(Buffer.from(mockStdout)), 0);
            }
          }),
        },
        stderr: {
          on: vi.fn((event, handler) => {
            if (event === 'data') {
              setTimeout(() => handler(Buffer.from(mockStderr)), 0);
            }
          }),
        },
        on: vi.fn((event, handler) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 10);
          }
        }),
      };

      mockSpawn.mockReturnValue(mockProcess as any);

      const result = await adapter.gitClone({
        url: 'git@github.com:test/repo.git',
        targetPath: '/tmp/test-repo',
        environmentId: 'test-env',
      });

      expect(result.success).toBe(true);
      expect(result.path).toBe('/tmp/test-repo');
      expect(result.error).toBeUndefined();
    });

    it('should handle clone failure', async () => {
      // Mock spawn to simulate git clone failure
      const mockStdout = '';
      const mockStderr = 'fatal: Could not read from remote repository';

      const mockProcess = {
        stdout: {
          on: vi.fn((event, handler) => {
            if (event === 'data') {
              setTimeout(() => handler(Buffer.from(mockStdout)), 0);
            }
          }),
        },
        stderr: {
          on: vi.fn((event, handler) => {
            if (event === 'data') {
              setTimeout(() => handler(Buffer.from(mockStderr)), 0);
            }
          }),
        },
        on: vi.fn((event, handler) => {
          if (event === 'close') {
            setTimeout(() => handler(1), 10);
          }
        }),
      };

      mockSpawn.mockReturnValue(mockProcess as any);

      const result = await adapter.gitClone({
        url: 'git@github.com:test/invalid-repo.git',
        targetPath: '/tmp/test-repo',
        environmentId: 'test-env',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(mockStderr);
    });

    it('should handle spawn error', async () => {
      // Mock spawn to throw error
      const mockError = new Error('Docker not found');

      const mockProcess = {
        stdout: {
          on: vi.fn(),
        },
        stderr: {
          on: vi.fn(),
        },
        on: vi.fn((event, handler) => {
          if (event === 'error') {
            setTimeout(() => handler(mockError), 10);
          }
        }),
      };

      mockSpawn.mockReturnValue(mockProcess as any);

      const result = await adapter.gitClone({
        url: 'git@github.com:test/repo.git',
        targetPath: '/tmp/test-repo',
        environmentId: 'test-env',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Docker not found');
    });
  });

  describe('gitPull', () => {
    it('should pull successfully with updates', async () => {
      // Mock spawn to simulate successful pull with updates
      const mockStdout = 'Updating abc123..def456\nFast-forward\n file.txt | 1 +\n';
      const mockStderr = '';

      const mockProcess = {
        stdout: {
          on: vi.fn((event, handler) => {
            if (event === 'data') {
              setTimeout(() => handler(Buffer.from(mockStdout)), 0);
            }
          }),
        },
        stderr: {
          on: vi.fn((event, handler) => {
            if (event === 'data') {
              setTimeout(() => handler(Buffer.from(mockStderr)), 0);
            }
          }),
        },
        on: vi.fn((event, handler) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 10);
          }
        }),
      };

      mockSpawn.mockReturnValue(mockProcess as any);

      const result = await adapter.gitPull('/tmp/test-repo');

      expect(result.success).toBe(true);
      expect(result.updated).toBe(true);
      expect(result.message).toContain('Fast-forward');
    });

    it('should pull successfully without updates', async () => {
      // Mock spawn to simulate pull with no updates
      const mockStdout = 'Already up to date.';
      const mockStderr = '';

      const mockProcess = {
        stdout: {
          on: vi.fn((event, handler) => {
            if (event === 'data') {
              setTimeout(() => handler(Buffer.from(mockStdout)), 0);
            }
          }),
        },
        stderr: {
          on: vi.fn((event, handler) => {
            if (event === 'data') {
              setTimeout(() => handler(Buffer.from(mockStderr)), 0);
            }
          }),
        },
        on: vi.fn((event, handler) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 10);
          }
        }),
      };

      mockSpawn.mockReturnValue(mockProcess as any);

      const result = await adapter.gitPull('/tmp/test-repo');

      expect(result.success).toBe(true);
      expect(result.updated).toBe(false);
      expect(result.message).toBe('Already up to date.');
    });

    it('should handle fast-forward failure', async () => {
      // Mock spawn to simulate fast-forward failure
      const mockStdout = '';
      const mockStderr = 'fatal: Not possible to fast-forward, aborting.';

      const mockProcess = {
        stdout: {
          on: vi.fn((event, handler) => {
            if (event === 'data') {
              setTimeout(() => handler(Buffer.from(mockStdout)), 0);
            }
          }),
        },
        stderr: {
          on: vi.fn((event, handler) => {
            if (event === 'data') {
              setTimeout(() => handler(Buffer.from(mockStderr)), 0);
            }
          }),
        },
        on: vi.fn((event, handler) => {
          if (event === 'close') {
            setTimeout(() => handler(1), 10);
          }
        }),
      };

      mockSpawn.mockReturnValue(mockProcess as any);

      const result = await adapter.gitPull('/tmp/test-repo');

      expect(result.success).toBe(false);
      expect(result.updated).toBe(false);
      expect(result.error).toContain('fast-forward');
    });
  });

  describe('gitGetBranches', () => {
    it('should return local and remote branches', async () => {
      // Mock for local branches
      const localOutput = '* main\n  feature-1\n  feature-2\n';
      // Mock for remote branches
      const remoteOutput = '  origin/HEAD -> origin/main\n  origin/main\n  origin/feature-1\n';
      // Mock for default branch
      const defaultOutput = 'refs/remotes/origin/main\n';

      let callCount = 0;
      mockSpawn.mockImplementation(() => {
        callCount++;
        let output = '';

        // 1st call: git branch (local)
        if (callCount === 1) {
          output = localOutput;
        }
        // 2nd call: git branch -r (remote)
        else if (callCount === 2) {
          output = remoteOutput;
        }
        // 3rd call: git symbolic-ref (default)
        else if (callCount === 3) {
          output = defaultOutput;
        }

        return {
          stdout: {
            on: vi.fn((event, handler) => {
              if (event === 'data') {
                setTimeout(() => handler(Buffer.from(output)), 0);
              }
            }),
          },
          stderr: {
            on: vi.fn(),
          },
          on: vi.fn((event, handler) => {
            if (event === 'close') {
              setTimeout(() => handler(0), 10);
            }
          }),
        } as any;
      });

      const result = await adapter.gitGetBranches('/tmp/test-repo');

      expect(result).toHaveLength(5);
      // Local branches
      expect(result).toContainEqual({
        name: 'main',
        isDefault: true,
        isRemote: false,
      });
      expect(result).toContainEqual({
        name: 'feature-1',
        isDefault: false,
        isRemote: false,
      });
      expect(result).toContainEqual({
        name: 'feature-2',
        isDefault: false,
        isRemote: false,
      });
      // Remote branches
      expect(result).toContainEqual({
        name: 'origin/main',
        isDefault: false,
        isRemote: true,
      });
      expect(result).toContainEqual({
        name: 'origin/feature-1',
        isDefault: false,
        isRemote: true,
      });
    });

    it('should handle git command failure gracefully', async () => {
      // Mock spawn to simulate error
      mockSpawn.mockImplementation(() => {
        return {
          stdout: {
            on: vi.fn(),
          },
          stderr: {
            on: vi.fn((event, handler) => {
              if (event === 'data') {
                setTimeout(() => handler(Buffer.from('fatal: not a git repository')), 0);
              }
            }),
          },
          on: vi.fn((event, handler) => {
            if (event === 'close') {
              setTimeout(() => handler(128), 10);
            }
          }),
        } as any;
      });

      const result = await adapter.gitGetBranches('/tmp/invalid-repo');

      expect(result).toEqual([]);
    });
  });

  describe('gitGetDefaultBranch', () => {
    it('should return default branch name', async () => {
      const mockStdout = 'refs/remotes/origin/main\n';

      const mockProcess = {
        stdout: {
          on: vi.fn((event, handler) => {
            if (event === 'data') {
              setTimeout(() => handler(Buffer.from(mockStdout)), 0);
            }
          }),
        },
        stderr: {
          on: vi.fn(),
        },
        on: vi.fn((event, handler) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 10);
          }
        }),
      };

      mockSpawn.mockReturnValue(mockProcess as any);

      const result = await adapter.gitGetDefaultBranch('/tmp/test-repo');

      expect(result).toBe('main');
    });

    it('should return "main" if symbolic-ref fails', async () => {
      const mockStderr = 'fatal: ref refs/remotes/origin/HEAD is not a symbolic ref';

      const mockProcess = {
        stdout: {
          on: vi.fn(),
        },
        stderr: {
          on: vi.fn((event, handler) => {
            if (event === 'data') {
              setTimeout(() => handler(Buffer.from(mockStderr)), 0);
            }
          }),
        },
        on: vi.fn((event, handler) => {
          if (event === 'close') {
            setTimeout(() => handler(1), 10);
          }
        }),
      };

      mockSpawn.mockReturnValue(mockProcess as any);

      const result = await adapter.gitGetDefaultBranch('/tmp/test-repo');

      expect(result).toBe('main');
    });

    it('should handle "develop" as default branch', async () => {
      const mockStdout = 'refs/remotes/origin/develop\n';

      const mockProcess = {
        stdout: {
          on: vi.fn((event, handler) => {
            if (event === 'data') {
              setTimeout(() => handler(Buffer.from(mockStdout)), 0);
            }
          }),
        },
        stderr: {
          on: vi.fn(),
        },
        on: vi.fn((event, handler) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 10);
          }
        }),
      };

      mockSpawn.mockReturnValue(mockProcess as any);

      const result = await adapter.gitGetDefaultBranch('/tmp/test-repo');

      expect(result).toBe('develop');
    });
  });
});
