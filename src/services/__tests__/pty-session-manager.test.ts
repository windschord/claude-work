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

  describe('Stub Methods', () => {
    it('should throw "Not implemented yet" for createSession', async () => {
      await expect(manager.createSession({
        sessionId: 'test-session',
        projectId: 'project1',
        branchName: 'main',
        worktreePath: '/path/to/worktree',
        environmentId: 'env1'
      })).rejects.toThrow('Not implemented yet')
    })

    it('should throw "Not implemented yet" for destroySession', async () => {
      await expect(manager.destroySession('test-session')).rejects.toThrow('Not implemented yet')
    })

    it('should throw "Not implemented yet" for addConnection', () => {
      const mockWs = {} as any

      expect(() => manager.addConnection('test-session', mockWs)).toThrow('Not implemented yet')
    })

    it('should throw "Not implemented yet" for removeConnection', () => {
      const mockWs = {} as any

      expect(() => manager.removeConnection('test-session', mockWs)).toThrow('Not implemented yet')
    })

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
})
