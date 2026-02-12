import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PTYSessionManager } from '../pty-session-manager'
import { ConnectionManager } from '@/lib/websocket/connection-manager'
import { AdapterFactory } from '../adapter-factory'

// モック設定
vi.mock('@/lib/websocket/connection-manager', () => ({
  ConnectionManager: {
    getInstance: vi.fn().mockReturnValue({
      getConnectionCount: vi.fn().mockReturnValue(0),
      addConnection: vi.fn(),
      removeConnection: vi.fn(),
      getConnections: vi.fn().mockReturnValue(new Set()),
      cleanup: vi.fn(),
      broadcast: vi.fn(),
      setScrollbackBuffer: vi.fn(),
      getScrollbackBuffer: vi.fn()
    })
  }
}))
vi.mock('../adapter-factory', () => ({
  AdapterFactory: {
    getInstance: vi.fn().mockReturnValue({
      getAdapter: vi.fn()
    })
  }
}))
vi.mock('@/lib/db', () => ({
  db: {
    executionEnvironment: {
      findUnique: vi.fn()
    },
    session: {
      update: vi.fn()
    }
  }
}))
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}))

describe('PTYSessionManager', () => {
  let manager: PTYSessionManager

  beforeEach(() => {
    // シングルトンインスタンスを取得
    manager = PTYSessionManager.getInstance()
  })

  describe('Singleton Pattern', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = PTYSessionManager.getInstance()
      const instance2 = PTYSessionManager.getInstance()

      expect(instance1).toBe(instance2)
    })

    it('should be an instance of PTYSessionManager', () => {
      expect(manager).toBeInstanceOf(PTYSessionManager)
    })
  })

  describe('Basic Methods', () => {
    it('should return false for hasSession when session does not exist', () => {
      const result = manager.hasSession('non-existent-session')

      expect(result).toBe(false)
    })

    it('should return empty array for listSessions when no sessions exist', () => {
      const result = manager.listSessions()

      expect(result).toEqual([])
    })

    it('should return undefined for getSession when session does not exist', () => {
      const result = manager.getSession('non-existent-session')

      expect(result).toBeUndefined()
    })
  })

  describe('Event Emitter', () => {
    it('should allow listening to sessionCreated event', () => {
      const listener = vi.fn()
      manager.on('sessionCreated', listener)

      // イベントリスナーが登録されていることを確認
      expect(manager.listenerCount('sessionCreated')).toBe(1)
    })

    it('should allow listening to sessionDestroyed event', () => {
      const listener = vi.fn()
      manager.on('sessionDestroyed', listener)

      expect(manager.listenerCount('sessionDestroyed')).toBe(1)
    })

    it('should allow listening to sessionError event', () => {
      const listener = vi.fn()
      manager.on('sessionError', listener)

      expect(manager.listenerCount('sessionError')).toBe(1)
    })
  })

  describe('ConnectionManager Integration', () => {
    it('should call ConnectionManager.getInstance() during construction', () => {
      const getInstanceSpy = vi.spyOn(ConnectionManager, 'getInstance')

      // 新しいインスタンス取得（シングルトンなので既存のインスタンスが返る）
      PTYSessionManager.getInstance()

      expect(getInstanceSpy).toHaveBeenCalled()
    })

    it('should have connectionManager property set', () => {
      // @ts-expect-error - private property access for testing
      expect(manager.connectionManager).toBeDefined()
    })
  })

  describe('AdapterFactory Integration', () => {
    it('should call AdapterFactory.getInstance() during construction', () => {
      const getInstanceSpy = vi.spyOn(AdapterFactory, 'getInstance')

      // 新しいインスタンス取得（シングルトンなので既存のインスタンスが返る）
      PTYSessionManager.getInstance()

      expect(getInstanceSpy).toHaveBeenCalled()
    })

    it('should have adapterFactory property set', () => {
      // @ts-expect-error - private property access for testing
      expect(manager.adapterFactory).toBeDefined()
    })
  })

  describe('Stub Methods (TASK-008 pending)', () => {
    it('should throw "Not implemented yet" for sendInput', () => {
      expect(() => manager.sendInput('test-session', 'input data')).toThrow('Not implemented yet')
    })

    it('should throw "Not implemented yet" for resize', () => {
      expect(() => manager.resize('test-session', 80, 24)).toThrow('Not implemented yet')
    })
  })

  describe('getConnectionCount', () => {
    it('should delegate to ConnectionManager', () => {
      const mockConnectionManager = {
        getConnectionCount: vi.fn().mockReturnValue(5)
      }
      // @ts-expect-error - private property override for testing
      manager.connectionManager = mockConnectionManager

      const count = manager.getConnectionCount('test-session')

      expect(count).toBe(5)
      expect(mockConnectionManager.getConnectionCount).toHaveBeenCalledWith('test-session')
    })
  })

  describe('TASK-007: Session Lifecycle', () => {
    describe('createSession', () => {
      it('should create a new session successfully', async () => {
        const mockPty = {
          pid: 1234,
          write: vi.fn(),
          resize: vi.fn(),
          kill: vi.fn(),
          onData: vi.fn(),
          onExit: vi.fn()
        }

        const mockAdapter = {
          spawn: vi.fn().mockResolvedValue(mockPty),
          cleanup: vi.fn(),
          getSession: vi.fn()
        }

        const mockAdapterFactory = {
          getAdapter: vi.fn().mockResolvedValue(mockAdapter)
        }

        const mockPrisma = {
          executionEnvironment: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'env1',
              type: 'HOST',
              name: 'Default Host'
            })
          },
          session: {
            update: vi.fn().mockResolvedValue({})
          }
        }

        const mockConnectionManager = {
          setScrollbackBuffer: vi.fn(),
          getScrollbackBuffer: vi.fn(),
          addConnection: vi.fn(),
          removeConnection: vi.fn(),
          getConnections: vi.fn().mockReturnValue(new Set()),
          cleanup: vi.fn(),
          broadcast: vi.fn(),
          getConnectionCount: vi.fn().mockReturnValue(0)
        }

        // @ts-expect-error - private property override for testing
        manager.adapterFactory = mockAdapterFactory
        // @ts-expect-error - private property override for testing
        manager.prisma = mockPrisma
        // @ts-expect-error - private property override for testing
        manager.connectionManager = mockConnectionManager

        const sessionCreatedListener = vi.fn()
        manager.on('sessionCreated', sessionCreatedListener)

        const session = await manager.createSession({
          sessionId: 'test-session',
          projectId: 'project1',
          branchName: 'main',
          worktreePath: '/path/to/worktree',
          environmentId: 'env1',
          cols: 80,
          rows: 24
        })

        expect(session).toBeDefined()
        expect(session.id).toBe('test-session')
        expect(session.pty).toBe(mockPty)
        expect(session.adapter).toBe(mockAdapter)
        expect(session.environmentType).toBe('HOST')
        expect(session.metadata.projectId).toBe('project1')
        expect(manager.hasSession('test-session')).toBe(true)
        expect(mockAdapterFactory.getAdapter).toHaveBeenCalledWith('HOST')
        expect(mockAdapter.spawn).toHaveBeenCalled()
        expect(mockConnectionManager.setScrollbackBuffer).toHaveBeenCalledWith('test-session', expect.anything())
        expect(mockPrisma.session.update).toHaveBeenCalledWith({
          where: { id: 'test-session' },
          data: {
            status: 'ACTIVE',
            last_active_at: expect.any(Date)
          }
        })
        expect(sessionCreatedListener).toHaveBeenCalledWith('test-session')
      })

      it('should throw error if session already exists', async () => {
        const mockPty = {
          pid: 1234,
          write: vi.fn(),
          resize: vi.fn(),
          kill: vi.fn(),
          onData: vi.fn(),
          onExit: vi.fn()
        }

        const mockAdapter = {
          spawn: vi.fn().mockResolvedValue(mockPty),
          cleanup: vi.fn(),
          getSession: vi.fn()
        }

        const mockAdapterFactory = {
          getAdapter: vi.fn().mockResolvedValue(mockAdapter)
        }

        const mockPrisma = {
          executionEnvironment: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'env1',
              type: 'HOST',
              name: 'Default Host'
            })
          },
          session: {
            update: vi.fn().mockResolvedValue({})
          }
        }

        const mockConnectionManager = {
          setScrollbackBuffer: vi.fn(),
          getScrollbackBuffer: vi.fn(),
          addConnection: vi.fn(),
          removeConnection: vi.fn(),
          getConnections: vi.fn().mockReturnValue(new Set()),
          cleanup: vi.fn(),
          broadcast: vi.fn(),
          getConnectionCount: vi.fn().mockReturnValue(0)
        }

        // @ts-expect-error - private property override for testing
        manager.adapterFactory = mockAdapterFactory
        // @ts-expect-error - private property override for testing
        manager.prisma = mockPrisma
        // @ts-expect-error - private property override for testing
        manager.connectionManager = mockConnectionManager

        await manager.createSession({
          sessionId: 'duplicate-session',
          projectId: 'project1',
          branchName: 'main',
          worktreePath: '/path/to/worktree',
          environmentId: 'env1'
        })

        await expect(manager.createSession({
          sessionId: 'duplicate-session',
          projectId: 'project1',
          branchName: 'main',
          worktreePath: '/path/to/worktree',
          environmentId: 'env1'
        })).rejects.toThrow('Session duplicate-session already exists')
      })

      it('should throw error if environment not found', async () => {
        const mockPrisma = {
          executionEnvironment: {
            findUnique: vi.fn().mockResolvedValue(null)
          },
          session: {
            update: vi.fn()
          }
        }

        // @ts-expect-error - private property override for testing
        manager.prisma = mockPrisma

        await expect(manager.createSession({
          sessionId: 'no-env-session',
          projectId: 'project1',
          branchName: 'main',
          worktreePath: '/path/to/worktree',
          environmentId: 'non-existent-env'
        })).rejects.toThrow('Environment non-existent-env not found')
      })

      it('should cleanup on error during session creation', async () => {
        const mockPty = {
          pid: 1234,
          write: vi.fn(),
          resize: vi.fn(),
          kill: vi.fn(),
          onData: vi.fn(),
          onExit: vi.fn()
        }

        const mockAdapter = {
          spawn: vi.fn().mockResolvedValue(mockPty),
          cleanup: vi.fn(),
          getSession: vi.fn()
        }

        const mockAdapterFactory = {
          getAdapter: vi.fn().mockResolvedValue(mockAdapter)
        }

        const mockPrisma = {
          executionEnvironment: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'env1',
              type: 'HOST',
              name: 'Default Host'
            })
          },
          session: {
            update: vi.fn().mockRejectedValue(new Error('Database error'))
          }
        }

        const mockConnectionManager = {
          setScrollbackBuffer: vi.fn(),
          getScrollbackBuffer: vi.fn(),
          addConnection: vi.fn(),
          removeConnection: vi.fn(),
          getConnections: vi.fn().mockReturnValue(new Set()),
          cleanup: vi.fn(),
          broadcast: vi.fn(),
          getConnectionCount: vi.fn().mockReturnValue(0)
        }

        // @ts-expect-error - private property override for testing
        manager.adapterFactory = mockAdapterFactory
        // @ts-expect-error - private property override for testing
        manager.prisma = mockPrisma
        // @ts-expect-error - private property override for testing
        manager.connectionManager = mockConnectionManager

        await expect(manager.createSession({
          sessionId: 'error-session',
          projectId: 'project1',
          branchName: 'main',
          worktreePath: '/path/to/worktree',
          environmentId: 'env1'
        })).rejects.toThrow('Database error')

        expect(manager.hasSession('error-session')).toBe(false)
        expect(mockPty.kill).toHaveBeenCalled()
        expect(mockAdapter.cleanup).toHaveBeenCalledWith('error-session')
      })
    })

    describe('destroySession', () => {
      it('should destroy a session successfully', async () => {
        const mockPty = {
          pid: 1234,
          write: vi.fn(),
          resize: vi.fn(),
          kill: vi.fn(),
          onData: vi.fn(),
          onExit: vi.fn()
        }

        const mockAdapter = {
          spawn: vi.fn().mockResolvedValue(mockPty),
          cleanup: vi.fn(),
          getSession: vi.fn()
        }

        const mockAdapterFactory = {
          getAdapter: vi.fn().mockResolvedValue(mockAdapter)
        }

        const mockWs = {
          close: vi.fn()
        }

        const mockPrisma = {
          executionEnvironment: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'env1',
              type: 'HOST',
              name: 'Default Host'
            })
          },
          session: {
            update: vi.fn().mockResolvedValue({})
          }
        }

        const mockConnectionManager = {
          setScrollbackBuffer: vi.fn(),
          getScrollbackBuffer: vi.fn(),
          addConnection: vi.fn(),
          removeConnection: vi.fn(),
          getConnections: vi.fn().mockReturnValue(new Set([mockWs])),
          cleanup: vi.fn(),
          broadcast: vi.fn(),
          getConnectionCount: vi.fn().mockReturnValue(0)
        }

        // @ts-expect-error - private property override for testing
        manager.adapterFactory = mockAdapterFactory
        // @ts-expect-error - private property override for testing
        manager.prisma = mockPrisma
        // @ts-expect-error - private property override for testing
        manager.connectionManager = mockConnectionManager

        const sessionDestroyedListener = vi.fn()
        manager.on('sessionDestroyed', sessionDestroyedListener)

        await manager.createSession({
          sessionId: 'destroy-session',
          projectId: 'project1',
          branchName: 'main',
          worktreePath: '/path/to/worktree',
          environmentId: 'env1'
        })

        await manager.destroySession('destroy-session')

        expect(manager.hasSession('destroy-session')).toBe(false)
        expect(mockWs.close).toHaveBeenCalledWith(1000, 'Session destroyed')
        expect(mockConnectionManager.cleanup).toHaveBeenCalledWith('destroy-session')
        expect(mockPty.kill).toHaveBeenCalled()
        expect(mockAdapter.cleanup).toHaveBeenCalledWith('destroy-session')
        expect(mockPrisma.session.update).toHaveBeenCalledWith({
          where: { id: 'destroy-session' },
          data: {
            status: 'TERMINATED',
            active_connections: 0
          }
        })
        expect(sessionDestroyedListener).toHaveBeenCalledWith('destroy-session')
      })

      it('should silently ignore non-existent session', async () => {
        await expect(manager.destroySession('non-existent')).resolves.toBeUndefined()
      })

      it('should continue destruction even if PTY kill fails', async () => {
        const mockPty = {
          pid: 1234,
          write: vi.fn(),
          resize: vi.fn(),
          kill: vi.fn().mockImplementation(() => { throw new Error('Kill failed') }),
          onData: vi.fn(),
          onExit: vi.fn()
        }

        const mockAdapter = {
          spawn: vi.fn().mockResolvedValue(mockPty),
          cleanup: vi.fn(),
          getSession: vi.fn()
        }

        const mockAdapterFactory = {
          getAdapter: vi.fn().mockResolvedValue(mockAdapter)
        }

        const mockPrisma = {
          executionEnvironment: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'env1',
              type: 'HOST',
              name: 'Default Host'
            })
          },
          session: {
            update: vi.fn().mockResolvedValue({})
          }
        }

        const mockConnectionManager = {
          setScrollbackBuffer: vi.fn(),
          getScrollbackBuffer: vi.fn(),
          addConnection: vi.fn(),
          removeConnection: vi.fn(),
          getConnections: vi.fn().mockReturnValue(new Set()),
          cleanup: vi.fn(),
          broadcast: vi.fn(),
          getConnectionCount: vi.fn().mockReturnValue(0)
        }

        // @ts-expect-error - private property override for testing
        manager.adapterFactory = mockAdapterFactory
        // @ts-expect-error - private property override for testing
        manager.prisma = mockPrisma
        // @ts-expect-error - private property override for testing
        manager.connectionManager = mockConnectionManager

        await manager.createSession({
          sessionId: 'kill-fail-session',
          projectId: 'project1',
          branchName: 'main',
          worktreePath: '/path/to/worktree',
          environmentId: 'env1'
        })

        await manager.destroySession('kill-fail-session')

        expect(manager.hasSession('kill-fail-session')).toBe(false)
        expect(mockAdapter.cleanup).toHaveBeenCalledWith('kill-fail-session')
      })
    })

    describe('Connection Management', () => {
      it('should add connection successfully', async () => {
        const mockPty = {
          pid: 1234,
          write: vi.fn(),
          resize: vi.fn(),
          kill: vi.fn(),
          onData: vi.fn(),
          onExit: vi.fn()
        }

        const mockAdapter = {
          spawn: vi.fn().mockResolvedValue(mockPty),
          cleanup: vi.fn(),
          getSession: vi.fn()
        }

        const mockAdapterFactory = {
          getAdapter: vi.fn().mockResolvedValue(mockAdapter)
        }

        const mockPrisma = {
          executionEnvironment: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'env1',
              type: 'HOST',
              name: 'Default Host'
            })
          },
          session: {
            update: vi.fn().mockResolvedValue({})
          }
        }

        const mockConnectionManager = {
          setScrollbackBuffer: vi.fn(),
          getScrollbackBuffer: vi.fn(),
          addConnection: vi.fn(),
          removeConnection: vi.fn(),
          getConnections: vi.fn().mockReturnValue(new Set()),
          cleanup: vi.fn(),
          broadcast: vi.fn(),
          getConnectionCount: vi.fn().mockReturnValue(1)
        }

        // @ts-expect-error - private property override for testing
        manager.adapterFactory = mockAdapterFactory
        // @ts-expect-error - private property override for testing
        manager.prisma = mockPrisma
        // @ts-expect-error - private property override for testing
        manager.connectionManager = mockConnectionManager

        await manager.createSession({
          sessionId: 'conn-session',
          projectId: 'project1',
          branchName: 'main',
          worktreePath: '/path/to/worktree',
          environmentId: 'env1'
        })

        const mockWs = {} as any

        manager.addConnection('conn-session', mockWs)

        expect(mockConnectionManager.addConnection).toHaveBeenCalledWith('conn-session', mockWs)
        expect(mockPrisma.session.update).toHaveBeenCalled()
      })

      it('should throw error when adding connection to non-existent session', () => {
        const mockWs = {} as any

        expect(() => manager.addConnection('non-existent', mockWs)).toThrow('Session non-existent not found')
      })

      it('should remove connection successfully', async () => {
        const mockConnectionManager = {
          setScrollbackBuffer: vi.fn(),
          getScrollbackBuffer: vi.fn(),
          addConnection: vi.fn(),
          removeConnection: vi.fn(),
          getConnections: vi.fn().mockReturnValue(new Set()),
          cleanup: vi.fn(),
          broadcast: vi.fn(),
          getConnectionCount: vi.fn().mockReturnValue(0)
        }

        const mockPrisma = {
          session: {
            update: vi.fn().mockResolvedValue({})
          }
        }

        // @ts-expect-error - private property override for testing
        manager.connectionManager = mockConnectionManager
        // @ts-expect-error - private property override for testing
        manager.prisma = mockPrisma

        const mockWs = {} as any

        manager.removeConnection('some-session', mockWs)

        expect(mockConnectionManager.removeConnection).toHaveBeenCalledWith('some-session', mockWs)
        expect(mockPrisma.session.update).toHaveBeenCalled()
      })
    })
  })

  describe('TASK-008: PTY Event Handlers', () => {
    describe('registerPTYHandlers', () => {
      it('should register onData and onExit handlers', async () => {
        const mockPty = {
          pid: 1234,
          write: vi.fn(),
          resize: vi.fn(),
          kill: vi.fn(),
          onData: vi.fn(),
          onExit: vi.fn()
        }

        const mockAdapter = {
          spawn: vi.fn().mockResolvedValue(mockPty),
          cleanup: vi.fn(),
          getSession: vi.fn()
        }

        const mockAdapterFactory = {
          getAdapter: vi.fn().mockResolvedValue(mockAdapter)
        }

        const mockPrisma = {
          executionEnvironment: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'env1',
              type: 'HOST',
              name: 'Default Host'
            })
          },
          session: {
            update: vi.fn().mockResolvedValue({})
          }
        }

        const mockConnectionManager = {
          setScrollbackBuffer: vi.fn(),
          getScrollbackBuffer: vi.fn(),
          addConnection: vi.fn(),
          removeConnection: vi.fn(),
          getConnections: vi.fn().mockReturnValue(new Set()),
          cleanup: vi.fn(),
          broadcast: vi.fn(),
          getConnectionCount: vi.fn().mockReturnValue(0),
          registerHandler: vi.fn()
        }

        // @ts-expect-error - private property override for testing
        manager.adapterFactory = mockAdapterFactory
        // @ts-expect-error - private property override for testing
        manager.prisma = mockPrisma
        // @ts-expect-error - private property override for testing
        manager.connectionManager = mockConnectionManager

        await manager.createSession({
          sessionId: 'handler-test',
          projectId: 'project1',
          branchName: 'main',
          worktreePath: '/path/to/worktree',
          environmentId: 'env1'
        })

        expect(mockPty.onData).toHaveBeenCalled()
        expect(mockPty.onExit).toHaveBeenCalled()
        expect(mockConnectionManager.registerHandler).toHaveBeenCalledWith('handler-test', 'data', expect.any(Function))
        expect(mockConnectionManager.registerHandler).toHaveBeenCalledWith('handler-test', 'exit', expect.any(Function))
      })
    })

    describe('handlePTYData', () => {
      it('should append data to scrollback buffer and broadcast', async () => {
        const mockPty = {
          pid: 1234,
          write: vi.fn(),
          resize: vi.fn(),
          kill: vi.fn(),
          onData: vi.fn(),
          onExit: vi.fn()
        }

        const mockAdapter = {
          spawn: vi.fn().mockResolvedValue(mockPty),
          cleanup: vi.fn(),
          getSession: vi.fn()
        }

        const mockAdapterFactory = {
          getAdapter: vi.fn().mockResolvedValue(mockAdapter)
        }

        const mockBuffer = {
          append: vi.fn(),
          getScrollback: vi.fn()
        }

        const mockPrisma = {
          executionEnvironment: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'env1',
              type: 'HOST',
              name: 'Default Host'
            })
          },
          session: {
            update: vi.fn().mockResolvedValue({})
          }
        }

        const mockConnectionManager = {
          setScrollbackBuffer: vi.fn(),
          getScrollbackBuffer: vi.fn().mockReturnValue(mockBuffer),
          addConnection: vi.fn(),
          removeConnection: vi.fn(),
          getConnections: vi.fn().mockReturnValue(new Set()),
          cleanup: vi.fn(),
          broadcast: vi.fn(),
          getConnectionCount: vi.fn().mockReturnValue(0),
          registerHandler: vi.fn()
        }

        // @ts-expect-error - private property override for testing
        manager.adapterFactory = mockAdapterFactory
        // @ts-expect-error - private property override for testing
        manager.prisma = mockPrisma
        // @ts-expect-error - private property override for testing
        manager.connectionManager = mockConnectionManager

        await manager.createSession({
          sessionId: 'data-test',
          projectId: 'project1',
          branchName: 'main',
          worktreePath: '/path/to/worktree',
          environmentId: 'env1'
        })

        // onDataハンドラーを取得して呼び出す
        const dataHandler = mockPty.onData.mock.calls[0][0]
        dataHandler('test output')

        expect(mockBuffer.append).toHaveBeenCalledWith('test output')
        expect(mockConnectionManager.broadcast).toHaveBeenCalledWith('data-test', 'test output')
      })

      it('should update lastActiveAt when data is received', async () => {
        const mockPty = {
          pid: 1234,
          write: vi.fn(),
          resize: vi.fn(),
          kill: vi.fn(),
          onData: vi.fn(),
          onExit: vi.fn()
        }

        const mockAdapter = {
          spawn: vi.fn().mockResolvedValue(mockPty),
          cleanup: vi.fn(),
          getSession: vi.fn()
        }

        const mockAdapterFactory = {
          getAdapter: vi.fn().mockResolvedValue(mockAdapter)
        }

        const mockBuffer = {
          append: vi.fn(),
          getScrollback: vi.fn()
        }

        const mockPrisma = {
          executionEnvironment: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'env1',
              type: 'HOST',
              name: 'Default Host'
            })
          },
          session: {
            update: vi.fn().mockResolvedValue({})
          }
        }

        const mockConnectionManager = {
          setScrollbackBuffer: vi.fn(),
          getScrollbackBuffer: vi.fn().mockReturnValue(mockBuffer),
          addConnection: vi.fn(),
          removeConnection: vi.fn(),
          getConnections: vi.fn().mockReturnValue(new Set()),
          cleanup: vi.fn(),
          broadcast: vi.fn(),
          getConnectionCount: vi.fn().mockReturnValue(0),
          registerHandler: vi.fn()
        }

        // @ts-expect-error - private property override for testing
        manager.adapterFactory = mockAdapterFactory
        // @ts-expect-error - private property override for testing
        manager.prisma = mockPrisma
        // @ts-expect-error - private property override for testing
        manager.connectionManager = mockConnectionManager

        await manager.createSession({
          sessionId: 'active-test',
          projectId: 'project1',
          branchName: 'main',
          worktreePath: '/path/to/worktree',
          environmentId: 'env1'
        })

        const session = manager.getSession('active-test')
        const initialLastActiveAt = session?.lastActiveAt

        // Wait a bit to ensure time difference
        await new Promise(resolve => setTimeout(resolve, 10))

        // onDataハンドラーを取得して呼び出す
        const dataHandler = mockPty.onData.mock.calls[0][0]
        dataHandler('test output')

        const updatedSession = manager.getSession('active-test')
        expect(updatedSession?.lastActiveAt).not.toEqual(initialLastActiveAt)
      })
    })

    describe('handlePTYExit', () => {
      it('should broadcast exit message and destroy session', async () => {
        const mockPty = {
          pid: 1234,
          write: vi.fn(),
          resize: vi.fn(),
          kill: vi.fn(),
          onData: vi.fn(),
          onExit: vi.fn()
        }

        const mockAdapter = {
          spawn: vi.fn().mockResolvedValue(mockPty),
          cleanup: vi.fn(),
          getSession: vi.fn()
        }

        const mockAdapterFactory = {
          getAdapter: vi.fn().mockResolvedValue(mockAdapter)
        }

        const mockPrisma = {
          executionEnvironment: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'env1',
              type: 'HOST',
              name: 'Default Host'
            })
          },
          session: {
            update: vi.fn().mockResolvedValue({})
          }
        }

        const mockConnectionManager = {
          setScrollbackBuffer: vi.fn(),
          getScrollbackBuffer: vi.fn(),
          addConnection: vi.fn(),
          removeConnection: vi.fn(),
          getConnections: vi.fn().mockReturnValue(new Set()),
          cleanup: vi.fn(),
          broadcast: vi.fn(),
          getConnectionCount: vi.fn().mockReturnValue(0),
          registerHandler: vi.fn()
        }

        // @ts-expect-error - private property override for testing
        manager.adapterFactory = mockAdapterFactory
        // @ts-expect-error - private property override for testing
        manager.prisma = mockPrisma
        // @ts-expect-error - private property override for testing
        manager.connectionManager = mockConnectionManager

        await manager.createSession({
          sessionId: 'exit-test',
          projectId: 'project1',
          branchName: 'main',
          worktreePath: '/path/to/worktree',
          environmentId: 'env1'
        })

        // onExitハンドラーを取得して呼び出す
        const exitHandler = mockPty.onExit.mock.calls[0][0]
        exitHandler({ exitCode: 0, signal: undefined })

        // Wait for async destroySession
        await new Promise(resolve => setTimeout(resolve, 10))

        expect(mockConnectionManager.broadcast).toHaveBeenCalledWith('exit-test', JSON.stringify({
          type: 'exit',
          exitCode: 0
        }))
      })
    })

    describe('sendInput and resize', () => {
      it('should send input to PTY', async () => {
        const mockPty = {
          pid: 1234,
          write: vi.fn(),
          resize: vi.fn(),
          kill: vi.fn(),
          onData: vi.fn(),
          onExit: vi.fn()
        }

        const mockAdapter = {
          spawn: vi.fn().mockResolvedValue(mockPty),
          cleanup: vi.fn(),
          getSession: vi.fn()
        }

        const mockAdapterFactory = {
          getAdapter: vi.fn().mockResolvedValue(mockAdapter)
        }

        const mockPrisma = {
          executionEnvironment: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'env1',
              type: 'HOST',
              name: 'Default Host'
            })
          },
          session: {
            update: vi.fn().mockResolvedValue({})
          }
        }

        const mockConnectionManager = {
          setScrollbackBuffer: vi.fn(),
          getScrollbackBuffer: vi.fn(),
          addConnection: vi.fn(),
          removeConnection: vi.fn(),
          getConnections: vi.fn().mockReturnValue(new Set()),
          cleanup: vi.fn(),
          broadcast: vi.fn(),
          getConnectionCount: vi.fn().mockReturnValue(0),
          registerHandler: vi.fn()
        }

        // @ts-expect-error - private property override for testing
        manager.adapterFactory = mockAdapterFactory
        // @ts-expect-error - private property override for testing
        manager.prisma = mockPrisma
        // @ts-expect-error - private property override for testing
        manager.connectionManager = mockConnectionManager

        await manager.createSession({
          sessionId: 'input-test',
          projectId: 'project1',
          branchName: 'main',
          worktreePath: '/path/to/worktree',
          environmentId: 'env1'
        })

        manager.sendInput('input-test', 'test command\n')

        expect(mockPty.write).toHaveBeenCalledWith('test command\n')
      })

      it('should resize PTY', async () => {
        const mockPty = {
          pid: 1234,
          write: vi.fn(),
          resize: vi.fn(),
          kill: vi.fn(),
          onData: vi.fn(),
          onExit: vi.fn()
        }

        const mockAdapter = {
          spawn: vi.fn().mockResolvedValue(mockPty),
          cleanup: vi.fn(),
          getSession: vi.fn()
        }

        const mockAdapterFactory = {
          getAdapter: vi.fn().mockResolvedValue(mockAdapter)
        }

        const mockPrisma = {
          executionEnvironment: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'env1',
              type: 'HOST',
              name: 'Default Host'
            })
          },
          session: {
            update: vi.fn().mockResolvedValue({})
          }
        }

        const mockConnectionManager = {
          setScrollbackBuffer: vi.fn(),
          getScrollbackBuffer: vi.fn(),
          addConnection: vi.fn(),
          removeConnection: vi.fn(),
          getConnections: vi.fn().mockReturnValue(new Set()),
          cleanup: vi.fn(),
          broadcast: vi.fn(),
          getConnectionCount: vi.fn().mockReturnValue(0),
          registerHandler: vi.fn()
        }

        // @ts-expect-error - private property override for testing
        manager.adapterFactory = mockAdapterFactory
        // @ts-expect-error - private property override for testing
        manager.prisma = mockPrisma
        // @ts-expect-error - private property override for testing
        manager.connectionManager = mockConnectionManager

        await manager.createSession({
          sessionId: 'resize-test',
          projectId: 'project1',
          branchName: 'main',
          worktreePath: '/path/to/worktree',
          environmentId: 'env1'
        })

        manager.resize('resize-test', 100, 30)

        expect(mockPty.resize).toHaveBeenCalledWith(100, 30)
      })

      it('should throw error when sending input to non-existent session', () => {
        expect(() => manager.sendInput('non-existent', 'data')).toThrow('Session non-existent not found')
      })

      it('should throw error when resizing non-existent session', () => {
        expect(() => manager.resize('non-existent', 80, 24)).toThrow('Session non-existent not found')
      })

      it('should update lastActiveAt when sending input', async () => {
        const mockPty = {
          pid: 1234,
          write: vi.fn(),
          resize: vi.fn(),
          kill: vi.fn(),
          onData: vi.fn(),
          onExit: vi.fn()
        }

        const mockAdapter = {
          spawn: vi.fn().mockResolvedValue(mockPty),
          cleanup: vi.fn(),
          getSession: vi.fn()
        }

        const mockAdapterFactory = {
          getAdapter: vi.fn().mockResolvedValue(mockAdapter)
        }

        const mockPrisma = {
          executionEnvironment: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'env1',
              type: 'HOST',
              name: 'Default Host'
            })
          },
          session: {
            update: vi.fn().mockResolvedValue({})
          }
        }

        const mockConnectionManager = {
          setScrollbackBuffer: vi.fn(),
          getScrollbackBuffer: vi.fn(),
          addConnection: vi.fn(),
          removeConnection: vi.fn(),
          getConnections: vi.fn().mockReturnValue(new Set()),
          cleanup: vi.fn(),
          broadcast: vi.fn(),
          getConnectionCount: vi.fn().mockReturnValue(0),
          registerHandler: vi.fn()
        }

        // @ts-expect-error - private property override for testing
        manager.adapterFactory = mockAdapterFactory
        // @ts-expect-error - private property override for testing
        manager.prisma = mockPrisma
        // @ts-expect-error - private property override for testing
        manager.connectionManager = mockConnectionManager

        await manager.createSession({
          sessionId: 'active-input-test',
          projectId: 'project1',
          branchName: 'main',
          worktreePath: '/path/to/worktree',
          environmentId: 'env1'
        })

        const session = manager.getSession('active-input-test')
        const initialLastActiveAt = session?.lastActiveAt

        // Wait a bit to ensure time difference
        await new Promise(resolve => setTimeout(resolve, 10))

        manager.sendInput('active-input-test', 'command\n')

        const updatedSession = manager.getSession('active-input-test')
        expect(updatedSession?.lastActiveAt).not.toEqual(initialLastActiveAt)
      })
    })
  })
})
