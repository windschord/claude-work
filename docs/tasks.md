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

**ステータス**: `DONE`

**情報の明確性**:

**明示された情報**:
- 対象ファイル: src/components/layout/Header.tsx
- テストファイル: `src/components/layout/__tests__/Header.test.tsx`
- 使用技術: Next.js 15 App Router, next/navigation useRouter
- 期待動作: ロゴクリック時に router.push('/') でトップページに遷移
- TDDアプローチ: テスト → 実装の順

**不明/要確認の情報**: なし（検証レポートで仕様が明確）

### Phase 21完了基準

- [x] タスク21.1が完了している
- [x] ClaudeWorkロゴボタンをクリックするとトップページ（/）に遷移する
- [x] すべてのテストが通過している
- [x] ESLintエラーがゼロである
- [x] 2つのコミット（テスト、実装）が作成されている

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

---

## Phase 22: Claude CLI自動検出機能の実装

**実施期間**: 2025-12-21
**優先度**: High
**推定期間**: 60分（AIエージェント作業時間）
**MVP**: Yes

### 背景

現在、Claude Code CLIのパスは環境変数`CLAUDE_CODE_PATH`で明示的に設定する必要がある。多くの環境では`claude`コマンドが既にPATH環境変数に含まれているため、自動検出機能を実装することでユーザーの設定負担を軽減する。また、CLAUDE_CODE_PATHが設定されている場合でも、そのパスが有効かどうかを検証することで、起動時のエラーを早期発見できる。

### 目的

- PATH環境変数から`claude`コマンドを自動検出する
- CLAUDE_CODE_PATHが設定済みの場合は、パスの有効性を検証する
- claudeコマンドが見つからない、または無効な場合はサーバー起動を停止する
- macOS/Linux環境でのみ動作し、Windows環境ではエラーメッセージを表示する

### タスク

#### タスク22.1: Claude CLIパス検出関数のテスト作成（TDD Step 1）

**説明**:
TDDアプローチで`src/lib/env-validation.ts`にClaudeパス検出関数`detectClaudePath()`のテストを作成する。

**実装手順（TDD）**:
1. **テスト作成**: `src/lib/__tests__/env-validation.test.ts`にテストケースを追加
   - CLAUDE_CODE_PATHが未設定でclaudeコマンドが見つかる場合、検出されたパスを返す
   - CLAUDE_CODE_PATHが設定済みで有効なパスの場合、そのパスを返す
   - CLAUDE_CODE_PATHが設定済みで無効なパスの場合、エラーをスローする
   - CLAUDE_CODE_PATHが未設定でclaudeコマンドが見つからない場合、エラーをスローする
   - Windows環境ではエラーをスローする
2. **テスト実行**: すべてのテストが失敗することを確認
3. **テストコミット**: テストのみをコミット

**技術的文脈**:
- テストフレームワーク: Vitest
- モック対象: child_process.execSync, fs.existsSync, process.platform
- テストファイルパターン: `src/lib/__tests__/env-validation.test.ts`

**受入基準**:
- [ ] テストファイル`src/lib/__tests__/env-validation.test.ts`が作成されている
- [ ] 5つ以上のテストケースが含まれている
- [ ] child_process.execSyncとfs.existsSyncがモック化されている
- [ ] テスト実行で失敗することを確認済み（`npm test`）
- [ ] ESLintエラーがゼロである
- [ ] テストのみのコミットが存在する

**依存関係**: なし

**推定工数**: 20分（AIエージェント作業時間）

**ステータス**: `DONE`

**情報の明確性**:

**明示された情報**:
- 対象ファイル: src/lib/env-validation.ts
- テストファイル: `src/lib/__tests__/env-validation.test.ts`
- 関数名: detectClaudePath()
- 使用技術: Node.js child_process.execSync, fs.existsSync
- OS検出: process.platform
- macOS/Linuxでwhichコマンドを使用

**不明/要確認の情報**: なし

#### タスク22.2: Claude CLIパス検出関数の実装（TDD Step 2）

**説明**:
`src/lib/env-validation.ts`に`detectClaudePath()`関数を実装し、テストを通過させる。

**実装手順**:
1. **実装**: `src/lib/env-validation.ts`にdetectClaudePath関数を追加
   - process.platformがwin32の場合、エラーをスローする
   - CLAUDE_CODE_PATH環境変数をチェック
   - 設定済みの場合、fs.existsSyncで存在確認
   - 存在しない場合はエラーをスローする
   - 未設定の場合、execSync('which claude')で検出
   - 検出成功時、trimしたパスを返す
   - 検出失敗時はエラーをスローする
2. **テスト通過確認**: すべてのテストが通過することを確認（`npm test`）
3. **実装コミット**: 実装をコミット

**技術的文脈**:
- Node.js標準モジュール: child_process, fs
- エラーハンドリング: try-catchでexecSyncの例外をキャッチ
- 文字列処理: trim()で改行を除去

**実装例**:
```typescript
import { execSync } from 'child_process';
import { existsSync } from 'fs';

export function detectClaudePath(): string {
  // Windows環境チェック
  if (process.platform === 'win32') {
    throw new Error('Windows is not supported. Please use macOS or Linux.');
  }

  // CLAUDE_CODE_PATHが設定済みの場合
  const envPath = process.env.CLAUDE_CODE_PATH;
  if (envPath) {
    if (!existsSync(envPath)) {
      throw new Error(`CLAUDE_CODE_PATH is set but the path does not exist: ${envPath}`);
    }
    return envPath;
  }

  // PATH環境変数から自動検出
  try {
    const path = execSync('which claude', { encoding: 'utf-8' }).trim();
    if (!path) {
      throw new Error('claude command not found');
    }
    return path;
  } catch (error) {
    throw new Error(
      'claude command not found in PATH. Please install Claude Code CLI or set CLAUDE_CODE_PATH environment variable.'
    );
  }
}
```

**受入基準**:
- [ ] `src/lib/env-validation.ts`にdetectClaudePath関数が実装されている
- [ ] Windows環境でエラーをスローする
- [ ] CLAUDE_CODE_PATH設定済みで有効な場合、そのパスを返す
- [ ] CLAUDE_CODE_PATH設定済みで無効な場合、エラーをスローする
- [ ] CLAUDE_CODE_PATH未設定でclaudeコマンドがある場合、検出パスを返す
- [ ] CLAUDE_CODE_PATH未設定でclaudeコマンドがない場合、エラーをスローする
- [ ] すべてのテストが通過する（`npm test`）
- [ ] ESLintエラーがゼロである
- [ ] 実装のコミットが存在する

**依存関係**: タスク22.1（テスト作成）

**推定工数**: 20分（AIエージェント作業時間）

**ステータス**: `DONE`

**情報の明確性**:

**明示された情報**:
- 関数シグネチャ: `detectClaudePath(): string`
- エラーメッセージの内容（design.mdに記載）
- whichコマンドの使用方法
- 戻り値の型: string（claudeコマンドの絶対パス）

**不明/要確認の情報**: なし

#### タスク22.3: サーバー起動時の環境検証統合

**説明**:
`server.ts`起動時に`detectClaudePath()`を呼び出し、検出されたパスを`process.env.CLAUDE_CODE_PATH`に設定する。検出失敗時はエラーログを出力してサーバー起動を停止する。

**実装手順**:
1. **実装**: `server.ts`を修正
   - `detectClaudePath`をインポート
   - サーバー起動前（WebSocket設定前）にdetectClaudePath()を呼び出し
   - 検出成功時、process.env.CLAUDE_CODE_PATHに設定
   - logger.infoで検出されたパスをログ出力
   - 検出失敗時、logger.errorでエラーログ出力
   - process.exit(1)でサーバー起動を停止
2. **動作確認**: `npm run dev`でサーバーが起動することを確認
3. **ログ確認**: 検出されたパスがログに出力されることを確認
4. **コミット**: 実装をコミット

**技術的文脈**:
- サーバーエントリーポイント: server.ts
- ログライブラリ: winston（既存のloggerを使用）
- 起動シーケンス: 環境検証 → WebSocket設定 → Next.js起動

**実装例**:
```typescript
import { detectClaudePath } from './src/lib/env-validation';

// 環境検証
try {
  const claudePath = detectClaudePath();
  process.env.CLAUDE_CODE_PATH = claudePath;
  logger.info('Claude Code CLI detected', { path: claudePath });
} catch (error) {
  logger.error('Failed to detect Claude Code CLI', {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
}
```

**受入基準**:
- [ ] `server.ts`にdetectClaudePathのインポートが追加されている
- [ ] サーバー起動前にdetectClaudePath()が呼ばれている
- [ ] 検出成功時、process.env.CLAUDE_CODE_PATHに設定される
- [ ] 検出成功時、logger.infoでパスがログ出力される
- [ ] 検出失敗時、logger.errorでエラーログ出力される
- [ ] 検出失敗時、process.exit(1)が呼ばれる
- [ ] `npm run dev`でサーバーが正常起動する
- [ ] ログに検出されたclaudeパスが表示される
- [ ] ESLintエラーがゼロである
- [ ] コミットが存在する

**依存関係**: タスク22.2（検出関数の実装）

**推定工数**: 20分（AIエージェント作業時間）

**ステータス**: `DONE`

**情報の明確性**:

**明示された情報**:
- 対象ファイル: server.ts
- インポート元: src/lib/env-validation.ts
- ログライブラリ: winston（既存のlogger）
- エラー時の動作: process.exit(1)

**不明/要確認の情報**: なし

### Phase 22完了基準

- [x] タスク22.1が完了している（テスト作成）
- [x] タスク22.2が完了している（検出関数実装）
- [x] タスク22.3が完了している（サーバー統合）
- [x] すべてのテストが通過している（`npm test`）
- [x] ESLintエラーがゼロである
- [x] サーバーが正常起動し、claudeパスがログに出力される
- [x] 3つのコミット（テスト、実装、統合）が作成されている
- [x] CLAUDE_CODE_PATH未設定でもサーバーが起動する
- [x] claudeコマンドが見つからない環境ではエラーメッセージが表示される

### 解決される要件

**docs/requirements.md**:
- REQ-070: サーバー起動時、CLAUDE_CODE_PATH環境変数が設定されていない場合、システムはPATH環境変数からclaudeコマンドのパスを自動検出しなければならない
- REQ-071: サーバー起動時、CLAUDE_CODE_PATH環境変数が既に設定されている場合、システムはそのパスの有効性を検証しなければならない
- REQ-072: claudeコマンドが見つからない場合、システムはエラーメッセージを表示してサーバー起動を停止しなければならない
- REQ-073: CLAUDE_CODE_PATHが無効なパスの場合、システムはエラーメッセージを表示してサーバー起動を停止しなければならない
- REQ-074: claudeコマンドが正常に検出された時、システムは検出されたパスをログに出力しなければならない
- REQ-075: システムはmacOSとLinuxでwhichコマンドを使用してclaude コマンドを検出しなければならない
- REQ-076: システムはWindows環境での動作をサポートしなければならない（将来的な拡張のため、現状はエラーで停止）

### 技術的な学び

- Node.js child_processでのコマンド実行
- 環境変数の検証パターン
- PATH環境変数からのコマンド検出
- TDDでのシステムコマンドモック化
- サーバー起動時の環境検証ベストプラクティス

---

## Phase 23: Critical Issue修正（ログイン認証・セッション認証）

**検証レポート**: docs/verification-report-comprehensive.md
**実施期間**: 2025-12-22
**優先度**: Critical
**推定期間**: 120分（AIエージェント作業時間）
**MVP**: Yes

### 背景

nodejs-architectureブランチの網羅的動作確認（docs/verification-report-comprehensive.md）で、2つのCritical不具合を発見：

1. **ログイン認証失敗**: .envファイルの正しいトークンを入力しても「トークンが無効です」エラーが発生し、ログインできない
2. **セッション認証失敗**: データベースに存在する有効なセッションでも `{"authenticated": false}` が返され、認証状態が維持できない

これらの不具合により、アプリケーション全体が使用不可能な状態となっている。

### 目的

- ログイン認証を修正し、正しいトークンでログインできるようにする
- セッション認証を修正し、ログイン後の認証状態を正しく維持できるようにする
- 環境変数の読み込み問題を解決する（Next.jsとdotenv/configの競合）
- Prisma DateTimeフィールドの比較処理を修正する

### タスク

#### タスク23.1: validateToken関数へのデバッグログ追加

**説明**:
`src/lib/auth.ts`の`validateToken`関数にデバッグログを追加し、実際に比較されているトークン値を確認できるようにする。

**実装手順**:
1. **実装**: `src/lib/auth.ts`のvalidateToken関数を修正
   - logger.debugで`process.env.CLAUDE_WORK_TOKEN`の値をログ出力（長さと先頭4文字のみ）
   - logger.debugで入力されたtokenの値をログ出力（長さと先頭4文字のみ）
   - logger.debugで比較結果（true/false）をログ出力
   - 機密情報を避けるため、トークン全体ではなく一部のみをログに出力
2. **動作確認**: `npm run dev:pm2`でサーバーを起動
3. **テスト**: ログイン画面から正しいトークンでログインを試行
4. **ログ確認**: `npm run pm2:logs`でデバッグログを確認
5. **コミット**: デバッグログ追加をコミット

**技術的文脈**:
- ロガー: winston（既存のloggerを使用）
- ログレベル: debug（本番環境では出力されない）
- 機密情報対策: トークンの一部のみを出力

**実装例**:
```typescript
export function validateToken(token: string): boolean {
  const validToken = process.env.CLAUDE_WORK_TOKEN;
  if (!validToken) {
    throw new Error('CLAUDE_WORK_TOKEN環境変数が設定されていません');
  }

  // デバッグログ追加
  logger.debug('Token validation debug', {
    service: 'claude-work',
    envTokenLength: validToken.length,
    envTokenPrefix: validToken.substring(0, 4),
    inputTokenLength: token.length,
    inputTokenPrefix: token.substring(0, 4),
  });

  const result = token === validToken;
  logger.debug('Token validation result', {
    service: 'claude-work',
    result,
  });

  return result;
}
```

**受入基準**:
- [ ] validateToken関数にlogger.debugが追加されている
- [ ] 環境変数のトークン情報（長さと先頭4文字）がログ出力される
- [ ] 入力トークン情報（長さと先頭4文字）がログ出力される
- [ ] 比較結果がログ出力される
- [ ] トークン全体は出力されない（機密情報保護）
- [ ] サーバーが正常起動する
- [ ] ログイン試行時にデバッグログが出力される
- [ ] ESLintエラーがゼロである
- [ ] コミットが存在する

**依存関係**: なし

**推定工数**: 15分（AIエージェント作業時間）

**ステータス**: `TODO`

**情報の明確性**:

**明示された情報**:
- 対象ファイル: src/lib/auth.ts
- 対象関数: validateToken
- ログライブラリ: winston（既存のlogger）
- ログレベル: debug
- 出力内容: トークンの長さと先頭4文字、比較結果

**不明/要確認の情報**: なし

---

#### タスク23.2: getSession関数へのデバッグログ追加

**説明**:
`src/lib/auth.ts`の`getSession`関数にデバッグログを追加し、Prisma DateTimeフィールドの値と比較処理の詳細を確認できるようにする。

**実装手順**:
1. **実装**: `src/lib/auth.ts`のgetSession関数を修正
   - logger.debugでsessionIdをログ出力
   - logger.debugでprisma.authSession.findUniqueの結果をログ出力
   - logger.debugでsession.expires_atの値と型をログ出力
   - logger.debugでnew Date()の値をログ出力
   - logger.debugで比較結果をログ出力
2. **動作確認**: サーバーを再起動
3. **テスト**: `/api/auth/session`にアクセスしてデバッグログを確認
4. **ログ確認**: `npm run pm2:logs`でデバッグログを確認
5. **コミット**: デバッグログ追加をコミット

**技術的文脈**:
- ロガー: winston（既存のloggerを使用）
- ログレベル: debug
- Prisma: authSession.findUnique

**実装例**:
```typescript
export async function getSession(sessionId: string) {
  logger.debug('getSession called', {
    service: 'claude-work',
    sessionId,
  });

  const session = await prisma.authSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    logger.debug('Session not found', {
      service: 'claude-work',
      sessionId,
    });
    return null;
  }

  logger.debug('Session found', {
    service: 'claude-work',
    sessionId,
    expiresAt: session.expires_at,
    expiresAtType: typeof session.expires_at,
    expiresAtConstructor: session.expires_at.constructor.name,
    currentTime: new Date(),
  });

  const isExpired = session.expires_at < new Date();
  logger.debug('Expiration check', {
    service: 'claude-work',
    sessionId,
    isExpired,
  });

  if (isExpired) {
    return null;
  }

  return session;
}
```

**受入基準**:
- [ ] getSession関数にlogger.debugが追加されている
- [ ] sessionIdがログ出力される
- [ ] Prismaの検索結果がログ出力される
- [ ] session.expires_atの値、型、コンストラクタ名がログ出力される
- [ ] new Date()の値がログ出力される
- [ ] 有効期限チェックの結果がログ出力される
- [ ] サーバーが正常起動する
- [ ] /api/auth/sessionアクセス時にデバッグログが出力される
- [ ] ESLintエラーがゼロである
- [ ] コミットが存在する

**依存関係**: なし

**推定工数**: 15分（AIエージェント作業時間）

**ステータス**: `TODO`

**情報の明確性**:

**明示された情報**:
- 対象ファイル: src/lib/auth.ts
- 対象関数: getSession
- ログライブラリ: winston（既存のlogger）
- ログレベル: debug
- 出力内容: sessionId、expires_atの値と型、比較結果

**不明/要確認の情報**: なし

---

#### タスク23.3: 環境変数読み込みの修正（dotenv/config削除）

**説明**:
`server.ts`から`dotenv/config`のインポートを削除し、Next.jsのネイティブな環境変数読み込みメカニズムのみを使用するように変更する。これにより、Next.jsとdotenv/configの競合を解消する。

**実装手順**:
1. **実装**: `server.ts`を修正
   - `import 'dotenv/config';`の行を削除
   - Next.jsは自動的に.env, .env.local, .env.productionなどを読み込むため、追加の変更は不要
2. **動作確認**: `npm run dev:pm2`でサーバーを起動
3. **ログ確認**: デバッグログで環境変数が正しく読み込まれていることを確認
4. **テスト**: ログイン画面から正しいトークンでログインを試行
5. **コミット**: 環境変数読み込み修正をコミット

**技術的文脈**:
- Next.js 15: 環境変数の自動読み込み機能を使用
- .envファイル: Next.jsが自動的に読み込む
- カスタムサーバー: Next.jsの環境変数読み込みがカスタムサーバーでも機能することを確認

**受入基準**:
- [ ] `server.ts`から`import 'dotenv/config';`が削除されている
- [ ] サーバーが正常起動する
- [ ] 環境変数CLAUDE_WORK_TOKENが正しく読み込まれている（デバッグログで確認）
- [ ] 環境変数SESSION_SECRETが正しく読み込まれている
- [ ] 環境変数DATABASE_URLが正しく読み込まれている
- [ ] ログイン機能が正常に動作する
- [ ] ESLintエラーがゼロである
- [ ] コミットが存在する

**依存関係**: タスク23.1, タスク23.2（デバッグログで確認するため）

**推定工数**: 10分（AIエージェント作業時間）

**ステータス**: `TODO`

**情報の明確性**:

**明示された情報**:
- 対象ファイル: server.ts
- 削除する行: `import 'dotenv/config';`
- Next.jsの環境変数読み込みを使用

**不明/要確認の情報**: なし

---

#### タスク23.4: getSession関数のDateTime比較修正（TDD）

**説明**:
TDDアプローチで`src/lib/auth.ts`の`getSession`関数を修正し、Prisma DateTimeフィールド（expires_at）を明示的にDate型に変換してから比較するように変更する。

**実装手順（TDD）**:
1. **テスト作成**: `src/lib/__tests__/auth.test.ts`にテストケースを追加
   - 有効期限内のセッションを取得するテスト
   - 有効期限切れのセッションを取得しようとするとnullが返るテスト
   - 存在しないセッションを取得しようとするとnullが返るテスト
2. **テスト実行**: すべてのテストが失敗することを確認（既存実装では失敗する可能性がある）
3. **テストコミット**: テストのみをコミット
4. **実装**: `getSession`関数を修正
   - `session.expires_at < new Date()`を`new Date(session.expires_at) < new Date()`に変更
   - デバッグログはそのまま維持（ただし、変換後の値も出力）
5. **テスト通過確認**: すべてのテストが通過することを確認（`npm test`）
6. **統合テスト**: `/api/auth/session`にアクセスして動作確認
7. **実装コミット**: 実装をコミット

**技術的文脈**:
- Prisma: SQLiteのDATETIME型を文字列として返す可能性がある
- Date型変換: new Date()コンストラクタで文字列をDate型に変換
- 比較演算子: Date型同士の比較は内部的にgetTime()が呼ばれる

**実装例**:
```typescript
export async function getSession(sessionId: string) {
  logger.debug('getSession called', {
    service: 'claude-work',
    sessionId,
  });

  const session = await prisma.authSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    logger.debug('Session not found', {
      service: 'claude-work',
      sessionId,
    });
    return null;
  }

  // expires_atを明示的にDate型に変換
  const expiresAt = new Date(session.expires_at);
  const now = new Date();

  logger.debug('Session found', {
    service: 'claude-work',
    sessionId,
    expiresAtRaw: session.expires_at,
    expiresAtConverted: expiresAt,
    currentTime: now,
  });

  const isExpired = expiresAt < now;
  logger.debug('Expiration check', {
    service: 'claude-work',
    sessionId,
    isExpired,
  });

  if (isExpired) {
    return null;
  }

  return session;
}
```

**受入基準**:
- [ ] テストファイル`src/lib/__tests__/auth.test.ts`が存在または更新されている
- [ ] getSessionのテストケースが3つ以上含まれている
- [ ] 実装前にテストのみのコミットが存在する
- [ ] `getSession`関数で`new Date(session.expires_at)`を使用している
- [ ] デバッグログが変換前後の値を出力している
- [ ] すべてのテストが通過する（`npm test`）
- [ ] `/api/auth/session`が正しく動作する
- [ ] 有効なセッションで`{"authenticated": true}`が返る
- [ ] 有効期限切れセッションで`{"authenticated": false}`が返る
- [ ] ESLintエラーがゼロである
- [ ] 実装のコミットが存在する

**依存関係**: タスク23.2（デバッグログで動作確認するため）

**推定工数**: 30分（AIエージェント作業時間）
- テスト作成・コミット: 15分
- 実装・テスト通過・コミット: 15分

**ステータス**: `TODO`

**情報の明確性**:

**明示された情報**:
- 対象ファイル: src/lib/auth.ts
- 対象関数: getSession
- テストファイル: src/lib/__tests__/auth.test.ts
- 修正内容: new Date(session.expires_at) < new Date()
- TDDアプローチ: テスト → 実装の順

**不明/要確認の情報**: なし

---

#### タスク23.5: 統合テストと動作確認

**説明**:
デバッグログを削除し、ログイン機能とセッション認証機能が正しく動作することを統合テストで確認する。

**実装手順**:
1. **デバッグログ削除**: validateToken関数とgetSession関数からデバッグログを削除
   - 本番環境に不要なデバッグログを削除
   - 必要に応じて重要なログ（エラー時など）は残す
2. **統合テスト**: 以下のシナリオを手動でテスト
   - ログイン画面で正しいトークンを入力してログイン
   - ダッシュボードにリダイレクトされることを確認
   - ページをリロードしても認証状態が維持されることを確認
   - ログアウトして再度ログインできることを確認
3. **自動テスト**: `npm test`ですべてのテストが通過することを確認
4. **コミット**: デバッグログ削除と動作確認完了をコミット

**技術的文脈**:
- 手動テスト: ブラウザでの動作確認
- 自動テスト: Vitest（既存のテストスイート）

**受入基準**:
- [ ] validateToken関数からデバッグログが削除されている
- [ ] getSession関数からデバッグログが削除されている
- [ ] ログイン画面で正しいトークンを入力すると、ダッシュボードにリダイレクトされる
- [ ] ページリロード後も認証状態が維持される
- [ ] ログアウト機能が正常に動作する
- [ ] 再ログインが可能である
- [ ] すべての自動テストが通過する（`npm test`）
- [ ] ESLintエラーがゼロである
- [ ] コミットが存在する

**依存関係**: タスク23.3, タスク23.4（すべての修正が完了していること）

**推定工数**: 20分（AIエージェント作業時間）
- デバッグログ削除: 5分
- 統合テスト: 10分
- コミット: 5分

**ステータス**: `TODO`

**情報の明確性**:

**明示された情報**:
- デバッグログの削除
- 手動での統合テスト実施
- 自動テストの実行

**不明/要確認の情報**: なし

---

#### タスク23.6: 検証レポート更新

**説明**:
`docs/verification-report-comprehensive.md`を更新し、Critical不具合が修正されたことを記録する。

**実装手順**:
1. **レポート更新**: verification-report-comprehensive.mdを編集
   - Critical Issue #1とCritical Issue #2のセクションに「修正済み」を追記
   - 修正内容の概要を追加
   - Phase 23へのリンクを追加
2. **コミット**: レポート更新をコミット

**受入基準**:
- [ ] verification-report-comprehensive.mdが更新されている
- [ ] Critical Issue #1に修正済みマーク（✅）が追加されている
- [ ] Critical Issue #2に修正済みマーク（✅）が追加されている
- [ ] 修正内容の概要が記載されている
- [ ] Phase 23へのリンクが追加されている
- [ ] コミットが存在する

**依存関係**: タスク23.5（すべての修正とテストが完了していること）

**推定工数**: 10分（AIエージェント作業時間）

**ステータス**: `TODO`

**情報の明確性**:

**明示された情報**:
- 対象ファイル: docs/verification-report-comprehensive.md
- 更新内容: Critical Issueの修正済みマーク追加

**不明/要確認の情報**: なし

---

### Phase 23完了基準

- [ ] タスク23.1が完了している（validateTokenデバッグログ追加）
- [ ] タスク23.2が完了している（getSessionデバッグログ追加）
- [ ] タスク23.3が完了している（dotenv/config削除）
- [ ] タスク23.4が完了している（DateTime比較修正）
- [ ] タスク23.5が完了している（統合テストと動作確認）
- [ ] タスク23.6が完了している（検証レポート更新）
- [ ] ログイン機能が正常に動作する
- [ ] セッション認証が正常に動作する
- [ ] すべてのテストが通過している（`npm test`）
- [ ] ESLintエラーがゼロである
- [ ] 6つのコミットが作成されている

### 解決される不具合

**docs/verification-report-comprehensive.md**:
- Critical Issue #1: ログイン認証が失敗する
- Critical Issue #2: セッション認証が機能しない

### 達成される要件

**docs/requirements.md**:
- REQ-055: システムは認証なしでのアクセスを拒否しなければならない
- REQ-056: 正しいトークンが入力された時、システムはセッションを開始し、ダッシュボードにリダイレクトしなければならない
- REQ-057: 認証済みセッションの有効期限が切れた時、システムはユーザーをログインページにリダイレクトしなければならない

### 技術的な学び

- Next.jsとdotenv/configの環境変数読み込み競合の解決方法
- Prisma SQLite DateTimeフィールドの型変換の必要性
- デバッグログを使った問題の特定手法
- TDDでの日時比較処理のテスト方法
