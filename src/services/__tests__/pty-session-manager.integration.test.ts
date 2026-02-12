import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PTYSessionManager } from '../pty-session-manager'

/**
 * PTYSessionManager Integration Tests
 *
 * 最小限の統合テストを提供します。
 * 完全な統合テストはTASK-011で追加予定です。
 */

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
      } catch (error) {
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
