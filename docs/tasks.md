# タスク

> このドキュメントはAIエージェント（Claude Code等）が実装を行うことを前提としています。
> タスクは具体的なファイルパス、技術仕様、検証可能な受入基準を含めて記載してください。

## 実装計画概要

### MVP範囲（フェーズ1〜4）

以下の機能をMVPとして実装:
- プロジェクト管理（CRUD）
- セッション作成と管理（単一セッション）
- Claude Codeとの対話（入出力、権限確認）
- 変更差分の確認（基本diff）
- Git操作（worktree作成/削除、rebase、squash merge）
- 認証（トークンベース）
- 基本的なレスポンシブ対応
- Docker Composeによるデプロイ

### 拡張機能（フェーズ5〜7）

MVP後に実装:
- セッションテンプレート（一括作成）
- プロンプト履歴
- ランスクリプト実行
- コミット履歴と復元
- リッチ出力（マークダウン/シンタックスハイライト）
- ターミナル統合（XTerm.js）
- サブエージェント出力の可視化
- モデル選択
- ライト/ダークモード

---

## フェーズ別タスク詳細

### Phase 1: 基盤構築 ✅
Next.js 15 + TypeScript + Prisma + SQLiteのプロジェクト基盤を構築。API Routes、データベーススキーマ、フロントエンド基本構成を設定。

### Phase 2: バックエンドコア機能 ✅
認証API、プロジェクトAPI、Git操作サービス、プロセスマネージャー、セッションAPIを実装。Claude Codeプロセス管理の基盤を構築。

### Phase 3: フロントエンドコア機能 ✅
認証画面、レイアウト、プロジェクト管理、セッション管理、Diff表示、Git操作UIを実装。MVP範囲のフロントエンド機能を完成。

### Phase 4: リアルタイム通信とMVP統合 ✅
WebSocketサーバー・クライアントを実装し、Claude Codeとのリアルタイム通信を確立。MVP E2Eテストを実施。

### Phase 5: 拡張機能（セッション管理強化） ✅
セッションテンプレート、プロンプト履歴、モデル選択、コミット履歴、Git状態インジケーター、詳細ステータス表示を実装。

### Phase 6: 拡張機能（高度な機能） ✅
ランスクリプト実行、ログフィルタリング、リッチ出力、サブエージェント出力表示、ターミナル統合（XTerm.js）を実装。

### Phase 7: UI/UX改善とドキュメント ✅
ライト/ダークモード、モバイルUI最適化、包括的なドキュメント（README、SETUP、ENV_VARS、API）を作成。

### Phase 8: バグ修正（PR#2レビュー結果対応） ✅
APIレスポンス形式修正、環境変数処理改善、エラーハンドリング強化、重複登録防止を実装。品質向上とセキュリティ強化。

### Phase 9: マージ後バグ修正 ✅
トースト通知表示修正、プロジェクト「開く」ボタン修正、Claude Codeパス設定機能追加。UI/UX改善。

### Phase 10: 動作確認で発見されたバグ修正 ✅
セッション作成500エラー修正、/projectsリダイレクト実装、設定ページレイアウト修正。動作安定性向上。

### Phase 19: Critical Issue修正 ✅
Process ManagerのClaude Code起動問題、WebSocket認証のセッションID不一致を修正。全機能の統合動作確認を実施。

---

## タスクステータスの凡例

- `TODO` - 未着手
- `IN_PROGRESS` - 作業中
- `BLOCKED` - 依存関係や問題によりブロック中
- `REVIEW` - レビュー待ち
- `DONE` - 完了

## リスクと軽減策

### リスク1: Claude Code CLIの仕様変更

**影響度**: 高
**発生確率**: 中
**軽減策**:
- Claude Code出力パーサーを抽象化し、仕様変更に対応しやすくする
- バージョン固定と定期的な互換性確認

### リスク2: WebSocket接続の不安定性

**影響度**: 中
**発生確率**: 中
**軽減策**:
- 自動再接続機能の実装
- REST APIへのフォールバック機能

### リスク3: 並列セッションによるリソース枯渇

**影響度**: 高
**発生確率**: 低
**軽減策**:
- 最大セッション数の制限（10セッション）
- リソース監視とアラート

### リスク4: Gitコンフリクトの複雑化

**影響度**: 中
**発生確率**: 中
**軽減策**:
- コンフリクト発生時の明確な通知
- 手動解決を促すUI（ターミナル統合で対応可能）

## 備考

### 技術スタック

**フロントエンド**:
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Zustand
- react-diff-viewer-continued
- XTerm.js（フェーズ6）
- Playwright（E2E）

**バックエンド（Next.js統合）**:
- Next.js 15.1 API Routes
- Next.jsカスタムサーバー（WebSocket統合）
- TypeScript
- Prisma 7.x
- better-sqlite3
- ws / socket.io（WebSocket）
- winston（ロギング）
- Vitest（テスト）

**インフラ**:
- Node.js 20+
- SQLite
- npxで実行可能（グローバルインストール不要）
- リバースプロキシ（Caddy/nginx推奨、本番環境のみ）

### コーディング規約

- TypeScript: strict mode有効
- ESLint + Prettier for linting/formatting
- コミットメッセージ: Conventional Commits
- ブランチ戦略: GitHub Flow

---

## セキュリティ・品質改善タスク

以下はCodeRabbitレビュー（#3574391877）で指摘された技術的負債・改善項目です。
優先度に応じて別PRで対応してください。

### タスク: パストラバーサル対策の強化
**優先度**: 高
**ファイル**: `src/app/api/projects/route.ts` (124-145行)

**問題**:
現在は`resolve()`で絶対パス化しているが、許可ベースディレクトリの検証がない。
任意のディレクトリをプロジェクトとして登録できる状態。

**実装内容**:
1. 環境変数`ALLOWED_PROJECT_BASE_DIRS`を追加（カンマ区切り）
2. リクエストされたパスが許可ディレクトリ配下にあることを検証
3. 許可外のパスの場合は403エラーを返す

**受入基準**:
- 許可ディレクトリ外のパスでプロジェクト作成を試みると403エラー
- 許可ディレクトリ内のパスでは正常に作成できる
- テストケースを追加

### タスク: Git操作の非同期化とタイムアウト設定
**優先度**: 中
**ファイル**: `src/app/api/projects/route.ts` (127-136行), `src/services/git-service.ts`

**問題**:
`spawnSync`はイベントループをブロックし、大規模リポジトリで応答が遅延する。

**実装内容**:
1. GitServiceの全メソッドを非同期化（`spawn` + Promise化）
2. タイムアウト設定を追加（デフォルト30秒、環境変数で調整可能）
3. API Routeを`async/await`に対応

**受入基準**:
- 全てのGit操作がノンブロッキングで実行される
- タイムアウト時にエラーが返される
- 既存テストが全て通る

### タスク: プロジェクトpath重複登録の防止
**優先度**: 中
**ファイル**: `prisma/schema.prisma`, `src/app/api/projects/route.ts` (138-145行)

**問題**:
同一pathで複数のプロジェクトを登録できる。

**実装内容**:
1. Prismaスキーマで`path`フィールドに`@unique`制約を追加
2. マイグレーション実行
3. POST /api/projectsでUniqueConstraintErrorをハンドリング（409 Conflict）

**受入基準**:
- 同一pathで2回目の登録を試みると409エラー
- エラーメッセージが明確（"Project already exists at this path"）
- テストケースを追加

### タスク: プロジェクト所有権チェックの実装
**優先度**: 高
**ファイル**: `src/app/api/projects/[project_id]/route.ts` (53-60, 132-138行)

**問題**:
認証済みユーザーなら誰でも全てのプロジェクトを更新・削除できる。
マルチユーザー環境でセキュリティリスク。

**実装内容**:
1. Prismaスキーマで`Project`モデルに`owner_id`フィールドを追加
2. `AuthSession`と`Project`の関連を定義
3. PUT/DELETEハンドラーで所有権チェックを実装（所有者のみ許可）
4. プロジェクト作成時に`owner_id`を自動設定

**受入基準**:
- 他人のプロジェクトを更新/削除しようとすると403エラー
- 自分のプロジェクトは正常に更新/削除できる
- GET /api/projectsは自分のプロジェクトのみ返す
- テストケースを追加

### タスク: ログ出力の機密情報対策
**優先度**: 低
**ファイル**: `src/app/api/sessions/[id]/merge/route.ts` (103-109行)

**問題**:
`commitMessage`全体をログ出力しており、意図せず機密情報が含まれる可能性。

**実装内容**:
1. ログ出力時にcommitMessageを先頭80文字に制限
2. 全体の文字数も記録（デバッグ用）

**実装例**:
```typescript
logger.info('Merged session successfully', {
  id,
  commitMessagePreview: sanitizedMessage.slice(0, 80),
  commitMessageLength: sanitizedMessage.length,
});
```

**受入基準**:
- ログに出力されるcommitMessageが80文字以内
- 文字数情報が記録される

---

### Phase 20: セッション詳細ページSSRエラー修正 ✅
XTerm.jsのSSRエラーを修正。動的インポート（next/dynamic）とuseEffectでクライアントサイド限定読み込みを実装。

## Phase 21: UI/UX改善（ロゴナビゲーション）

**検証レポート**: docs/verification-report-comprehensive-phase21.md
**実施期間**: 2025-12-21
**優先度**: Low
**推定期間**: 20分（AIエージェント作業時間）
**MVP**: No

### 背景

Phase 20マージ後の網羅的検証（docs/verification-report-comprehensive-phase21.md）で、ClaudeWorkロゴボタンがページ遷移しない問題を発見。ヘッダーの「ClaudeWork」ロゴボタンをクリックしてもトップページ（/）に遷移せず、ユーザビリティに影響している。

### 目的

ヘッダーのClaudeWorkロゴボタンにナビゲーション機能を追加し、クリック時にトップページ（/）へ遷移できるようにする。

### タスク

#### タスク21.1: ClaudeWorkロゴボタンのナビゲーション機能追加（TDD）

**説明**:
TDDアプローチで`src/components/layout/Header.tsx`のClaudeWorkロゴボタンにナビゲーション機能を追加する。

**実装手順（TDD）**:
1. **テスト作成**: `src/components/layout/__tests__/Header.test.tsx`にテストケースを追加
   - ClaudeWorkロゴボタンをクリックすると`router.push('/')`が呼ばれることを確認
   - useRouterフックをモック化して動作を検証
2. **テスト実行**: すべてのテストが失敗することを確認
3. **テストコミット**: テストのみをコミット（`test: ClaudeWorkロゴボタンのナビゲーションテスト追加`）
4. **実装**: `Header.tsx`を修正
   - `next/navigation`から`useRouter`をインポート
   - `router.push('/')`を呼ぶonClickハンドラーを追加
   - ロゴボタン要素にonClickハンドラーを設定
5. **テスト通過確認**: すべてのテストが通過することを確認（`npm test`）
6. **実装コミット**: 実装をコミット（`feat: ClaudeWorkロゴボタンにホームページナビゲーション機能を追加`）

**技術的文脈**:
- フレームワーク: Next.js 15 (App Router)
- ナビゲーション: next/navigation の useRouter フック
- テストフレームワーク: Vitest
- 既存のコンポーネントパターンは他のボタン実装を参照

**受入基準**:
- [ ] テストファイル`src/components/layout/__tests__/Header.test.tsx`が存在または更新されている
- [ ] ロゴボタンクリック時のテストが追加されている
- [ ] 実装前にテストのみのコミットが存在する
- [ ] `Header.tsx`に`useRouter`フックが追加されている
- [ ] ロゴボタンに`onClick`ハンドラーが設定されている
- [ ] `onClick`ハンドラーで`router.push('/')`が呼ばれている
- [ ] すべてのテストが通過する（`npm test`）
- [ ] ESLintエラーがゼロである
- [ ] 実装後のコミットが存在する

**依存関係**: なし

**推定工数**: 20分（AIエージェント作業時間）
- テスト作成・コミット: 8分
- 実装・テスト通過・コミット: 12分

**ステータス**: `TODO`

**情報の明確性**:

**明示された情報**:
- 対象ファイル: src/components/layout/Header.tsx
- テストファイル: src/components/layout/__tests__/Header.test.tsx
- 使用技術: Next.js 15 App Router, next/navigation useRouter
- 期待動作: ロゴクリック時に router.push('/') でトップページに遷移
- TDDアプローチ: テスト → 実装の順

**不明/要確認の情報**: なし（検証レポートで仕様が明確）

### Phase 21完了基準

- [ ] タスク21.1が完了している
- [ ] ClaudeWorkロゴボタンをクリックするとトップページ（/）に遷移する
- [ ] すべてのテストが通過している
- [ ] ESLintエラーがゼロである
- [ ] 2つのコミット（テスト、実装）が作成されている

### 解決されるIssue

**docs/verification-report-comprehensive-phase21.md**:
- Low Issue #1: ClaudeWorkロゴボタンがページ遷移しない

### 達成される要件

- REQ-001: トップページ（プロジェクト一覧）の表示
  - ヘッダーロゴからのナビゲーションが可能になる

### 技術的な学び

- Next.js App Router での useRouter フックの使用
- Vitest でのルーターモックのテスト方法
- ボタン要素へのナビゲーション機能の追加
