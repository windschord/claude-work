import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PTYSessionManager } from '../pty-session-manager'

/**
 * PTYSessionManager Integration Tests
 *
 * 最小限の統合テストを提供します。
 * 完全な統合テストはTASK-011で追加予定です。
 */

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
      getScrollbackBuffer: vi.fn().mockReturnValue({
        append: vi.fn(),
        getScrollback: vi.fn().mockReturnValue('')
      }),
      registerHandler: vi.fn(),
      hasHandler: vi.fn().mockReturnValue(null),
      unregisterHandler: vi.fn(),
      removeHandlers: vi.fn()
    })
  }
}))

// AdapterFactoryをモック
vi.mock('../adapter-factory', () => {
  const mockAdapter = {
    createSession: vi.fn().mockResolvedValue(undefined),
    destroySession: vi.fn(),
    write: vi.fn(),
    resize: vi.fn(),
    hasSession: vi.fn().mockReturnValue(true),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn()
  }

  return {
    AdapterFactory: {
      getAdapter: vi.fn().mockReturnValue(mockAdapter)
    }
  }
})

// loggerをモック
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}))

describe('PTYSessionManager Integration (Minimal)', () => {
  let manager: PTYSessionManager

  beforeEach(() => {
    manager = PTYSessionManager.getInstance()
  })

  afterEach(async () => {
    // クリーンアップ：すべてのセッションを破棄
    const sessions = manager.listSessions()
    for (const sessionId of sessions) {
      try {
        await manager.destroySession(sessionId)
      } catch {
        // エラーは無視（既に破棄済みの可能性）
      }
    }
  })

  it('should be a singleton', () => {
    const instance1 = PTYSessionManager.getInstance()
    const instance2 = PTYSessionManager.getInstance()

    expect(instance1).toBe(instance2)
  })

  it('should list sessions', () => {
    const sessions = manager.listSessions()

    expect(Array.isArray(sessions)).toBe(true)
  })

  it('should check session existence', () => {
    const exists = manager.hasSession('non-existent-session')

    expect(exists).toBe(false)
  })

  it('should get connection count', () => {
    const count = manager.getConnectionCount('non-existent-session')

    expect(count).toBe(0)
  })

  // TODO: TASK-011で以下のテストを追加
  // - セッション作成→接続→入力→破棄の完全フロー
  // - 複数セッションの同時管理
  // - PTYイベント（data, exit）のブロードキャスト
  // - エラーハンドリング
  // - Docker環境での動作
})
