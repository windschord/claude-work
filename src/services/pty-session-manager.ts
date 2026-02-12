import { EventEmitter } from 'events'
import { IPty } from 'node-pty'
import { ConnectionManager } from '@/lib/websocket/connection-manager'
import { AdapterFactory } from './adapter-factory'
import { EnvironmentAdapter } from './environment-adapter'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import type { PrismaClient } from '@prisma/client'
import type WebSocket from 'ws'

/**
 * PTYセッション情報
 */
export interface PTYSession {
  id: string
  pty: IPty
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
  containerID?: string
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
}

/**
 * PTYSessionManager
 *
 * PTYセッションのライフサイクル全体を統合管理するコンポーネント。
 * セッション作成、破棄、接続管理、イベント処理を一元化する。
 */
export class PTYSessionManager extends EventEmitter implements IPTYSessionManager {
  private static instance: PTYSessionManager

  private sessions: Map<string, PTYSession> = new Map()
  private connectionManager: ConnectionManager
  private adapterFactory: AdapterFactory
  private prisma: PrismaClient

  private constructor() {
    super()
    this.connectionManager = ConnectionManager.getInstance()
    this.adapterFactory = AdapterFactory.getInstance()
    this.prisma = db
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
    const { sessionId, projectId, environmentId, worktreePath, branchName, cols, rows } = options

    // 既存セッションのチェック
    if (this.sessions.has(sessionId)) {
      throw new Error(`Session ${sessionId} already exists`)
    }

    logger.info(`Creating session ${sessionId} for environment ${environmentId}`)

    try {
      // 環境情報を取得
      const environment = await this.prisma.executionEnvironment.findUnique({
        where: { id: environmentId }
      })

      if (!environment) {
        throw new Error(`Environment ${environmentId} not found`)
      }

      // アダプターを取得
      const adapter = await this.adapterFactory.getAdapter(environment.type)

      // PTYを作成
      const pty = await adapter.spawn({
        sessionId,
        cwd: worktreePath,
        cols: cols || 80,
        rows: rows || 24,
        environmentId
      })

      // セッション情報を作成
      const session: PTYSession = {
        id: sessionId,
        pty,
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
      const ScrollbackBuffer = (await import('./scrollback-buffer')).ScrollbackBuffer
      const buffer = new ScrollbackBuffer()
      this.connectionManager.setScrollbackBuffer(sessionId, buffer)

      // データベースに記録
      await this.prisma.session.update({
        where: { id: sessionId },
        data: {
          status: 'ACTIVE',
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

      // PTYを終了
      try {
        session.pty.kill()
      } catch (error) {
        logger.error(`Failed to kill PTY for ${sessionId}:`, error)
      }

      // アダプターのクリーンアップ
      try {
        await session.adapter.cleanup(sessionId)
      } catch (error) {
        logger.error(`Failed to cleanup adapter for ${sessionId}:`, error)
      }

      // セッションをマップから削除
      this.sessions.delete(sessionId)

      // データベースを更新
      await this.prisma.session.update({
        where: { id: sessionId },
        data: {
          status: 'TERMINATED',
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
    this.updateConnectionCount(sessionId).catch(error => {
      logger.error(`Failed to update connection count:`, error)
    })
  }

  /**
   * 失敗したセッションのクリーンアップ
   */
  private async cleanupFailedSession(sessionId: string): Promise<void> {
    try {
      const session = this.sessions.get(sessionId)
      if (session) {
        // PTYが存在すれば終了
        if (session.pty) {
          try {
            session.pty.kill()
          } catch (error) {
            logger.error(`Failed to kill PTY during cleanup:`, error)
          }
        }

        // アダプターのクリーンアップ
        if (session.adapter) {
          try {
            await session.adapter.cleanup(sessionId)
          } catch (error) {
            logger.error(`Failed to cleanup adapter during cleanup:`, error)
          }
        }

        this.sessions.delete(sessionId)
      }

      // ConnectionManagerのクリーンアップ
      this.connectionManager.cleanup(sessionId)

      // データベースの状態を更新
      await this.prisma.session.update({
        where: { id: sessionId },
        data: { status: 'ERROR' }
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
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { active_connections: count }
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
  sendInput(_sessionId: string, _data: string): void {
    // TASK-008で実装予定
    throw new Error('Not implemented yet')
  }

  /**
   * PTYのサイズを変更
   */
  resize(_sessionId: string, _cols: number, _rows: number): void {
    // TASK-008で実装予定
    throw new Error('Not implemented yet')
  }
}

/**
 * グローバルPTYSessionManagerインスタンス
 */
export const ptySessionManager = PTYSessionManager.getInstance()
