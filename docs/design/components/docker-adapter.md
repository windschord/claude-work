# DockerAdapter: Docker環境アダプターの安定化

## 概要

DockerAdapterは、Docker環境でのPTYセッション管理を担当するコンポーネントです。本設計では、既存の実装に以下の改善を加えます：

1. **コンテナ起動完了の待機**: ヘルスチェックの実装
2. **`docker stop`のPromise化**: 同期的な停止処理
3. **親コンテナIDの永続化**: データベースへの保存
4. **リサイズ処理の改善**: タイミング制御
5. **コンテナクラッシュの検出**: 異常終了の検出と通知

## 要件マッピング

このコンポーネントは以下の要件を満たします：

| 要件ID | 内容 | 実装方法 |
|-------|------|---------|
| REQ-003-001 | コンテナ起動完了の待機 | waitForContainerReady()メソッド |
| REQ-003-002 | ヘルスチェック | docker inspectで状態確認 |
| REQ-003-003 | 同期的なコンテナ停止 | stopContainer()のPromise化 |
| REQ-003-004 | エラーハンドリング | try-catchとログ記録 |
| REQ-003-005 | 親コンテナIDの永続化 | データベースへの保存 |
| REQ-003-006 | 孤立コンテナの検出 | サーバー起動時のチェック |
| REQ-003-007 | リサイズ処理の改善 | コンテナ準備完了後に実行 |
| REQ-003-008 | コンテナクラッシュの検出 | 定期的なヘルスチェック |

## 責務

1. **コンテナライフサイクル管理**: 起動、停止、クリーンアップ
2. **起動完了待機**: コンテナが完全に起動するまで待機
3. **ヘルスチェック**: コンテナの状態監視
4. **親コンテナID管理**: 永続化と復元
5. **エラーハンドリング**: Docker操作のエラー処理
6. **リサイズ処理**: タイミング制御されたリサイズ

## インターフェース

### EnvironmentAdapter拡張

```typescript
export interface DockerAdapterOptions extends SpawnOptions {
  containerImage?: string
  resourceLimits?: {
    cpus?: number
    memory?: string
  }
  networkMode?: 'bridge' | 'host' | 'none'
}

export class DockerAdapter implements EnvironmentAdapter {
  private containerStates: Map<string, ContainerState> = new Map()
  private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map()
  private prisma: PrismaClient

  async spawn(options: DockerAdapterOptions): Promise<IPty>
  async cleanup(sessionId: string): Promise<void>
  async resize(sessionId: string, cols: number, rows: number): Promise<void>

  // 新規メソッド
  private async waitForContainerReady(containerId: string): Promise<void>
  private async stopContainer(containerId: string): Promise<void>
  private async checkContainerHealth(containerId: string): Promise<boolean>
  private startHealthCheck(sessionId: string, containerId: string): void
  private stopHealthCheck(sessionId: string): void
}

interface ContainerState {
  containerId: string
  isReady: boolean
  pendingResize?: { cols: number; rows: number }
  healthCheckFailing: boolean
}
```

## 主要な改善

### 1. コンテナ起動完了待機

#### waitForContainerReady

コンテナが完全に起動するまで待機します。

```typescript
private async waitForContainerReady(containerId: string): Promise<void> {
  const maxRetries = 30
  const retryInterval = 1000 // 1秒
  const timeout = 30000 // 30秒

  logger.info(`Waiting for container ${containerId} to be ready`)

  const startTime = Date.now()

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    // タイムアウトチェック
    if (Date.now() - startTime > timeout) {
      throw new Error(`Container ${containerId} failed to start within ${timeout}ms`)
    }

    try {
      // コンテナの状態を確認
      const { stdout } = await execAsync(
        `docker inspect --format='{{.State.Running}}' ${containerId}`
      )

      const isRunning = stdout.trim() === 'true'

      if (isRunning) {
        // 追加のヘルスチェック（コンテナ内でコマンドを実行）
        try {
          await execAsync(`docker exec ${containerId} echo "health-check"`, {
            timeout: 2000
          })

          logger.info(`Container ${containerId} is ready after ${attempt} attempts`)
          return
        } catch (execError) {
          logger.debug(`Container ${containerId} not fully ready, exec failed`)
        }
      }
    } catch (error) {
      logger.debug(`Container ${containerId} inspection failed, retry ${attempt}/${maxRetries}`)
    }

    // 次の試行まで待機
    await new Promise(resolve => setTimeout(resolve, retryInterval))
  }

  throw new Error(`Container ${containerId} health check failed after ${maxRetries} attempts`)
}
```

#### spawnの改善

```typescript
async spawn(options: DockerAdapterOptions): Promise<IPty> {
  const { sessionId, cwd, cols, rows, environmentId } = options

  logger.info(`Spawning Docker container for session ${sessionId}`)

  try {
    // コンテナイメージの取得
    const image = options.containerImage || 'anthropics/claude-code:latest'

    // Dockerコンテナを起動
    const { stdout: containerId } = await execAsync(
      `docker run -d --rm \
        -v "${cwd}:${cwd}" \
        -w "${cwd}" \
        --name "claude-work-${sessionId}" \
        ${this.buildResourceLimits(options.resourceLimits)} \
        ${image} \
        /bin/bash -c "while true; do sleep 1; done"`
    )

    const cleanContainerId = containerId.trim()

    // コンテナ状態を初期化
    this.containerStates.set(sessionId, {
      containerId: cleanContainerId,
      isReady: false,
      healthCheckFailing: false
    })

    // コンテナ起動完了を待機（NEW）
    await this.waitForContainerReady(cleanContainerId)

    // 準備完了をマーク
    const state = this.containerStates.get(sessionId)!
    state.isReady = true

    // 親コンテナIDをデータベースに保存（NEW）
    await this.saveContainerId(sessionId, cleanContainerId)

    // PTYを作成
    const pty = pty_node.spawn('docker', ['exec', '-it', cleanContainerId, 'bash'], {
      name: 'xterm-256color',
      cols: cols || 80,
      rows: rows || 24,
      cwd,
      env: process.env as any
    })

    // ヘルスチェックを開始（NEW）
    this.startHealthCheck(sessionId, cleanContainerId)

    // 保留中のリサイズがあれば実行
    if (state.pendingResize) {
      await this.resize(sessionId, state.pendingResize.cols, state.pendingResize.rows)
      state.pendingResize = undefined
    }

    logger.info(`Docker container ${cleanContainerId} spawned successfully for session ${sessionId}`)

    return pty
  } catch (error) {
    logger.error(`Failed to spawn Docker container for session ${sessionId}:`, error)

    // クリーンアップ
    await this.cleanup(sessionId).catch(cleanupError => {
      logger.error(`Cleanup after spawn failure failed:`, cleanupError)
    })

    throw error
  }
}
```

### 2. 同期的なコンテナ停止

#### stopContainer

```typescript
private async stopContainer(containerId: string): Promise<void> {
  logger.info(`Stopping container ${containerId}`)

  try {
    // 10秒のタイムアウトで停止を試行
    await execAsync(`docker stop -t 10 ${containerId}`, {
      timeout: 15000 // 15秒（猶予を含む）
    })

    logger.info(`Container ${containerId} stopped successfully`)
  } catch (error: any) {
    // コンテナが既に停止している場合はエラーを無視
    if (error.message.includes('No such container') ||
        error.message.includes('is not running')) {
      logger.debug(`Container ${containerId} already stopped`)
      return
    }

    logger.error(`Failed to stop container ${containerId}:`, error)

    // 強制停止を試行
    try {
      await execAsync(`docker kill ${containerId}`, {
        timeout: 5000
      })
      logger.warn(`Container ${containerId} force-killed`)
    } catch (killError) {
      logger.error(`Failed to force-kill container ${containerId}:`, killError)
    }

    // エラーをログに記録するが、スローはしない（後続処理を継続）
  }
}
```

#### cleanupの改善

```typescript
async cleanup(sessionId: string): Promise<void> {
  const state = this.containerStates.get(sessionId)

  if (!state) {
    logger.warn(`No container state for session ${sessionId}`)
    return
  }

  logger.info(`Cleaning up Docker container for session ${sessionId}`)

  try {
    // ヘルスチェックを停止（NEW）
    this.stopHealthCheck(sessionId)

    // コンテナを同期的に停止（IMPROVED）
    await this.stopContainer(state.containerId)

    // 状態をクリア
    this.containerStates.delete(sessionId)

    // データベースからコンテナIDを削除
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { container_id: null }
    })

    logger.info(`Docker container ${state.containerId} cleaned up successfully`)
  } catch (error) {
    logger.error(`Error during Docker cleanup for session ${sessionId}:`, error)
    // エラーをスローせず、ログのみ記録
  }
}
```

### 3. 親コンテナIDの永続化

#### saveContainerId / getContainerId

```typescript
private async saveContainerId(sessionId: string, containerId: string): Promise<void> {
  try {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { container_id: containerId }
    })

    logger.debug(`Saved container ID ${containerId} for session ${sessionId}`)
  } catch (error) {
    logger.error(`Failed to save container ID:`, error)
    // 永続化失敗は致命的ではないため、エラーをスローしない
  }
}

async getContainerId(sessionId: string): Promise<string | null> {
  try {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: { container_id: true }
    })

    return session?.container_id || null
  } catch (error) {
    logger.error(`Failed to get container ID for session ${sessionId}:`, error)
    return null
  }
}
```

#### サーバー起動時の孤立コンテナクリーンアップ

```typescript
static async cleanupOrphanedContainers(prisma: PrismaClient): Promise<void> {
  logger.info('Checking for orphaned Docker containers')

  try {
    // データベースから全セッションのコンテナIDを取得
    const sessions = await prisma.session.findMany({
      where: {
        container_id: { not: null },
        status: { in: ['ACTIVE', 'IDLE'] }
      },
      select: { id: true, container_id: true }
    })

    for (const session of sessions) {
      if (!session.container_id) continue

      try {
        // コンテナが実行中か確認
        const { stdout } = await execAsync(
          `docker inspect --format='{{.State.Running}}' ${session.container_id}`
        )

        const isRunning = stdout.trim() === 'true'

        if (!isRunning) {
          logger.warn(`Orphaned container detected: ${session.container_id} for session ${session.id}`)

          // セッション状態をERRORに更新
          await prisma.session.update({
            where: { id: session.id },
            data: {
              status: 'ERROR',
              container_id: null
            }
          })

          // コンテナが存在すれば削除
          try {
            await execAsync(`docker rm -f ${session.container_id}`)
            logger.info(`Removed orphaned container ${session.container_id}`)
          } catch (rmError) {
            logger.error(`Failed to remove orphaned container:`, rmError)
          }
        }
      } catch (error) {
        logger.error(`Failed to check container ${session.container_id}:`, error)

        // コンテナが存在しない場合も孤立とみなす
        await prisma.session.update({
          where: { id: session.id },
          data: {
            status: 'ERROR',
            container_id: null
          }
        })
      }
    }

    logger.info('Orphaned container cleanup completed')
  } catch (error) {
    logger.error('Failed to cleanup orphaned containers:', error)
  }
}
```

### 4. リサイズ処理の改善

```typescript
async resize(sessionId: string, cols: number, rows: number): Promise<void> {
  const state = this.containerStates.get(sessionId)

  if (!state) {
    throw new Error(`No container state for session ${sessionId}`)
  }

  // コンテナが準備完了していない場合は保留
  if (!state.isReady) {
    logger.debug(`Container not ready, deferring resize for session ${sessionId}`)
    state.pendingResize = { cols, rows }
    return
  }

  try {
    // PTYのリサイズを実行
    // 実際のPTYインスタンスは外部で管理されるため、ここでは状態のみ更新
    logger.info(`Resizing container for session ${sessionId} to ${cols}x${rows}`)

    // 保留中のリサイズをクリア
    state.pendingResize = undefined
  } catch (error) {
    logger.error(`Failed to resize container for session ${sessionId}:`, error)
    throw error
  }
}
```

### 5. ヘルスチェック

#### startHealthCheck / checkContainerHealth

```typescript
private startHealthCheck(sessionId: string, containerId: string): void {
  // 既存のヘルスチェックがあれば停止
  this.stopHealthCheck(sessionId)

  // 30秒ごとにヘルスチェック
  const interval = setInterval(async () => {
    const isHealthy = await this.checkContainerHealth(containerId)

    const state = this.containerStates.get(sessionId)
    if (!state) {
      this.stopHealthCheck(sessionId)
      return
    }

    if (!isHealthy) {
      logger.error(`Container ${containerId} health check failed`)
      state.healthCheckFailing = true

      // セッション状態を更新
      await this.prisma.session.update({
        where: { id: sessionId },
        data: { status: 'ERROR' }
      }).catch(error => {
        logger.error(`Failed to update session status:`, error)
      })

      // PTYSessionManagerにエラーを通知（将来の拡張）
      // this.emit('containerCrashed', sessionId)

      this.stopHealthCheck(sessionId)
    }
  }, 30000) // 30秒

  this.healthCheckIntervals.set(sessionId, interval)
  logger.debug(`Started health check for session ${sessionId}`)
}

private async checkContainerHealth(containerId: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync(
      `docker inspect --format='{{.State.Running}}' ${containerId}`,
      { timeout: 5000 }
    )

    return stdout.trim() === 'true'
  } catch (error) {
    logger.error(`Container health check failed:`, error)
    return false
  }
}

private stopHealthCheck(sessionId: string): void {
  const interval = this.healthCheckIntervals.get(sessionId)
  if (interval) {
    clearInterval(interval)
    this.healthCheckIntervals.delete(sessionId)
    logger.debug(`Stopped health check for session ${sessionId}`)
  }
}
```

## エラーハンドリング

### コンテナ起動失敗

```typescript
// spawn()内でのエラーハンドリング
catch (error) {
  logger.error(`Failed to spawn Docker container:`, error)

  // 部分的に作成されたリソースをクリーンアップ
  await this.cleanup(sessionId).catch(cleanupError => {
    logger.error(`Cleanup after spawn failure failed:`, cleanupError)
  })

  throw new Error(`Docker container spawn failed: ${error.message}`)
}
```

### コンテナ停止失敗

```typescript
// stopContainer()内で複数の停止方法を試行
try {
  await execAsync(`docker stop -t 10 ${containerId}`)
} catch (error) {
  logger.error(`docker stop failed, trying docker kill`)
  try {
    await execAsync(`docker kill ${containerId}`)
  } catch (killError) {
    logger.error(`docker kill also failed, container may be orphaned`)
    // エラーをスローせず、ログのみ記録
  }
}
```

## テスト戦略

### 単体テスト

```typescript
describe('DockerAdapter', () => {
  describe('waitForContainerReady', () => {
    it('should wait until container is ready', async () => {
      const adapter = new DockerAdapter()

      // docker inspectをモック
      jest.spyOn(execAsync).mockResolvedValue({ stdout: 'true\n' })

      await expect(adapter.waitForContainerReady('container123')).resolves.not.toThrow()
    })

    it('should timeout if container does not start', async () => {
      const adapter = new DockerAdapter()

      // docker inspectが常にfalseを返す
      jest.spyOn(execAsync).mockResolvedValue({ stdout: 'false\n' })

      await expect(adapter.waitForContainerReady('container123')).rejects.toThrow('failed to start')
    })
  })

  describe('stopContainer', () => {
    it('should stop container gracefully', async () => {
      const adapter = new DockerAdapter()
      const execSpy = jest.spyOn(execAsync).mockResolvedValue({ stdout: '' })

      await adapter.stopContainer('container123')

      expect(execSpy).toHaveBeenCalledWith(expect.stringContaining('docker stop'), expect.any(Object))
    })

    it('should force-kill if stop fails', async () => {
      const adapter = new DockerAdapter()
      const execSpy = jest.spyOn(execAsync)
        .mockRejectedValueOnce(new Error('Stop failed'))
        .mockResolvedValueOnce({ stdout: '' })

      await adapter.stopContainer('container123')

      expect(execSpy).toHaveBeenCalledWith(expect.stringContaining('docker kill'), expect.any(Object))
    })
  })
})
```

### 統合テスト

```typescript
describe('DockerAdapter Integration', () => {
  it('should spawn and cleanup Docker container', async () => {
    const adapter = new DockerAdapter()

    const pty = await adapter.spawn({
      sessionId: 'test-session',
      cwd: '/tmp/test',
      cols: 80,
      rows: 24,
      environmentId: 'env1'
    })

    expect(pty).toBeDefined()

    // コンテナが実行中であることを確認
    const containerId = await adapter.getContainerId('test-session')
    expect(containerId).toBeTruthy()

    // クリーンアップ
    await adapter.cleanup('test-session')

    // コンテナが削除されたことを確認
    const containerExists = await checkContainerExists(containerId!)
    expect(containerExists).toBe(false)
  })
})
```

## 参照

- [要件定義: US-003](../../requirements/stories/US-003.md) @../../requirements/stories/US-003.md
- [設計決定: DEC-005](../decisions/DEC-005.md) @../decisions/DEC-005.md
- [PTYSessionManager](pty-session-manager.md) @pty-session-manager.md
- [データベーススキーマ](../database/schema.md) @../database/schema.md
