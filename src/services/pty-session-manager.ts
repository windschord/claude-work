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
  async createSession(_options: SessionOptions): Promise<PTYSession> {
    // TASK-007で実装予定
    throw new Error('Not implemented yet')
  }

  /**
   * セッションを破棄
   */
  async destroySession(_sessionId: string): Promise<void> {
    // TASK-007で実装予定
    throw new Error('Not implemented yet')
  }

  /**
   * WebSocket接続を追加
   */
  addConnection(_sessionId: string, _ws: WebSocket): void {
    // TASK-007で実装予定
    throw new Error('Not implemented yet')
  }

  /**
   * WebSocket接続を削除
   */
  removeConnection(_sessionId: string, _ws: WebSocket): void {
    // TASK-007で実装予定
    throw new Error('Not implemented yet')
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
