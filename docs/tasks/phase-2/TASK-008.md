# TASK-008: PTYイベントハンドラー登録の実装

## 基本情報

- **タスクID**: TASK-008
- **フェーズ**: Phase 2 - PTYSessionManagerの導入
- **優先度**: 高
- **推定工数**: 50分
- **ステータス**: TODO
- **担当者**: 未割り当て

## 概要

PTYセッションのイベントハンドラー（data, exit）を登録し、スクロールバックバッファへの追加とブロードキャスト配信を実装します。US-001の問題（重複ハンドラー）を解決するため、セッション単位で1つのハンドラーのみを登録します。

## 要件マッピング

| 要件ID | 内容 |
|-------|------|
| REQ-001-003 | ブロードキャスト配信 |
| REQ-002-005 | ライフサイクルイベント |
| NFR-001-001 | イベントハンドラーの重複排除 |

## 技術的文脈

- **ファイルパス**: `src/services/pty-session-manager.ts`
- **フレームワーク**: Node.js, TypeScript
- **ライブラリ**: node-pty, EventEmitter
- **参照すべき既存コード**:
  - `src/services/claude-pty-manager.ts` (onData, onExit)
  - `src/lib/websocket/connection-manager.ts` (broadcast, registerHandler)
  - `src/services/scrollback-buffer.ts` (append)
- **設計書**: [docs/design/components/pty-session-manager.md](../../design/components/pty-session-manager.md)

## 情報の明確性

| 分類 | 内容 |
|------|------|
| **明示された情報** | - createSession()内でregisterPTYHandlers()を呼び出す<br>- PTYのonData()とonExit()にハンドラーを登録<br>- dataハンドラーはhandlePTYData()を呼び出す<br>- exitハンドラーはhandlePTYExit()を呼び出す<br>- ConnectionManagerにハンドラー情報を記録<br>- スクロールバックバッファに出力を追加<br>- 全接続にブロードキャスト |
| **不明/要確認の情報** | - なし（設計書で詳細に定義済み） |

## 実装手順（TDD）

### ステップ1: テスト作成

既存のテストファイル`src/services/__tests__/pty-session-manager.test.ts`に以下を追加：

1. **registerPTYHandlersのテスト**
   - PTYのonData()が呼び出される
   - PTYのonExit()が呼び出される
   - ConnectionManagerにdataハンドラーが登録される
   - ConnectionManagerにexitハンドラーが登録される
   - セッション単位で1つのハンドラーのみ登録される

2. **handlePTYDataのテスト**
   - スクロールバックバッファにデータが追加される
   - ConnectionManagerのbroadcast()が呼び出される
   - lastActiveAtが更新される
   - データベースのlast_active_atが更新される（非同期）

3. **handlePTYExitのテスト**
   - exitメッセージが全接続にブロードキャストされる
   - destroySession()が非同期で呼び出される
   - セッションが存在しない場合は警告ログのみ

4. **sendInputとresizeのテスト**
   - sendInput()がPTYのwrite()を呼び出す
   - resize()がPTYのresize()を呼び出す
   - lastActiveAtが更新される（sendInput）
   - セッションが存在しない場合はエラーをスロー

### ステップ2: テスト実行（失敗確認）

```bash
npm test -- src/services/__tests__/pty-session-manager.test.ts
```

新しいテストが失敗することを確認します。

### ステップ3: テストコミット

```bash
git add src/services/__tests__/pty-session-manager.test.ts
git commit -m "test(TASK-008): add PTY event handler tests

- Add registerPTYHandlers tests (data, exit, single handler)
- Add handlePTYData tests (buffer, broadcast, lastActiveAt)
- Add handlePTYExit tests (broadcast, destroySession)
- Add sendInput and resize tests"
```

### ステップ4: 実装

`src/services/pty-session-manager.ts`に以下のメソッドを追加：

1. **createSession()にregisterPTYHandlers()呼び出しを追加**
   ```typescript
   // createSession()内のセッション登録後に追加
   // PTYイベントハンドラーを登録（セッションごとに1つ）
   this.registerPTYHandlers(sessionId, pty)
   ```

2. **registerPTYHandlers（プライベートメソッド）**
   ```typescript
   private registerPTYHandlers(sessionId: string, pty: IPty): void {
     // データハンドラー（出力）
     const dataHandler = (data: string) => {
       this.handlePTYData(sessionId, data)
     }

     // 終了ハンドラー
     const exitHandler = (exitCode: { exitCode: number; signal?: number }) => {
       this.handlePTYExit(sessionId, exitCode.exitCode)
     }

     // ハンドラーを登録
     pty.onData(dataHandler)
     pty.onExit(exitHandler)

     // ConnectionManagerに登録情報を記録
     this.connectionManager.registerHandler(sessionId, 'data', dataHandler)
     this.connectionManager.registerHandler(sessionId, 'exit', exitHandler)

     logger.debug(`Registered PTY handlers for session ${sessionId}`)
   }
   ```

3. **handlePTYData（プライベートメソッド）**
   ```typescript
   private handlePTYData(sessionId: string, data: string): void {
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

     // データベースの最終アクティブ時刻を更新（非同期、待機しない）
     this.updateLastActiveTime(sessionId).catch(error => {
       logger.error(`Failed to update last_active_at for ${sessionId}:`, error)
     })
   }
   ```

4. **handlePTYExit（プライベートメソッド）**
   ```typescript
   private handlePTYExit(sessionId: string, exitCode: number): void {
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

     // セッションを破棄（非同期）
     this.destroySession(sessionId).catch(error => {
       logger.error(`Failed to destroy session after PTY exit:`, error)
     })
   }
   ```

5. **updateLastActiveTime（プライベートメソッド）**
   ```typescript
   private async updateLastActiveTime(sessionId: string): Promise<void> {
     await this.prisma.session.update({
       where: { id: sessionId },
       data: { last_active_at: new Date() }
     })
   }
   ```

6. **sendInputとresize**
   ```typescript
   sendInput(sessionId: string, data: string): void {
     const session = this.sessions.get(sessionId)
     if (!session) {
       throw new Error(`Session ${sessionId} not found`)
     }

     session.pty.write(data)
     session.lastActiveAt = new Date()
   }

   resize(sessionId: string, cols: number, rows: number): void {
     const session = this.sessions.get(sessionId)
     if (!session) {
       throw new Error(`Session ${sessionId} not found`)
     }

     session.pty.resize(cols, rows)
     logger.debug(`Resized session ${sessionId} to ${cols}x${rows}`)
   }
   ```

### ステップ5: テスト実行（通過確認）

```bash
npm test -- src/services/__tests__/pty-session-manager.test.ts
```

すべてのテストが通過することを確認します。

### ステップ6: 実装コミット

```bash
git add src/services/pty-session-manager.ts
git commit -m "feat(TASK-008): implement PTY event handlers

- Add registerPTYHandlers() for single handler registration
- Implement handlePTYData() with buffer and broadcast
- Implement handlePTYExit() with destroySession
- Add updateLastActiveTime() for DB updates
- Implement sendInput() and resize() for PTY interaction
- Register handlers in ConnectionManager for tracking
- Ensure one handler per session per event type

Implements: REQ-001-003, REQ-002-005, NFR-001-001

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

## 受入基準

- [ ] registerPTYHandlers()が実装されている（プライベート）
- [ ] handlePTYData()が実装されている（プライベート）
- [ ] handlePTYExit()が実装されている（プライベート）
- [ ] updateLastActiveTime()が実装されている（プライベート）
- [ ] sendInput()が実装されている
- [ ] resize()が実装されている
- [ ] createSession()内でregisterPTYHandlers()が呼び出される
- [ ] ConnectionManagerにハンドラーが登録される
- [ ] スクロールバックバッファにデータが追加される
- [ ] 全接続にブロードキャストされる
- [ ] セッション単位で1つのハンドラーのみ登録される
- [ ] テストがすべて通過する
- [ ] ESLintエラーがゼロ

## 検証方法

### 単体テスト実行

```bash
npm test -- src/services/__tests__/pty-session-manager.test.ts --coverage
```

カバレッジが85%以上であることを確認。

### Lint実行

```bash
npm run lint -- src/services/pty-session-manager.ts
```

エラーがゼロであることを確認。

## 依存関係

### 前提条件
- TASK-007: セッション作成・取得・破棄メソッド実装

### 後続タスク
- TASK-009: ClaudePTYManagerのリファクタリング

## トラブルシューティング

### よくある問題

1. **重複ハンドラー登録**
   - 問題: PTYのonData()が複数回呼ばれる
   - 解決: registerPTYHandlers()をcreateSession()内で1回のみ呼び出す

2. **スクロールバックバッファが見つからない**
   - 問題: getScrollbackBuffer()がnullを返す
   - 解決: createSession()でsetScrollbackBuffer()を呼び出す

3. **ブロードキャストの遅延**
   - 問題: データが即座に送信されない
   - 解決: broadcast()は同期的に実行されるため、問題ないはず

4. **PTY exitの無限ループ**
   - 問題: handlePTYExit()内のdestroySession()が再びexitを発火
   - 解決: destroySession()内でPTYを直接kill()するため、exitは発火しない

## パフォーマンス最適化

### データベース更新の非同期化

```typescript
// last_active_atの更新は非同期で行い、待機しない
this.updateLastActiveTime(sessionId).catch(error => {
  logger.error(`Failed to update last_active_at for ${sessionId}:`, error)
})
```

## 参照

- [要件定義: US-002](../../requirements/stories/US-002.md)
- [設計: PTYSessionManager](../../design/components/pty-session-manager.md)
- [設計決定: DEC-003](../../design/decisions/DEC-003.md)
- [ConnectionManager](../../design/components/connection-manager.md)
