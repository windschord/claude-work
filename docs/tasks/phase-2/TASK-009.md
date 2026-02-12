# TASK-009: ClaudePTYManagerのリファクタリング

## 基本情報

- **タスクID**: TASK-009
- **フェーズ**: Phase 2 - PTYSessionManagerの導入
- **優先度**: 高
- **推定工数**: 50分
- **ステータス**: IN_PROGRESS
- **担当者**: Claude

## 概要

既存のClaudePTYManagerをPTYSessionManagerを使用するようにリファクタリングします。直接PTYを管理する代わりに、PTYSessionManager経由でアクセスするように変更し、コードの重複を削減します。後方互換性を維持しつつ、段階的に移行します。

## 要件マッピング

| 要件ID | 内容 |
|-------|------|
| REQ-002-007 | WebSocketハンドラーの簡素化 |
| NFR-002-001 | 拡張性 |

## 技術的文脈

- **ファイルパス**: `src/services/claude-pty-manager.ts`
- **フレームワーク**: Node.js, TypeScript
- **ライブラリ**: node-pty, EventEmitter
- **参照すべき既存コード**:
  - `src/services/pty-session-manager.ts` (新しく作成したマネージャー)
  - `src/services/claude-pty-manager.ts` (リファクタリング対象)
- **設計書**: [docs/design/components/pty-session-manager.md](../../design/components/pty-session-manager.md)

## 情報の明確性

| 分類 | 内容 |
|------|------|
| **明示された情報** | - ClaudePTYManagerの既存インターフェースを維持<br>- 内部実装をPTYSessionManager経由に変更<br>- createSession(), write(), resize(), destroySession()を委譲<br>- イベント中継を継続<br>- scrollbackBufferの管理はPTYSessionManagerに移譲<br>- Docker関連の処理は既存のまま維持（Phase 3で統合） |
| **不明/要確認の情報** | - なし（設計書で詳細に定義済み） |

## 実装手順（TDD）

### ステップ1: テスト作成

既存のテストファイル`src/services/__tests__/claude-pty-manager.test.ts`を確認し、以下を追加：

1. **PTYSessionManager統合のテスト**
   - createSession()がPTYSessionManagerを呼び出す（非Dockerモード）
   - write()がPTYSessionManagerを呼び出す
   - resize()がPTYSessionManagerを呼び出す
   - destroySession()がPTYSessionManagerを呼び出す

2. **イベント中継のテスト**
   - PTYSessionManagerのdataイベントがClaudePTYManagerで再発火される
   - PTYSessionManagerのexitイベントがClaudePTYManagerで再発火される
   - PTYSessionManagerのerrorイベントがClaudePTYManagerで再発火される

3. **後方互換性のテスト**
   - 既存のhasSession()が正しく動作する
   - 既存のgetWorkingDir()が正しく動作する
   - Dockerモードでは既存の処理が継続される

### ステップ2: テスト実行（失敗確認）

```bash
npm test -- src/services/__tests__/claude-pty-manager.test.ts
```

新しいテストが失敗することを確認します。

### ステップ3: テストコミット

```bash
git add src/services/__tests__/claude-pty-manager.test.ts
git commit -m "test(TASK-009): add ClaudePTYManager refactoring tests

- Add PTYSessionManager integration tests
- Add event relay tests (data, exit, error)
- Add backward compatibility tests"
```

### ステップ4: 実装

`src/services/claude-pty-manager.ts`をリファクタリング：

1. **PTYSessionManagerのインポートと初期化**
   ```typescript
   import { PTYSessionManager, ptySessionManager } from './pty-session-manager'

   class ClaudePTYManager extends EventEmitter {
     private sessions: Map<string, ClaudePTYSession> = new Map()
     private creating: Set<string> = new Set()
     private claudePath: string
     private dockerAdapter: DockerPTYAdapter
     private ptySessionManager: PTYSessionManager // 追加

     constructor() {
       super()
       this.claudePath = process.env.CLAUDE_CODE_PATH || 'claude'
       this.dockerAdapter = new DockerPTYAdapter()
       this.ptySessionManager = ptySessionManager // 追加

       // PTYSessionManagerのイベントを中継
       this.setupPTYSessionManagerEvents()

       // DockerPTYAdapterからのイベントを中継（既存のまま）
       this.dockerAdapter.on('data', (sessionId: string, data: string) => {
         scrollbackBuffer.append(sessionId, data)
         this.emit('data', sessionId, data)
       })
       // ... 既存のDockerイベント中継
     }

     private setupPTYSessionManagerEvents(): void {
       this.ptySessionManager.on('data', (sessionId: string, data: string) => {
         this.emit('data', sessionId, data)
       })
       this.ptySessionManager.on('exit', (sessionId: string, exitCode: number) => {
         this.emit('exit', sessionId, { exitCode })
       })
       this.ptySessionManager.on('error', (sessionId: string, error: Error) => {
         this.emit('error', sessionId, error)
       })
     }
   }
   ```

2. **createSession()のリファクタリング**
   ```typescript
   createSession(
     sessionId: string,
     workingDir: string,
     initialPrompt?: string,
     options?: CreateClaudePTYSessionOptions
   ): void {
     // Dockerモードの場合は既存の処理を継続
     if (options?.dockerMode) {
       // ... 既存のDocker処理
       return
     }

     // 作成中のセッションがある場合はエラー
     if (this.creating.has(sessionId)) {
       throw new Error(`Claude PTY creation already in progress for session ${sessionId}`)
     }

     // 既存のセッションがあれば再利用
     if (this.ptySessionManager.hasSession(sessionId)) {
       logger.info('Reusing existing PTY session', { sessionId })
       this.creating.delete(sessionId)
       return
     }

     // 作成中フラグを立てる
     this.creating.add(sessionId)

     // PTYSessionManagerに委譲
     const resolvedCwd = path.resolve(workingDir)

     // セッションオプションを構築（environmentIdはデータベースから取得、またはデフォルトHOSTを使用）
     // Note: この実装では簡略化のため、常にHOST環境を使用
     // 完全な実装では、セッション作成時にenvironmentIdを渡す必要がある
     this.ptySessionManager.createSession({
       sessionId,
       projectId: 'default', // TODO: プロジェクトIDを引数から取得
       branchName: 'main', // TODO: ブランチ名を引数から取得
       worktreePath: resolvedCwd,
       environmentId: 'default-host', // TODO: 環境IDを引数から取得
       cols: 80,
       rows: 24
     })
       .then(() => {
         logger.info('Claude PTY session created via PTYSessionManager', { sessionId })
         this.creating.delete(sessionId)

         // 初期プロンプトがあれば送信
         if (initialPrompt) {
           setTimeout(() => {
             if (this.ptySessionManager.hasSession(sessionId)) {
               this.ptySessionManager.sendInput(sessionId, initialPrompt + '\n')
             }
           }, 3000)
         }
       })
       .catch(error => {
         this.creating.delete(sessionId)
         logger.error('Failed to create Claude PTY session', { sessionId, error })
         this.emit('error', sessionId, error)
         throw error
       })
   }
   ```

3. **write(), resize(), destroySession()のリファクタリング**
   ```typescript
   write(sessionId: string, data: string): void {
     // Dockerセッションの場合は既存の処理
     if (this.dockerAdapter.hasSession(sessionId)) {
       this.dockerAdapter.write(sessionId, data)
       return
     }

     // PTYSessionManagerに委譲
     try {
       this.ptySessionManager.sendInput(sessionId, data)
     } catch (error) {
       logger.warn(`Failed to write to session ${sessionId}:`, error)
     }
   }

   resize(sessionId: string, cols: number, rows: number): void {
     // Dockerセッションの場合は既存の処理
     if (this.dockerAdapter.hasSession(sessionId)) {
       this.dockerAdapter.resize(sessionId, cols, rows)
       return
     }

     // PTYSessionManagerに委譲
     try {
       this.ptySessionManager.resize(sessionId, cols, rows)
     } catch (error) {
       logger.warn(`Failed to resize session ${sessionId}:`, error)
     }
   }

   destroySession(sessionId: string): void {
     // Dockerセッションの場合は既存の処理
     if (this.dockerAdapter.hasSession(sessionId)) {
       scrollbackBuffer.clear(sessionId)
       this.dockerAdapter.destroySession(sessionId)
       return
     }

     // PTYSessionManagerに委譲
     logger.info('Destroying Claude PTY session via PTYSessionManager', { sessionId })
     this.ptySessionManager.destroySession(sessionId)
       .catch(error => {
         logger.error(`Failed to destroy session ${sessionId}:`, error)
       })
   }
   ```

4. **hasSession()とgetWorkingDir()の更新**
   ```typescript
   hasSession(sessionId: string): boolean {
     return this.ptySessionManager.hasSession(sessionId) || this.dockerAdapter.hasSession(sessionId)
   }

   getWorkingDir(sessionId: string): string | undefined {
     // Dockerセッションの場合は既存の処理
     const dockerWorkingDir = this.dockerAdapter.getWorkingDir(sessionId)
     if (dockerWorkingDir) {
       return dockerWorkingDir
     }

     // PTYSessionManagerから取得
     const session = this.ptySessionManager.getSession(sessionId)
     return session?.metadata.worktreePath
   }
   ```

### ステップ5: テスト実行（通過確認）

```bash
npm test -- src/services/__tests__/claude-pty-manager.test.ts
```

すべてのテストが通過することを確認します。

### ステップ6: 実装コミット

```bash
git add src/services/claude-pty-manager.ts
git commit -m "feat(TASK-009): refactor ClaudePTYManager to use PTYSessionManager

- Integrate PTYSessionManager for non-Docker sessions
- Delegate createSession, write, resize, destroySession to PTYSessionManager
- Setup event relay from PTYSessionManager to ClaudePTYManager
- Update hasSession and getWorkingDir to use PTYSessionManager
- Maintain backward compatibility for Docker sessions
- Keep existing interfaces unchanged

Implements: REQ-002-007, NFR-002-001

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

## 受入基準

- [ ] PTYSessionManagerがClaudePTYManagerに統合されている
- [ ] createSession()がPTYSessionManagerに委譲される（非Dockerモード）
- [ ] write()がPTYSessionManagerに委譲される
- [ ] resize()がPTYSessionManagerに委譲される
- [ ] destroySession()がPTYSessionManagerに委譲される
- [ ] hasSession()がPTYSessionManagerを使用する
- [ ] getWorkingDir()がPTYSessionManagerを使用する
- [ ] PTYSessionManagerのイベントが中継される
- [ ] 既存のDocker処理が破壊されていない
- [ ] 既存のインターフェースが維持されている
- [ ] テストがすべて通過する
- [ ] ESLintエラーがゼロ

## 検証方法

### 単体テスト実行

```bash
npm test -- src/services/__tests__/claude-pty-manager.test.ts --coverage
```

カバレッジが85%以上であることを確認。

### Lint実行

```bash
npm run lint -- src/services/claude-pty-manager.ts
```

エラーがゼロであることを確認。

### 既存機能のリグレッションテスト

```bash
npm test
```

既存のすべてのテストが通過することを確認。

## 依存関係

### 前提条件
- TASK-008: PTYイベントハンドラー登録の実装

### 後続タスク
- TASK-010: WebSocketハンドラーのPTYSessionManager統合

## トラブルシューティング

### よくある問題

1. **セッション作成時のenvironmentID**
   - 問題: environmentIdが不明
   - 解決: 一時的にデフォルトHOST環境を使用、完全な実装では引数から取得

2. **イベント中継の二重発火**
   - 問題: dataイベントが2回発火される
   - 解決: PTYSessionManagerのイベントのみを中継し、scrollbackBufferの処理を削除

3. **Dockerモードとの競合**
   - 問題: DockerとPTYSessionManagerの両方が呼ばれる
   - 解決: options?.dockerModeで早期リターン

4. **初期プロンプトの送信タイミング**
   - 問題: PTYSessionManagerのcreateSession()は非同期
   - 解決: Promiseのthen()内でsetTimeoutを設定

## パフォーマンス最適化

### イベント中継の最適化

```typescript
// イベントリスナーを一度だけ登録
private setupPTYSessionManagerEvents(): void {
  // 既に登録されている場合はスキップ
  if (this.ptySessionManager.listenerCount('data') > 0) {
    return
  }
  // ... イベントリスナー登録
}
```

## 参照

- [要件定義: US-002](../../requirements/stories/US-002.md)
- [設計: PTYSessionManager](../../design/components/pty-session-manager.md)
- [ClaudePTYManager](../../design/components/claude-pty-manager.md)
