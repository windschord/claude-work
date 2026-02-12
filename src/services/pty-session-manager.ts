import { EventEmitter } from 'events'
import { ConnectionManager } from '@/lib/websocket/connection-manager'
import { AdapterFactory } from './adapter-factory'
import { EnvironmentAdapter, PTYExitInfo } from './environment-adapter'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { ScrollbackBuffer } from './scrollback-buffer'
import type { ClaudeCodeOptions, CustomEnvVars } from './claude-options-service'
import type WebSocket from 'ws'

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
      const environment = await db.executionEnvironment.findUnique({
        where: { id: environmentId }
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
          customEnvVars
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
      await db.session.update({
        where: { id: sessionId },
        data: {
          status: 'running',
          last_active_at: new Date()
        }
      })

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
      await db.session.update({
        where: { id: sessionId },
        data: {
          status: 'terminated',
          active_connections: 0
        }
      })

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
    this.updateConnectionCount(sessionId).catch(_error => {
      logger.error(`Failed to update connection count:`, _error)
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
    const dataHandler = this.connectionManager.hasHandler(sessionId, 'data')
    const exitHandler = this.connectionManager.hasHandler(sessionId, 'exit')
    const errorHandler = this.connectionManager.hasHandler(sessionId, 'error')
    const claudeSessionIdHandler = this.connectionManager.hasHandler(sessionId, 'claudeSessionId')

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
      buffer.append(data)
    }

    // 全接続にブロードキャスト
    this.connectionManager.broadcast(sessionId, data)

    // dataイベントを発火
    this.emit('data', sessionId, data)

    // データベースの最終アクティブ時刻を更新（非同期、待機しない）
    this.updateLastActiveTime(sessionId).catch(error => {
      logger.error(`Failed to update last_active_at for ${sessionId}:`, error)
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
    this.connectionManager.broadcast(sessionId, JSON.stringify({
      type: 'exit',
      exitCode
    }))

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
    logger.error(`Error for session ${sessionId}:`, error)

    // 接続中のクライアントに通知
    this.connectionManager.broadcast(sessionId, JSON.stringify({
      type: 'error',
      message: error.message
    }))

    // sessionErrorイベントを発火
    this.emit('sessionError', sessionId, error)
  }

  /**
   * ClaudeセッションIDハンドラー
   */
  private handleClaudeSessionId(sessionId: string, claudeSessionId: string): void {
    logger.info(`Claude session ID detected for ${sessionId}: ${claudeSessionId}`)

    // データベースにClaude session IDを保存
    db.session.update({
      where: { id: sessionId },
      data: { resume_session_id: claudeSessionId }
    }).catch(error => {
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
      await db.session.update({
        where: { id: sessionId },
        data: { status: 'error' }
      })
    } catch (error) {
      logger.error(`Error during failed session cleanup:`, error)
    }
  }

  /**
   * データベースの接続数を更新
   */
  private async updateConnectionCount(sessionId: string): Promise<void> {
    const count = this.connectionManager.getConnectionCount(sessionId)
    await db.session.update({
      where: { id: sessionId },
      data: { active_connections: count }
    })
  }

  /**
   * データベースの最終アクティブ時刻を更新
   */
  private async updateLastActiveTime(sessionId: string): Promise<void> {
    await db.session.update({
      where: { id: sessionId },
      data: { last_active_at: new Date() }
    })
  }
}

/**
 * グローバルPTYSessionManagerインスタンス
 */
export const ptySessionManager = PTYSessionManager.getInstance()
