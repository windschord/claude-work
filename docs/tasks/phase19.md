# Phase 19: Critical Issue修正

## 概要

調査レポート（docs/verification-report-nodejs-architecture.md）で発見された3つのCritical Issueを修正します。これらの問題により、アプリケーションの中核機能であるClaude Codeとの対話が完全に動作していません。

## フェーズの目標

- Issue #1: Claude Codeプロセスが起動しない問題を修正
- Issue #2: WebSocket認証エラーを修正
- Issue #3: WebSocket接続失敗を解消（Issue #1と#2の修正により自動的に解決）
- アプリケーションの中核機能が正常に動作することを確認

## タスク一覧

### Phase 19.1: Issue #1修正 - Claude Codeプロセス起動問題

#### タスク19.1.1: Process Manager修正のテスト作成

**説明**:
`src/services/process-manager.ts`の`--cwd`オプション問題を修正するためのテストを作成する。

**現在の問題**:
- `src/services/process-manager.ts:98`で`--cwd`オプションを使用している
- Claude Code CLIが`--cwd`オプションをサポートしていない
- セッション作成時にエラーが発生する

**修正方針**:
- `--cwd`オプションを削除
- `spawn()`の`cwd`オプションを使用してカレントディレクトリを設定

**実装手順（TDD）**:
1. テスト作成: `src/services/__tests__/process-manager.test.ts`を更新
   - `--cwd`オプションが引数に含まれていないことを確認するテスト
   - `spawn()`の`cwd`オプションがworktreePathに設定されることを確認するテスト
   - Claude Codeプロセスが正常に起動することを確認するテスト
2. テスト実行: 現在の実装ではテストが失敗することを確認
3. テストコミット: テストのみをコミット（コミットメッセージ: "test: Process Manager cwd option修正のテスト追加"）

**受入基準**:
- [ ] `src/services/__tests__/process-manager.test.ts`にテストが追加されている
- [ ] テストが以下の3つを検証している:
  - [ ] `--cwd`オプションが`spawn()`の引数に含まれていない
  - [ ] `spawn()`のオプションに`cwd: worktreePath`が設定されている
  - [ ] プロセスが正常に起動する
- [ ] テストを実行すると失敗する（`npm test src/services/__tests__/process-manager.test.ts`）
- [ ] テストのみのコミットが作成されている

**依存関係**: なし

**推定工数**: 20分（AIエージェント作業時間）

**ステータス**: `TODO`

**技術的文脈**:
- テストフレームワーク: Vitest
- モック: `vi.mock('child_process')`を使用
- 既存テスト: `src/services/__tests__/process-manager.test.ts`に既存テストあり
- 参考: 既存のテストパターンに従う

---

#### タスク19.1.2: Process Managerの実装修正

**説明**:
`src/services/process-manager.ts`の実装を修正し、`--cwd`オプションではなく`spawn()`の`cwd`オプションを使用する。

**実装手順（TDD）**:
1. 実装修正: `src/services/process-manager.ts:94-104`を修正
   - 98行目の`args.push('--cwd', worktreePath);`を削除
   - 102-104行目の`spawn()`呼び出しに`cwd: worktreePath`オプションを追加
2. テスト実行: すべてのテストが通過することを確認
3. 実装コミット: 実装をコミット（コミットメッセージ: "fix: Process Manager - spawn cwdオプションを使用するよう修正"）

**修正コード例**:
```typescript
// 修正前（94-104行目）
const args = ['--print'];
if (model) {
  args.push('--model', model);
}
args.push('--cwd', worktreePath);  // この行を削除

const claudeCodePath = process.env.CLAUDE_CODE_PATH || 'claude';

const childProc = spawn(claudeCodePath, args, {
  stdio: ['pipe', 'pipe', 'pipe'],
});

// 修正後
const args = ['--print'];
if (model) {
  args.push('--model', model);
}

const claudeCodePath = process.env.CLAUDE_CODE_PATH || 'claude';

const childProc = spawn(claudeCodePath, args, {
  stdio: ['pipe', 'pipe', 'pipe'],
  cwd: worktreePath,  // この行を追加
});
```

**受入基準**:
- [ ] `src/services/process-manager.ts:98`の`args.push('--cwd', worktreePath);`が削除されている
- [ ] `spawn()`呼び出しに`cwd: worktreePath`オプションが追加されている
- [ ] すべてのユニットテストが通過する（`npm test src/services/__tests__/process-manager.test.ts`）
- [ ] ESLintエラーがゼロである（`npm run lint`）
- [ ] 実装のコミットが作成されている

**依存関係**: タスク19.1.1が完了していること

**推定工数**: 10分（AIエージェント作業時間）

**ステータス**: `TODO`

**技術的文脈**:
- 修正ファイル: `src/services/process-manager.ts`
- 修正箇所: 94-104行目
- Node.js API: `child_process.spawn()`の`cwd`オプションを使用

---

#### タスク19.1.3: Process Manager修正の動作確認

**説明**:
実際にセッションを作成し、Claude Codeプロセスが正常に起動することを確認する。

**検証手順**:
1. 開発サーバーを起動する
2. ブラウザでセッション作成フォームにアクセス
3. 新しいセッションを作成
4. サーバーログを確認:
   - ❌ `error: unknown option '--cwd'`エラーが出ないこと
   - ✅ Claude Codeプロセスが正常に起動していること
5. セッション詳細ページでWebSocketステータスを確認
6. 結果をドキュメント化

**受入基準**:
- [ ] セッションが正常に作成される
- [ ] サーバーログに`error: unknown option '--cwd'`エラーが表示されない
- [ ] Claude Codeプロセスが起動している（プロセスIDがログに記録される）
- [ ] 動作確認結果が`docs/verification-report-phase19-issue1.md`に記録されている

**依存関係**: タスク19.1.2が完了していること

**推定工数**: 15分（AIエージェント作業時間）

**ステータス**: `TODO`

**技術的文脈**:
- 検証環境: ローカル開発環境（nodejs-architectureブランチ）
- 検証ツール: ブラウザ、サーバーログ確認
- レポート形式: Markdown

---

### Phase 19.2: Issue #2修正 - WebSocket認証エラー

#### タスク19.2.1: WebSocket認証修正のテスト作成

**説明**:
`src/lib/websocket/auth-middleware.ts`のWebSocket認証ロジックを修正するためのテストを作成する。

**現在の問題**:
- WebSocketのURLパスに含まれるセッションID（Claude WorkセッションID）と、クッキーに保存されている認証セッションIDを比較している
- これらは異なる種類のIDであり、比較しても意味がない
- 結果として認証エラーが発生する

**修正方針**:
- WebSocket URLパスのセッションIDは、Claude Workセッション識別用としてのみ使用
- 認証は、クッキーに保存されている認証セッションIDの有効性のみで判断
- pathSessionIdとcookieSessionIdを比較しない

**実装手順（TDD）**:
1. テスト作成: `src/lib/websocket/__tests__/auth-middleware.test.ts`を作成/更新
   - クッキーに有効な認証セッションIDがある場合、認証成功することを確認
   - クッキーに無効な認証セッションIDがある場合、認証失敗することを確認
   - クッキーがない場合、認証失敗することを確認
   - pathSessionIdとcookieSessionIdが異なっていても、cookieSessionIdが有効なら認証成功することを確認
2. テスト実行: 現在の実装ではテストが失敗することを確認
3. テストコミット: テストのみをコミット（コミットメッセージ: "test: WebSocket認証ミドルウェアのテスト追加"）

**受入基準**:
- [ ] `src/lib/websocket/__tests__/auth-middleware.test.ts`にテストが追加されている
- [ ] テストが以下の4つを検証している:
  - [ ] 有効な認証セッションIDがある場合、認証成功
  - [ ] 無効な認証セッションIDがある場合、認証失敗
  - [ ] クッキーがない場合、認証失敗
  - [ ] pathSessionIdとcookieSessionIdが異なっていても認証成功
- [ ] テストを実行すると失敗する（`npm test src/lib/websocket/__tests__/auth-middleware.test.ts`）
- [ ] テストのみのコミットが作成されている

**依存関係**: なし

**推定工数**: 30分（AIエージェント作業時間）

**ステータス**: `TODO`

**技術的文脈**:
- テストフレームワーク: Vitest
- モック: `vi.mock('next-auth')`、`vi.mock('@/lib/db')`などを使用
- 新規ファイル: `src/lib/websocket/__tests__/auth-middleware.test.ts`（存在しない場合は作成）

---

#### タスク19.2.2: WebSocket認証ミドルウェアの実装修正

**説明**:
`src/lib/websocket/auth-middleware.ts`の実装を修正し、cookieSessionIdの有効性のみで認証を判断する。

**実装手順（TDD）**:
1. 実装修正: `src/lib/websocket/auth-middleware.ts`を修正
   - pathSessionIdとcookieSessionIdの比較ロジックを削除
   - cookieSessionIdが有効かどうかのみを確認
   - 認証成功時は、pathSessionIdをコンテキストに保存（セッション識別用）
2. テスト実行: すべてのテストが通過することを確認
3. 実装コミット: 実装をコミット（コミットメッセージ: "fix: WebSocket認証 - cookieSessionIDの有効性のみで判断するよう修正"）

**修正方針の詳細**:
- セッションIDには2種類ある:
  1. **cookieSessionId**: 認証セッションID（auth_sessionsテーブル）→ 認証に使用
  2. **pathSessionId**: Claude WorkセッションID（sessionsテーブル）→ セッション識別に使用
- 現在の誤った実装: これらを比較している
- 正しい実装: cookieSessionIdの有効性のみを検証し、pathSessionIdは識別用として使用

**受入基準**:
- [ ] `src/lib/websocket/auth-middleware.ts`でpathSessionIdとcookieSessionIdの比較が削除されている
- [ ] cookieSessionIdの有効性のみで認証判断を行っている
- [ ] 認証成功時、pathSessionIdをコンテキストに保存している
- [ ] すべてのユニットテストが通過する（`npm test src/lib/websocket/__tests__/auth-middleware.test.ts`）
- [ ] 既存のWebSocketハンドラのテストも通過する
- [ ] ESLintエラーがゼロである（`npm run lint`）
- [ ] 実装のコミットが作成されている

**依存関係**: タスク19.2.1が完了していること

**推定工数**: 20分（AIエージェント作業時間）

**ステータス**: `TODO`

**技術的文脈**:
- 修正ファイル: `src/lib/websocket/auth-middleware.ts`
- 関連ファイル: `src/lib/websocket/session-ws.ts`、`src/lib/websocket/terminal-ws.ts`
- 参考: `src/lib/auth.ts`の認証ロジック

---

#### タスク19.2.3: WebSocket認証修正の動作確認

**説明**:
実際にセッションを作成し、WebSocket接続が正常に確立されることを確認する。

**検証手順**:
1. 開発サーバーを起動する
2. ブラウザでセッション作成フォームにアクセス
3. 新しいセッションを作成
4. セッション詳細ページでWebSocket接続状態を確認:
   - ✅ WebSocketステータスが「connected」になること
   - ❌ 「disconnected」状態でないこと
5. サーバーログを確認:
   - ❌ "WebSocket authentication failed: Session ID mismatch"が出ないこと
   - ✅ WebSocket接続が確立されていること
6. ブラウザコンソールログを確認:
   - ❌ "HTTP Authentication failed"エラーが出ないこと
7. Terminalタブでも同様に確認
8. 結果をドキュメント化

**受入基準**:
- [ ] Session WebSocketが正常に接続される（状態: connected）
- [ ] Terminal WebSocketが正常に接続される（状態: connected）
- [ ] サーバーログに認証エラーが表示されない
- [ ] ブラウザコンソールログに認証エラーが表示されない
- [ ] 動作確認結果が`docs/verification-report-phase19-issue2.md`に記録されている

**依存関係**: タスク19.1.3とタスク19.2.2が完了していること

**推定工数**: 20分（AIエージェント作業時間）

**ステータス**: `TODO`

**技術的文脈**:
- 検証環境: ローカル開発環境（nodejs-architectureブランチ）
- 検証ツール: ブラウザ、Chrome DevTools、サーバーログ確認
- レポート形式: Markdown

---

### Phase 19.3: 統合動作確認

#### タスク19.3.1: 全機能の統合動作確認

**説明**:
Issue #1と#2の修正により、Issue #3（WebSocket接続失敗）が解消されていることを確認し、調査レポートで失敗していたすべての機能が正常に動作することを確認する。

**検証手順**:
1. 開発サーバーを起動する
2. 調査レポート（docs/verification-report-nodejs-architecture.md）の検証項目を再実施:
   - ✅ セッション作成
   - ✅ Claude Codeプロセス起動
   - ✅ WebSocket接続（Session）
   - ✅ WebSocket接続（Terminal）
   - ✅ Claude Codeとの対話
   - ✅ メッセージ送受信
   - ✅ リアルタイム出力表示
3. 各要件（REQ-XXX）の達成状況を確認:
   - REQ-011: worktree内でClaude Codeが起動する
   - REQ-014: Claude Code出力がリアルタイムで表示される
   - REQ-021-028: Claude Codeとの対話機能
   - REQ-058-062: ターミナル統合機能
4. 全テストを実行:
   - `npm test`: すべてのユニットテストが通過
   - `npm run lint`: ESLintエラーがゼロ
5. 結果をドキュメント化

**受入基準**:
- [ ] セッション作成が正常に動作する
- [ ] Claude Codeプロセスが正常に起動する
- [ ] Session WebSocketが接続される（状態: connected）
- [ ] Terminal WebSocketが接続される（状態: connected）
- [ ] Claude Codeへのメッセージ送信ができる
- [ ] Claude Codeからの応答がリアルタイムで表示される
- [ ] ターミナルでコマンド実行ができる
- [ ] すべてのユニットテストが通過する（`npm test`）
- [ ] ESLintエラーがゼロである（`npm run lint`）
- [ ] 調査レポートで失敗していた機能がすべて動作する
- [ ] 統合動作確認結果が`docs/verification-report-phase19-final.md`に記録されている

**依存関係**: タスク19.1.3とタスク19.2.3が完了していること

**推定工数**: 45分（AIエージェント作業時間）

**ステータス**: `TODO`

**技術的文脈**:
- 検証環境: ローカル開発環境（nodejs-architectureブランチ）
- 検証ツール: ブラウザ、Chrome DevTools、サーバーログ確認
- 参考: `docs/verification-report-nodejs-architecture.md`の検証項目
- レポート形式: Markdown（調査レポートと同じ構成）

---

#### タスク19.3.2: 受入基準の達成状況レポート作成

**説明**:
Phase 19の修正により、要件定義書（docs/requirements.md）の受入基準がどの程度達成されたかをレポートにまとめる。

**レポート内容**:
1. **修正前の達成状況**（調査レポートから転記）
   - ストーリー2（セッション作成と管理）: 7/9 (78%)
   - ストーリー4（Claude Codeとの対話）: 2/8 (25%)
   - ストーリー11（ターミナル統合）: 1/5 (20%)
2. **修正後の達成状況**（検証結果から記載）
   - 各ストーリーの達成度を更新
   - 未達成の要件がある場合は理由を記載
3. **非機能要件の達成状況**
   - NFR-001（Claude Code出力を500ms以内に表示）
   - NFR-002（10個の並列セッションを管理）
4. **次のステップ**
   - まだ未達成の要件がある場合、次のフェーズでの対応計画

**受入基準**:
- [ ] `docs/verification-report-phase19-final.md`に受入基準の達成状況が記載されている
- [ ] 修正前と修正後の達成度が比較できる
- [ ] 各ストーリーの達成度がパーセンテージで示されている
- [ ] 未達成の要件がある場合、理由が記載されている
- [ ] 次のステップが明確に示されている

**依存関係**: タスク19.3.1が完了していること

**推定工数**: 30分（AIエージェント作業時間）

**ステータス**: `TODO`

**技術的文脈**:
- 参考ドキュメント:
  - `docs/requirements.md`（要件定義書）
  - `docs/verification-report-nodejs-architecture.md`（修正前の調査レポート）
- レポート形式: Markdown

---

## フェーズ完了の定義

以下がすべて完了した時、Phase 19は完了とみなされます：

- [ ] すべてのタスクのステータスが`DONE`である
- [ ] Issue #1（Claude Codeプロセス起動）が解決されている
- [ ] Issue #2（WebSocket認証エラー）が解決されている
- [ ] Issue #3（WebSocket接続失敗）が解決されている
- [ ] すべてのテスト（ユニット）が通過する
- [ ] ESLintエラーがゼロである
- [ ] 調査レポートで失敗していた機能がすべて動作する
- [ ] 受入基準の達成状況レポートが作成されている

## 推定総工数

- タスク19.1.1: 20分
- タスク19.1.2: 10分
- タスク19.1.3: 15分
- タスク19.2.1: 30分
- タスク19.2.2: 20分
- タスク19.2.3: 20分
- タスク19.3.1: 45分
- タスク19.3.2: 30分
- **合計**: 190分（約3時間10分、AIエージェント作業時間）

## 備考

### Critical Issueの詳細

詳細は`docs/verification-report-nodejs-architecture.md`を参照してください。

**Issue #1: Claude Codeプロセスが起動しない**
- 影響度: Critical
- 影響: Claude Codeとの対話ができない
- 関連要件: REQ-011, REQ-014, REQ-021-028

**Issue #2: WebSocket認証エラー**
- 影響度: Critical
- 影響: WebSocket接続ができない
- 関連要件: REQ-014, REQ-021-028, REQ-058-062

**Issue #3: WebSocket接続失敗**
- 影響度: Critical
- 影響: リアルタイム通信ができない
- 関連要件: REQ-014, REQ-021-028
- 備考: Issue #1と#2の修正により自動的に解決

### 関連ドキュメント

- 調査レポート: `docs/verification-report-nodejs-architecture.md`
- 要件定義書: `docs/requirements.md`
- 設計書: `docs/design.md`

### TDDアプローチ

すべてのタスクはテスト駆動開発（TDD）で進めます：
1. テスト作成 → テスト実行（失敗確認） → テストコミット
2. 実装 → テスト実行（通過確認） → 実装コミット
3. ブラウザ動作確認 → レポート作成

### コミットメッセージ規約

- テストのみ: `test: [タスク内容]のテスト追加`
- 実装: `fix: [タスク内容] - [修正内容]`
- ドキュメント: `docs: [レポート名]を作成`

### 注意事項

- 各タスク完了時に必ずコミットする
- テストと実装のコミットを分ける
- ブラウザ動作確認の結果を必ずドキュメント化する
- すべての修正が完了するまで、mainブランチにマージしない
