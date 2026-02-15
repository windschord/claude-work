import { EventEmitter } from 'events'
import { ConnectionManager } from '@/lib/websocket/connection-manager'
import { AdapterFactory } from './adapter-factory'
import { EnvironmentAdapter, PTYExitInfo } from './environment-adapter'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { ScrollbackBuffer } from './scrollback-buffer'
import type { ClaudeCodeOptions, CustomEnvVars } from './claude-options-service'
import type WebSocket from 'ws'
import { sessions } from '@/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { promises as fs } from 'fs'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

/**
 * PTYセッション情報
 */
export interface PTYSession {
  id: string
  adapter: EnvironmentAdapter
  environmentType: 'HOST' | 'DOCKER' | 'SSH'
  metadata: SessionMetadata
  createdAt: Date
  lastActiveAt: Date
}

/**
 * セッションメタデータ
 */
export interface SessionMetadata {
  projectId: string
  branchName: string
  worktreePath: string
  environmentId: string
}

/**
 * セッション作成オプション
 */
export interface SessionOptions {
  sessionId: string
  projectId: string
  branchName: string
  worktreePath: string
  environmentId: string
  initialPrompt?: string
  resumeSessionId?: string
  claudeCodeOptions?: ClaudeCodeOptions
  customEnvVars?: CustomEnvVars
  cols?: number
  rows?: number
}

/**
 * PTYSessionManagerインターフェース
 */
export interface IPTYSessionManager extends EventEmitter {
  // セッション管理
  createSession(options: SessionOptions): Promise<PTYSession>
  getSession(sessionId: string): PTYSession | undefined
  destroySession(sessionId: string): Promise<void>
  listSessions(): string[]
  hasSession(sessionId: string): boolean

  // 接続管理（ConnectionManagerへの委譲）
  addConnection(sessionId: string, ws: WebSocket): void
  removeConnection(sessionId: string, ws: WebSocket): void
  getConnectionCount(sessionId: string): number

  // PTYインタラクション
  sendInput(sessionId: string, data: string): void
  resize(sessionId: string, cols: number, rows: number): void

  // ライフサイクルイベント
  on(event: 'sessionCreated', listener: (sessionId: string) => void): this
  on(event: 'sessionDestroyed', listener: (sessionId: string) => void): this
  on(event: 'sessionError', listener: (sessionId: string, error: Error) => void): this
  on(event: 'data', listener: (sessionId: string, data: string) => void): this
  on(event: 'exit', listener: (sessionId: string, exitCode: number) => void): this
}

/**
 * PTYSessionManager
 *
 * PTYセッションのライフサイクル全体を統合管理するコンポーネント。
 * EnvironmentAdapterのラッパーとして動作し、セッション作成、破棄、
 * 接続管理、イベント処理を一元化する。
 */
export class PTYSessionManager extends EventEmitter implements IPTYSessionManager {
  private static instance: PTYSessionManager

  private sessions: Map<string, PTYSession> = new Map()
  private connectionManager: ConnectionManager

  /**
   * セッション破棄タイマーを管理
   */
  private destroyTimers: Map<string, NodeJS.Timeout> = new Map()

  private constructor() {
    super()
    this.connectionManager = ConnectionManager.getInstance()
    logger.info('PTYSessionManager initialized')
  }

  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): PTYSessionManager {
    if (!PTYSessionManager.instance) {
      PTYSessionManager.instance = new PTYSessionManager()
    }
    return PTYSessionManager.instance
  }

  /**
   * セッションが存在するか確認
   */
  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId)
  }

  /**
   * すべてのセッションIDを取得
   */
  listSessions(): string[] {
    return Array.from(this.sessions.keys())
  }

  /**
   * セッション情報を取得
   */
  getSession(sessionId: string): PTYSession | undefined {
    return this.sessions.get(sessionId)
  }

  /**
   * セッションを作成
   *
   * @throws セッションが既に存在する場合
   * @throws 環境が見つからない場合
   */
  async createSession(options: SessionOptions): Promise<PTYSession> {
    const {
      sessionId,
      projectId,
      environmentId,
      worktreePath,
      branchName,
      initialPrompt,
      resumeSessionId,
      claudeCodeOptions,
      customEnvVars
    } = options

    // 既存セッションのチェック
    if (this.sessions.has(sessionId)) {
      throw new Error(`Session ${sessionId} already exists`)
    }

    logger.info(`Creating session ${sessionId} for environment ${environmentId}`)

    try {
      // 環境情報を取得
      const environment = await db.query.executionEnvironments.findFirst({
        where: (environments, { eq }) => eq(environments.id, environmentId)
      })

      if (!environment) {
        throw new Error(`Environment ${environmentId} not found`)
      }

      // アダプターを取得（環境全体を渡す）
      const adapter = AdapterFactory.getAdapter(environment)

      // アダプター経由でセッション作成
      await adapter.createSession(
        sessionId,
        worktreePath,
        initialPrompt,
        {
          resumeSessionId,
          claudeCodeOptions,
          customEnvVars,
          cols: options.cols,
          rows: options.rows,
        }
      )

      // セッション情報を作成
      const session: PTYSession = {
        id: sessionId,
        adapter,
        environmentType: environment.type as 'HOST' | 'DOCKER' | 'SSH',
        metadata: {
          projectId,
          branchName,
          worktreePath,
          environmentId
        },
        createdAt: new Date(),
        lastActiveAt: new Date()
      }

      // セッションを登録
      this.sessions.set(sessionId, session)

      // スクロールバックバッファを設定
      const buffer = new ScrollbackBuffer()
      this.connectionManager.setScrollbackBuffer(sessionId, buffer)

      // アダプターのイベントハンドラーを登録（セッションごとに1つ）
      this.registerAdapterHandlers(sessionId, adapter)

      // データベースに記録
      await db.update(sessions)
        .set({
          status: 'running',
          last_activity_at: new Date(),
          updated_at: new Date()
        })
        .where(eq(sessions.id, sessionId))

      // イベントを発火
      this.emit('sessionCreated', sessionId)

      logger.info(`Session ${sessionId} created successfully`)
      return session
    } catch (error) {
      logger.error(`Failed to create session ${sessionId}:`, error)

      // 部分的に作成されたリソースをクリーンアップ
      await this.cleanupFailedSession(sessionId)

      throw error
    }
  }

  /**
   * セッションを破棄
   */
  async destroySession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      logger.warn(`Session ${sessionId} not found for destruction`)
      return
    }

    logger.info(`Destroying session ${sessionId}`)

    try {
      // タイマーをクリア
      this.clearDestroyTimer(sessionId)

      // イベントハンドラーを解除
      this.unregisterAdapterHandlers(sessionId, session.adapter)

      // 全接続を切断
      const connections = this.connectionManager.getConnections(sessionId)
      for (const ws of connections) {
        try {
          ws.close(1000, 'Session destroyed')
        } catch (error) {
          logger.error(`Failed to close connection:`, error)
        }
      }

      // ConnectionManagerのクリーンアップ
      this.connectionManager.cleanup(sessionId)

      // アダプター経由でセッション破棄
      session.adapter.destroySession(sessionId)

      // セッションをマップから削除
      this.sessions.delete(sessionId)

      // データベースを更新
      await db.update(sessions)
        .set({
          status: 'terminated',
          active_connections: 0,
          destroy_at: null,
          session_state: 'TERMINATED',
          updated_at: new Date()
        })
        .where(eq(sessions.id, sessionId))

      // イベントを発火
      this.emit('sessionDestroyed', sessionId)

      logger.info(`Session ${sessionId} destroyed successfully`)
    } catch (error) {
      logger.error(`Error during session ${sessionId} destruction:`, error)
      this.emit('sessionError', sessionId, error as Error)
      throw error
    }
  }

  /**
   * WebSocket接続を追加
   */
  addConnection(sessionId: string, ws: WebSocket): void {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    // ConnectionManagerに委譲
    this.connectionManager.addConnection(sessionId, ws)

    // データベースの接続数を更新
    this.updateConnectionCount(sessionId).catch(error => {
      logger.error(`Failed to update connection count:`, error)
    })
  }

  /**
   * WebSocket接続を削除
   */
  removeConnection(sessionId: string, ws: WebSocket): void {
    this.connectionManager.removeConnection(sessionId, ws)

    // データベースの接続数を更新
    this.updateConnectionCount(sessionId).catch(error => {
      logger.error(`Failed to update connection count:`, error)
    })
  }

  /**
   * セッションの接続数を取得
   */
  getConnectionCount(sessionId: string): number {
    return this.connectionManager.getConnectionCount(sessionId)
  }

  /**
   * PTYに入力を送信
   */
  sendInput(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    session.adapter.write(sessionId, data)
    session.lastActiveAt = new Date()
  }

  /**
   * PTYのサイズを変更
   */
  resize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    session.adapter.resize(sessionId, cols, rows)
    logger.debug(`Resized session ${sessionId} to ${cols}x${rows}`)
  }

  /**
   * アダプターのイベントハンドラーを登録
   */
  private registerAdapterHandlers(sessionId: string, adapter: EnvironmentAdapter): void {
    // データハンドラー（出力）
    const dataHandler = (sid: string, data: string) => {
      if (sid === sessionId) {
        this.handleData(sessionId, data)
      }
    }

    // 終了ハンドラー
    const exitHandler = (sid: string, info: PTYExitInfo) => {
      if (sid === sessionId) {
        this.handleExit(sessionId, info.exitCode)
      }
    }

    // エラーハンドラー
    const errorHandler = (sid: string, error: Error) => {
      if (sid === sessionId) {
        this.handleError(sessionId, error)
      }
    }

    // ClaudeセッションIDハンドラー
    const claudeSessionIdHandler = (sid: string, claudeSessionId: string) => {
      if (sid === sessionId) {
        this.handleClaudeSessionId(sessionId, claudeSessionId)
      }
    }

    // ハンドラーを登録
    adapter.on('data', dataHandler)
    adapter.on('exit', exitHandler)
    adapter.on('error', errorHandler)
    adapter.on('claudeSessionId', claudeSessionIdHandler)

    // ハンドラーを記録（解除時に使用）
    this.connectionManager.registerHandler(sessionId, 'data', dataHandler)
    this.connectionManager.registerHandler(sessionId, 'exit', exitHandler)
    this.connectionManager.registerHandler(sessionId, 'error', errorHandler)
    this.connectionManager.registerHandler(sessionId, 'claudeSessionId', claudeSessionIdHandler)

    logger.debug(`Registered adapter handlers for session ${sessionId}`)
  }

  /**
   * アダプターのイベントハンドラーを解除
   */
  private unregisterAdapterHandlers(sessionId: string, adapter: EnvironmentAdapter): void {
    const dataHandler = this.connectionManager.getHandler(sessionId, 'data')
    const exitHandler = this.connectionManager.getHandler(sessionId, 'exit')
    const errorHandler = this.connectionManager.getHandler(sessionId, 'error')
    const claudeSessionIdHandler = this.connectionManager.getHandler(sessionId, 'claudeSessionId')

    if (dataHandler) {
      adapter.off('data', dataHandler)
      this.connectionManager.unregisterHandler(sessionId, 'data')
    }

    if (exitHandler) {
      adapter.off('exit', exitHandler)
      this.connectionManager.unregisterHandler(sessionId, 'exit')
    }

    if (errorHandler) {
      adapter.off('error', errorHandler)
      this.connectionManager.unregisterHandler(sessionId, 'error')
    }

    if (claudeSessionIdHandler) {
      adapter.off('claudeSessionId', claudeSessionIdHandler)
      this.connectionManager.unregisterHandler(sessionId, 'claudeSessionId')
    }

    logger.debug(`Unregistered adapter handlers for session ${sessionId}`)
  }

  /**
   * データハンドラー
   */
  private handleData(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) {
      logger.warn(`Received data for unknown session ${sessionId}`)
      return
    }

    // 最終アクティブ時刻を更新
    session.lastActiveAt = new Date()

    // スクロールバックバッファに追加
    const buffer = this.connectionManager.getScrollbackBuffer(sessionId)
    if (buffer) {
      buffer.append(sessionId, data)
    }

    // 全接続にブロードキャスト（JSON形式でラップ）
    try {
      this.connectionManager.broadcast(sessionId, JSON.stringify({
        type: 'data',
        content: data
      }))
    } catch (err) {
      logger.error(`Failed to broadcast data for session ${sessionId}:`, err)
    }

    // dataイベントを発火
    this.emit('data', sessionId, data)

    // データベースの最終アクティブ時刻を更新（非同期、待機しない）
    this.updateLastActivityTime(sessionId).catch(error => {
      logger.error(`Failed to update last_activity_at for ${sessionId}:`, error)
    })
  }

  /**
   * 終了ハンドラー
   */
  private handleExit(sessionId: string, exitCode: number): void {
    logger.info(`PTY exited for session ${sessionId} with code ${exitCode}`)

    const session = this.sessions.get(sessionId)
    if (!session) {
      logger.warn(`PTY exit for unknown session ${sessionId}`)
      return
    }

    // 接続中のクライアントに通知
    try {
      this.connectionManager.broadcast(sessionId, JSON.stringify({
        type: 'exit',
        exitCode
      }))
    } catch (err) {
      logger.error(`Failed to broadcast exit for session ${sessionId}:`, err)
    }

    // exitイベントを発火
    this.emit('exit', sessionId, exitCode)

    // セッションを破棄（非同期）
    this.destroySession(sessionId).catch(error => {
      logger.error(`Failed to destroy session after PTY exit:`, error)
    })
  }

  /**
   * エラーハンドラー
   */
  private handleError(sessionId: string, error: Error): void {
    logger.error(`Error for session ${sessionId}:`, {
      error,
      message: error.message,
      hasSession: this.sessions.has(sessionId),
      connectionCount: this.connectionManager.getConnectionCount(sessionId),
    })

    // 接続中のクライアントに通知
    try {
      this.connectionManager.broadcast(sessionId, JSON.stringify({
        type: 'error',
        message: error.message
      }))
    } catch (err) {
      logger.error(`Failed to broadcast error for session ${sessionId}:`, err)
    }

    // sessionErrorイベントを発火
    this.emit('sessionError', sessionId, error)
  }

  /**
   * ClaudeセッションIDハンドラー
   */
  private handleClaudeSessionId(sessionId: string, claudeSessionId: string): void {
    logger.info(`Claude session ID detected for ${sessionId}: ${claudeSessionId}`)

    // データベースにClaude session IDを保存
    db.update(sessions)
      .set({
        resume_session_id: claudeSessionId,
        updated_at: new Date()
      })
      .where(eq(sessions.id, sessionId))
      .catch(error => {
        logger.error(`Failed to save Claude session ID for ${sessionId}:`, error)
      })
  }

  /**
   * 失敗したセッションのクリーンアップ
   */
  private async cleanupFailedSession(sessionId: string): Promise<void> {
    try {
      const session = this.sessions.get(sessionId)
      if (session) {
        // イベントハンドラーを解除
        this.unregisterAdapterHandlers(sessionId, session.adapter)

        // アダプター経由で破棄を試行
        try {
          session.adapter.destroySession(sessionId)
        } catch (error) {
          logger.error(`Failed to destroy session during cleanup:`, error)
        }

        this.sessions.delete(sessionId)
      }

      // ConnectionManagerのクリーンアップ
      this.connectionManager.cleanup(sessionId)

      // データベースの状態を更新
      await db.update(sessions)
        .set({
          status: 'error',
          updated_at: new Date()
        })
        .where(eq(sessions.id, sessionId))
    } catch (error) {
      logger.error(`Error during failed session cleanup:`, error)
    }
  }

  /**
   * データベースの接続数を更新
   */
  private async updateConnectionCount(sessionId: string): Promise<void> {
    const count = this.connectionManager.getConnectionCount(sessionId)

    if (count === 0) {
      // 最後の接続が切断された場合、IDLE状態にしてタイマーを設定
      await db.update(sessions)
        .set({
          active_connections: 0,
          session_state: 'IDLE',
          updated_at: new Date()
        })
        .where(eq(sessions.id, sessionId))

      // 30分後に自動破棄するタイマーを設定
      const delayMs = 30 * 60 * 1000 // 30分
      await this.setDestroyTimer(sessionId, delayMs)
      logger.info(`Session ${sessionId} switched to IDLE, destroy timer set`)
    } else {
      // 接続がある場合、ACTIVE状態にしてタイマーをクリア
      this.clearDestroyTimer(sessionId)
      await db.update(sessions)
        .set({
          active_connections: count,
          session_state: 'ACTIVE',
          destroy_at: null,
          updated_at: new Date()
        })
        .where(eq(sessions.id, sessionId))
    }
  }

  /**
   * データベースの最終アクティブ時刻を更新
   */
  private async updateLastActivityTime(sessionId: string): Promise<void> {
    await db.update(sessions)
      .set({
        last_activity_at: new Date(),
        updated_at: new Date()
      })
      .where(eq(sessions.id, sessionId))
  }

  /**
   * セッション破棄タイマーを設定
   * 指定時間後にセッションを自動的に破棄する
   */
  async setDestroyTimer(sessionId: string, delayMs: number): Promise<void> {
    try {
      // 既存のタイマーをクリア
      this.clearDestroyTimer(sessionId)

      // destroy_atを設定
      const destroyAt = new Date(Date.now() + delayMs)
      await db.update(sessions)
        .set({
          destroy_at: destroyAt,
          session_state: 'IDLE',
          updated_at: new Date()
        })
        .where(eq(sessions.id, sessionId))

      // 新しいタイマーを設定
      const timer = setTimeout(async () => {
        logger.info(`Destroy timer expired for session ${sessionId}`)
        this.destroyTimers.delete(sessionId)
        await this.destroySession(sessionId)
      }, delayMs)

      this.destroyTimers.set(sessionId, timer)
      logger.info(`Destroy timer set for session ${sessionId}, delay: ${delayMs}ms`)
    } catch (error) {
      logger.error(`Failed to set destroy timer for session ${sessionId}:`, error)
      throw error
    }
  }

  /**
   * セッション破棄タイマーをクリア
   */
  private clearDestroyTimer(sessionId: string): void {
    const timer = this.destroyTimers.get(sessionId)
    if (timer) {
      clearTimeout(timer)
      this.destroyTimers.delete(sessionId)
      logger.debug(`Destroy timer cleared for session ${sessionId}`)
    }
  }

  /**
   * PTYが存在するか確認
   */
  private async checkPTYExists(session: any): Promise<boolean> {
    try {
      // Worktreeが存在するか確認
      const worktreeExists = await fs.access(session.worktree_path)
        .then(() => true)
        .catch(() => false)

      if (!worktreeExists) {
        logger.warn(`Worktree not found for session ${session.id}: ${session.worktree_path}`)
        return false
      }

      // Docker環境の場合、コンテナが存在するか確認
      if (session.container_id) {
        const containerExists = await this.checkDockerContainerExists(session.container_id)
        if (!containerExists) {
          logger.warn(`Docker container not found for session ${session.id}: ${session.container_id}`)
          return false
        }
      }

      return true
    } catch (error) {
      logger.error(`Failed to check PTY existence for session ${session.id}:`, error)
      return false
    }
  }

  /**
   * Dockerコンテナが存在するか確認
   */
  private async checkDockerContainerExists(containerId: string): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`docker inspect ${containerId}`)
      const containers = JSON.parse(stdout)
      return containers.length > 0 && containers[0].State.Running
    } catch {
      return false
    }
  }

  /**
   * 孤立セッションをクリーンアップ
   */
  private async cleanupOrphanedSession(session: any): Promise<void> {
    try {
      logger.info(`Cleaning up orphaned session ${session.id}`)

      // Dockerコンテナを削除（該当する場合）
      if (session.container_id) {
        try {
          await execAsync(`docker rm -f ${session.container_id}`)
          logger.info(`Removed Docker container for orphaned session ${session.id}`)
        } catch (error) {
          logger.error(`Failed to remove container ${session.container_id}:`, error)
        }
      }

      // セッションをTERMINATED状態に更新
      await db.update(sessions)
        .set({
          session_state: 'TERMINATED',
          active_connections: 0,
          destroy_at: null,
          container_id: null,
          updated_at: new Date()
        })
        .where(eq(sessions.id, session.id))

      logger.info(`Cleaned up orphaned session ${session.id}`)
    } catch (error) {
      logger.error(`Failed to cleanup orphaned session ${session.id}:`, error)

      // 最低限ERRORマークは付ける
      await db.update(sessions)
        .set({ session_state: 'ERROR', updated_at: new Date() })
        .where(eq(sessions.id, session.id))
        .catch(() => {})
    }
  }

  /**
   * タイマーを再設定
   */
  private async restoreDestroyTimer(sessionId: string, destroyAt: Date): Promise<void> {
    const now = new Date()
    const remainingMs = destroyAt.getTime() - now.getTime()

    if (remainingMs <= 0) {
      // 期限切れ、即座に破棄
      logger.info(`Destroy timer expired for session ${sessionId}, destroying immediately`)
      await this.destroySession(sessionId)
    } else {
      // タイマーを再設定
      logger.info(`Restoring destroy timer for session ${sessionId}, remaining: ${remainingMs}ms`)
      // タイマー設定はsetDestroyTimerメソッドが実装されている前提
      // 現在は実装されていないため、ログのみ
      logger.warn(`setDestroyTimer method not implemented yet for session ${sessionId}`)
    }
  }

  /**
   * サーバー起動時にセッションを復元
   */
  async restoreSessionsOnStartup(): Promise<void> {
    const startTime = Date.now()
    logger.info('Restoring sessions from database')

    try {
      // ACTIVE/IDLEセッションを取得
      const sessionRecords = await db.select()
        .from(sessions)
        .where(inArray(sessions.session_state, ['ACTIVE', 'IDLE']))

      logger.info(`Found ${sessionRecords.length} sessions to restore`)

      for (const session of sessionRecords) {
        try {
          // PTYが存在するか確認
          const ptyExists = await this.checkPTYExists(session)

          if (ptyExists) {
            // セッションを復元（現在は内部状態のみ復元）
            logger.info(`Session ${session.id} PTY exists, skipping full restoration`)

            // タイマーを再設定
            if (session.destroy_at) {
              await this.restoreDestroyTimer(session.id, session.destroy_at)
            }

            logger.info(`Restored session ${session.id}`)
          } else {
            // 孤立セッション
            logger.warn(`Orphaned session detected: ${session.id}`)
            await this.cleanupOrphanedSession(session)
          }
        } catch (error) {
          logger.error(`Failed to restore session ${session.id}:`, error)

          // セッションをERROR状態に更新
          await db.update(sessions)
            .set({ session_state: 'ERROR', updated_at: new Date() })
            .where(eq(sessions.id, session.id))
            .catch(() => {})
        }
      }

      const duration = Date.now() - startTime
      logger.info(`Session restoration completed in ${duration}ms`)

      // パフォーマンス警告
      if (duration > 10000) {
        logger.warn(`Session restoration took longer than 10 seconds: ${duration}ms`)
      }
    } catch (error) {
      logger.error('Failed to restore sessions on startup:', error)
    }
  }
}

/**
 * グローバルPTYSessionManagerインスタンス
 */
export const ptySessionManager = PTYSessionManager.getInstance()
