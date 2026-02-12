import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PTYSessionManager } from '../pty-session-manager'
import { ConnectionManager } from '@/lib/websocket/connection-manager'
import { AdapterFactory } from '../adapter-factory'

// ConnectionManagerをモック
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
      getScrollbackBuffer: vi.fn(),
      registerHandler: vi.fn(),
      removeHandlers: vi.fn()
    })
  }
}))

// ClaudePTYManagerをモック（循環依存を防ぐ）
vi.mock('../claude-pty-manager', () => ({
  ClaudePTYManager: {
    getInstance: vi.fn().mockReturnValue({})
  }
}))

// AdapterFactoryは実装をそのまま使い、必要に応じてspyOnする
// dbモックをvi.hoisted()で先に定義
const { mockDbExecutionEnvironment, mockDbUpdate, mockDbSelect } = vi.hoisted(() => {
  const mockDbExecutionEnvironment = {
    findUnique: vi.fn().mockResolvedValue({
      id: 'env1',
      type: 'HOST',
      name: 'Default Host'
    })
  }

  // Drizzle ORMのチェーン形式をモック
  const mockDbUpdate = vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue({})
    })
  })

  const mockDbSelect = vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([])
    })
  })

  return { mockDbExecutionEnvironment, mockDbUpdate, mockDbSelect }
})

vi.mock('@/lib/db', () => ({
  db: {
    query: {
      executionEnvironments: { findFirst: mockDbExecutionEnvironment.findUnique }
    },
    executionEnvironment: mockDbExecutionEnvironment,
    update: mockDbUpdate,
    select: mockDbSelect
  }
}))

// sessions schemaのモック
vi.mock('@/db/schema', () => ({
  sessions: {
    id: 'id',
    status: 'status',
    active_connections: 'active_connections',
    last_activity_at: 'last_activity_at',
    session_state: 'session_state',
    destroy_at: 'destroy_at',
    updated_at: 'updated_at',
    resume_session_id: 'resume_session_id'
  },
  executionEnvironments: {},
  projects: {}
}))

// drizzle-ormのeq関数をモック
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field, value) => ({ field, value })),
  inArray: vi.fn((field, values) => ({ field, values }))
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
    // モックをリセット
    vi.clearAllMocks()

    // dbモックのデフォルト設定
    mockDbExecutionEnvironment.findUnique.mockResolvedValue({
      id: 'env1',
      type: 'HOST',
      name: 'Default Host'
    })

    // Drizzle ORMのチェーン形式をモック
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({})
      })
    })

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

  describe.skip('ConnectionManager Integration', () => {
    // ConnectionManagerの統合テストは不要
    // PTYSessionManagerのテストで間接的にテストされる
  })

  describe.skip('AdapterFactory Integration', () => {
    // AdapterFactoryはシングルトンではなく、静的メソッドを持つユーティリティクラス
    it('should use AdapterFactory.getAdapter() to get adapters', () => {
      // テストは各個別テストでspyOnを使用
    })
  })

  describe('getConnectionCount', () => {
    it('should delegate to ConnectionManager', () => {
      const connectionManagerSpy = vi.spyOn(ConnectionManager.getInstance(), 'getConnectionCount').mockReturnValue(5)

      const count = manager.getConnectionCount('test-session')

      expect(count).toBe(5)
      expect(connectionManagerSpy).toHaveBeenCalledWith('test-session')

      connectionManagerSpy.mockRestore()
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
          createSession: vi.fn().mockResolvedValue(mockPty),
          destroySession: vi.fn(),
          write: vi.fn(),
          resize: vi.fn(),
          hasSession: vi.fn(),
          on: vi.fn(),
          emit: vi.fn()
        }

        // AdapterFactoryをモック
        const adapterFactorySpy = vi.spyOn(AdapterFactory, 'getAdapter').mockReturnValue(mockAdapter)

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
        expect(session.adapter).toBe(mockAdapter)
        expect(session.environmentType).toBe('HOST')
        expect(session.metadata.projectId).toBe('project1')
        expect(manager.hasSession('test-session')).toBe(true)
        expect(adapterFactorySpy).toHaveBeenCalledWith(expect.objectContaining({
          id: 'env1',
          type: 'HOST'
        }))
        expect(mockAdapter.createSession).toHaveBeenCalledWith(
          'test-session',
          '/path/to/worktree',
          undefined,
          expect.objectContaining({})
        )
        expect(mockDbUpdate).toHaveBeenCalled()
        expect(sessionCreatedListener).toHaveBeenCalledWith('test-session')

        adapterFactorySpy.mockRestore()
      })

      it('should throw error if session already exists', async () => {
        const mockAdapter = {
          createSession: vi.fn().mockResolvedValue(undefined),
          destroySession: vi.fn(),
          write: vi.fn(),
          resize: vi.fn(),
          hasSession: vi.fn(),
          on: vi.fn(),
          emit: vi.fn()
        }

        const adapterFactorySpy = vi.spyOn(AdapterFactory, 'getAdapter').mockReturnValue(mockAdapter)

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

        adapterFactorySpy.mockRestore()
      })

      it('should throw error if environment not found', async () => {
        // dbモックを更新
        mockDbExecutionEnvironment.findUnique.mockResolvedValue(null)

        await expect(manager.createSession({
          sessionId: 'no-env-session',
          projectId: 'project1',
          branchName: 'main',
          worktreePath: '/path/to/worktree',
          environmentId: 'non-existent-env'
        })).rejects.toThrow('Environment non-existent-env not found')
      })

      it.skip('should cleanup on error during session creation', async () => {
        const mockAdapter = {
          createSession: vi.fn().mockResolvedValue(undefined),
          destroySession: vi.fn(),
          write: vi.fn(),
          resize: vi.fn(),
          hasSession: vi.fn(),
          on: vi.fn(),
          emit: vi.fn()
        }

        const adapterFactorySpy = vi.spyOn(AdapterFactory, 'getAdapter').mockReturnValue(mockAdapter)
        mockDbUpdate.mockRejectedValue(new Error('Database error'))

        await expect(manager.createSession({
          sessionId: 'error-session',
          projectId: 'project1',
          branchName: 'main',
          worktreePath: '/path/to/worktree',
          environmentId: 'env1'
        })).rejects.toThrow('Database error')

        expect(manager.hasSession('error-session')).toBe(false)
        expect(mockAdapter.destroySession).toHaveBeenCalledWith('error-session')

        adapterFactorySpy.mockRestore()
      })
    })

    describe('destroySession', () => {
      it.skip('should destroy a session successfully', async () => {
        const mockAdapter = {
          createSession: vi.fn().mockResolvedValue(undefined),
          destroySession: vi.fn(),
          write: vi.fn(),
          resize: vi.fn(),
          hasSession: vi.fn(),
          on: vi.fn(),
          emit: vi.fn()
        }

        const mockWs = {
          close: vi.fn()
        }

        const adapterFactorySpy = vi.spyOn(AdapterFactory, 'getAdapter').mockReturnValue(mockAdapter)
        const connectionManagerSpy = vi.spyOn(ConnectionManager.getInstance(), 'getConnections').mockReturnValue(new Set([mockWs]))

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
        expect(mockAdapter.destroySession).toHaveBeenCalledWith('destroy-session')
        expect(mockDbUpdate).toHaveBeenCalled()
        expect(sessionDestroyedListener).toHaveBeenCalledWith('destroy-session')

        adapterFactorySpy.mockRestore()
        connectionManagerSpy.mockRestore()
      })

      it('should silently ignore non-existent session', async () => {
        await expect(manager.destroySession('non-existent')).resolves.toBeUndefined()
      })

      it.skip('should continue destruction even if adapter destroy fails', async () => {
        const mockAdapter = {
          createSession: vi.fn().mockResolvedValue(undefined),
          destroySession: vi.fn().mockImplementation(() => { throw new Error('Destroy failed') }),
          write: vi.fn(),
          resize: vi.fn(),
          hasSession: vi.fn(),
          on: vi.fn(),
          emit: vi.fn()
        }

        const adapterFactorySpy = vi.spyOn(AdapterFactory, 'getAdapter').mockReturnValue(mockAdapter)

        await manager.createSession({
          sessionId: 'destroy-fail-session',
          projectId: 'project1',
          branchName: 'main',
          worktreePath: '/path/to/worktree',
          environmentId: 'env1'
        })

        await manager.destroySession('destroy-fail-session')

        expect(manager.hasSession('destroy-fail-session')).toBe(false)
        expect(mockAdapter.destroySession).toHaveBeenCalledWith('destroy-fail-session')

        adapterFactorySpy.mockRestore()
      })
    })

    describe('Connection Management', () => {
      it('should add connection successfully', async () => {
        const mockAdapter = {
          createSession: vi.fn().mockResolvedValue(undefined),
          destroySession: vi.fn(),
          write: vi.fn(),
          resize: vi.fn(),
          hasSession: vi.fn(),
          on: vi.fn(),
          emit: vi.fn()
        }

        const adapterFactorySpy = vi.spyOn(AdapterFactory, 'getAdapter').mockReturnValue(mockAdapter)
        const connectionCountSpy = vi.spyOn(ConnectionManager.getInstance(), 'getConnectionCount').mockReturnValue(1)

        await manager.createSession({
          sessionId: 'conn-session',
          projectId: 'project1',
          branchName: 'main',
          worktreePath: '/path/to/worktree',
          environmentId: 'env1'
        })

        const mockWs = {} as any

        manager.addConnection('conn-session', mockWs)

        expect(mockDbUpdate).toHaveBeenCalled()

        adapterFactorySpy.mockRestore()
        connectionCountSpy.mockRestore()
      })

      it('should throw error when adding connection to non-existent session', () => {
        const mockWs = {} as any

        expect(() => manager.addConnection('non-existent', mockWs)).toThrow('Session non-existent not found')
      })

      it('should remove connection successfully', async () => {
        const mockWs = {} as any

        manager.removeConnection('some-session', mockWs)

        expect(mockDbUpdate).toHaveBeenCalled()
      })
    })
  })

  describe.skip('TASK-008: PTY Event Handlers', () => {
    describe('registerAdapterHandlers', () => {
      it('should register data and exit event handlers', async () => {
        const mockAdapter = {
          createSession: vi.fn().mockResolvedValue(undefined),
          destroySession: vi.fn(),
          write: vi.fn(),
          resize: vi.fn(),
          hasSession: vi.fn(),
          on: vi.fn(),
          emit: vi.fn()
        }

        const adapterFactorySpy = vi.spyOn(AdapterFactory, 'getAdapter').mockReturnValue(mockAdapter)

        await manager.createSession({
          sessionId: 'handler-test',
          projectId: 'project1',
          branchName: 'main',
          worktreePath: '/path/to/worktree',
          environmentId: 'env1'
        })

        expect(mockAdapter.on).toHaveBeenCalledWith('data', expect.any(Function))
        expect(mockAdapter.on).toHaveBeenCalledWith('exit', expect.any(Function))

        adapterFactorySpy.mockRestore()
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

        const mockBuffer = {
          append: vi.fn(),
          getScrollback: vi.fn()
        }

        // モックを更新
        mockAdapterFactory.getAdapter.mockResolvedValue(mockAdapter)
        mockConnectionManager.getScrollbackBuffer.mockReturnValue(mockBuffer)
        mockConnectionManager.registerHandler = vi.fn()

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

        const mockBuffer = {
          append: vi.fn(),
          getScrollback: vi.fn()
        }

        // モックを更新
        mockAdapterFactory.getAdapter.mockResolvedValue(mockAdapter)
        mockConnectionManager.getScrollbackBuffer.mockReturnValue(mockBuffer)
        mockConnectionManager.registerHandler = vi.fn()

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

        // モックを更新
        mockAdapterFactory.getAdapter.mockResolvedValue(mockAdapter)
        mockConnectionManager.registerHandler = vi.fn()

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

        // モックを更新
        mockAdapterFactory.getAdapter.mockResolvedValue(mockAdapter)
        mockConnectionManager.registerHandler = vi.fn()

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

        // モックを更新
        mockAdapterFactory.getAdapter.mockResolvedValue(mockAdapter)
        mockConnectionManager.registerHandler = vi.fn()

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

        // モックを更新
        mockAdapterFactory.getAdapter.mockResolvedValue(mockAdapter)
        mockConnectionManager.registerHandler = vi.fn()

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

  describe('TASK-017: Session State Persistence', () => {
    describe('Connection State Update', () => {
      it('should update active_connections when adding connection', async () => {
        const mockAdapter = {
          createSession: vi.fn().mockResolvedValue(undefined),
          destroySession: vi.fn(),
          write: vi.fn(),
          resize: vi.fn(),
          hasSession: vi.fn(),
          on: vi.fn(),
          emit: vi.fn()
        }

        const adapterFactorySpy = vi.spyOn(AdapterFactory, 'getAdapter').mockReturnValue(mockAdapter)
        const connectionCountSpy = vi.spyOn(ConnectionManager.getInstance(), 'getConnectionCount')
          .mockReturnValueOnce(0) // createSession時
          .mockReturnValueOnce(1) // addConnection時

        await manager.createSession({
          sessionId: 'state-conn-session',
          projectId: 'project1',
          branchName: 'main',
          worktreePath: '/path/to/worktree',
          environmentId: 'env1'
        })

        vi.clearAllMocks()

        const mockWs = {} as any
        manager.addConnection('state-conn-session', mockWs)

        // 非同期更新を待つ
        await new Promise(resolve => setTimeout(resolve, 10))

        expect(mockDbUpdate).toHaveBeenCalled()

        adapterFactorySpy.mockRestore()
        connectionCountSpy.mockRestore()
      })

      it('should update active_connections when removing connection', async () => {
        const mockAdapter = {
          createSession: vi.fn().mockResolvedValue(undefined),
          destroySession: vi.fn(),
          write: vi.fn(),
          resize: vi.fn(),
          hasSession: vi.fn(),
          on: vi.fn(),
          emit: vi.fn()
        }

        const adapterFactorySpy = vi.spyOn(AdapterFactory, 'getAdapter').mockReturnValue(mockAdapter)
        const connectionCountSpy = vi.spyOn(ConnectionManager.getInstance(), 'getConnectionCount')
          .mockReturnValueOnce(0) // createSession時
          .mockReturnValueOnce(0) // removeConnection時

        await manager.createSession({
          sessionId: 'state-remove-session',
          projectId: 'project1',
          branchName: 'main',
          worktreePath: '/path/to/worktree',
          environmentId: 'env1'
        })

        vi.clearAllMocks()

        const mockWs = {} as any
        manager.removeConnection('state-remove-session', mockWs)

        // 非同期更新を待つ
        await new Promise(resolve => setTimeout(resolve, 10))

        expect(mockDbUpdate).toHaveBeenCalled()

        adapterFactorySpy.mockRestore()
        connectionCountSpy.mockRestore()
      })
    })

    describe('PTY I/O State Update', () => {
      it('should update last_activity_at when PTY data is received', async () => {
        const mockAdapter = {
          createSession: vi.fn().mockResolvedValue(undefined),
          destroySession: vi.fn(),
          write: vi.fn(),
          resize: vi.fn(),
          hasSession: vi.fn(),
          on: vi.fn(),
          emit: vi.fn(),
          off: vi.fn()
        }

        const adapterFactorySpy = vi.spyOn(AdapterFactory, 'getAdapter').mockReturnValue(mockAdapter)

        await manager.createSession({
          sessionId: 'pty-data-session',
          projectId: 'project1',
          branchName: 'main',
          worktreePath: '/path/to/worktree',
          environmentId: 'env1'
        })

        // アダプターのonメソッドが呼ばれていることを確認
        expect(mockAdapter.on).toHaveBeenCalled()

        // データハンドラーを取得（vi.clearAllMocksの前に）
        const dataCalls = mockAdapter.on.mock.calls.filter(call => call[0] === 'data')
        expect(dataCalls.length).toBeGreaterThan(0)

        const dataHandler = dataCalls[0]?.[1]
        expect(dataHandler).toBeDefined()

        // clearしてから呼び出す
        vi.clearAllMocks()

        if (dataHandler) {
          dataHandler('pty-data-session', 'test output')
        }

        // 非同期更新を待つ
        await new Promise(resolve => setTimeout(resolve, 10))

        expect(mockDbUpdate).toHaveBeenCalled()

        adapterFactorySpy.mockRestore()
      })

      it('should not throw error if last_activity_at update fails', async () => {
        const mockAdapter = {
          createSession: vi.fn().mockResolvedValue(undefined),
          destroySession: vi.fn(),
          write: vi.fn(),
          resize: vi.fn(),
          hasSession: vi.fn(),
          on: vi.fn(),
          emit: vi.fn(),
          off: vi.fn()
        }

        const adapterFactorySpy = vi.spyOn(AdapterFactory, 'getAdapter').mockReturnValue(mockAdapter)

        // 最初のcreateSessionでは成功するようにモック
        mockDbUpdate.mockReturnValueOnce({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue({})
          })
        })

        await manager.createSession({
          sessionId: 'pty-error-session',
          projectId: 'project1',
          branchName: 'main',
          worktreePath: '/path/to/worktree',
          environmentId: 'env1'
        })

        // データハンドラーを取得（vi.clearAllMocksの前に）
        const dataHandler = mockAdapter.on.mock.calls.find(call => call[0] === 'data')?.[1]
        expect(dataHandler).toBeDefined()

        vi.clearAllMocks()

        // データハンドラーでの更新時にエラーが発生するようにモック
        mockDbUpdate.mockReturnValueOnce({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockRejectedValue(new Error('Database error'))
          })
        })

        if (dataHandler) {
          // エラーが発生してもスローされないことを確認
          expect(() => dataHandler('pty-error-session', 'test output')).not.toThrow()
        }

        // 非同期更新を待つ
        await new Promise(resolve => setTimeout(resolve, 10))

        adapterFactorySpy.mockRestore()
      })
    })

    describe('Session Destruction State Update', () => {
      it.skip('should mark session as TERMINATED when destroyed', async () => {
        const mockAdapter = {
          createSession: vi.fn().mockResolvedValue(undefined),
          destroySession: vi.fn(),
          write: vi.fn(),
          resize: vi.fn(),
          hasSession: vi.fn(),
          on: vi.fn(),
          emit: vi.fn(),
          off: vi.fn()
        }

        const adapterFactorySpy = vi.spyOn(AdapterFactory, 'getAdapter').mockReturnValue(mockAdapter)

        await manager.createSession({
          sessionId: 'destroy-state-session',
          projectId: 'project1',
          branchName: 'main',
          worktreePath: '/path/to/worktree',
          environmentId: 'env1'
        })

        vi.clearAllMocks()

        await manager.destroySession('destroy-state-session')

        expect(mockDbUpdate).toHaveBeenCalled()

        adapterFactorySpy.mockRestore()
      })
    })

    describe('Timer State Update', () => {
      it.skip('should set destroy_at when setDestroyTimer is called', async () => {
        const mockAdapter = {
          createSession: vi.fn().mockResolvedValue(undefined),
          destroySession: vi.fn(),
          write: vi.fn(),
          resize: vi.fn(),
          hasSession: vi.fn(),
          on: vi.fn(),
          emit: vi.fn()
        }

        const adapterFactorySpy = vi.spyOn(AdapterFactory, 'getAdapter').mockReturnValue(mockAdapter)

        await manager.createSession({
          sessionId: 'timer-session',
          projectId: 'project1',
          branchName: 'main',
          worktreePath: '/path/to/worktree',
          environmentId: 'env1'
        })

        vi.clearAllMocks()

        // setDestroyTimerメソッドを呼び出し
        const delayMs = 30 * 60 * 1000
        await (manager as any).setDestroyTimer('timer-session', delayMs)

        expect(mockDbUpdate).toHaveBeenCalled()

        adapterFactorySpy.mockRestore()
      })
    })

    describe('Error State Update', () => {
      it.skip('should mark session as ERROR when PTY exits with non-zero code', async () => {
        const mockAdapter = {
          createSession: vi.fn().mockResolvedValue(undefined),
          destroySession: vi.fn(),
          write: vi.fn(),
          resize: vi.fn(),
          hasSession: vi.fn(),
          on: vi.fn(),
          emit: vi.fn(),
          off: vi.fn()
        }

        const adapterFactorySpy = vi.spyOn(AdapterFactory, 'getAdapter').mockReturnValue(mockAdapter)

        await manager.createSession({
          sessionId: 'error-exit-session',
          projectId: 'project1',
          branchName: 'main',
          worktreePath: '/path/to/worktree',
          environmentId: 'env1'
        })

        vi.clearAllMocks()

        // exitハンドラーを取得して呼び出す
        const exitHandler = mockAdapter.on.mock.calls.find(call => call[0] === 'exit')?.[1]

        if (exitHandler) {
          exitHandler('error-exit-session', { exitCode: 1, signal: undefined })
        }

        // 非同期更新を待つ
        await new Promise(resolve => setTimeout(resolve, 10))

        expect(mockDbUpdate).toHaveBeenCalled()

        adapterFactorySpy.mockRestore()
      })
    })

    describe('Performance', () => {
      it('should update last_activity_at asynchronously without blocking', async () => {
        const mockAdapter = {
          createSession: vi.fn().mockResolvedValue(undefined),
          destroySession: vi.fn(),
          write: vi.fn(),
          resize: vi.fn(),
          hasSession: vi.fn(),
          on: vi.fn(),
          emit: vi.fn(),
          off: vi.fn()
        }

        const adapterFactorySpy = vi.spyOn(AdapterFactory, 'getAdapter').mockReturnValue(mockAdapter)

        // 最初のcreateSessionでは成功
        mockDbUpdate.mockReturnValueOnce({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue({})
          })
        })

        await manager.createSession({
          sessionId: 'perf-session',
          projectId: 'project1',
          branchName: 'main',
          worktreePath: '/path/to/worktree',
          environmentId: 'env1'
        })

        // データハンドラーを取得（vi.clearAllMocksの前に）
        const dataHandler = mockAdapter.on.mock.calls.find(call => call[0] === 'data')?.[1]
        expect(dataHandler).toBeDefined()

        vi.clearAllMocks()

        // 遅い更新をシミュレート（2回目の呼び出し）
        mockDbUpdate.mockReturnValueOnce({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(() => {
              return new Promise(resolve => {
                setTimeout(() => {
                  resolve({})
                }, 100) // 100ms遅延
              })
            })
          })
        })

        if (dataHandler) {
          const callStartTime = Date.now()
          dataHandler('perf-session', 'test output')
          const callEndTime = Date.now()

          // 非同期呼び出しなので、即座に完了するはず
          expect(callEndTime - callStartTime).toBeLessThan(50)
        }

        adapterFactorySpy.mockRestore()
      })
    })
  })
})
