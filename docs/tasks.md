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

## Phase 23: Critical Issues修正（動作検証で発見）

**目的**: 動作検証で発見された2件のCritical不具合を修正し、アプリケーションの基本機能を回復する。

**背景**: 2025-12-21の動作検証で、ログイン機能とセッション認証が完全に動作しない2つのCritical不具合が発見された。これらはアプリケーション全体の使用を阻害するため、最優先で修正が必要。

**検証レポート**: `docs/verification-issues.md`

---

#### タスク23.1: 環境変数ロード問題の調査と修正（Issue #1）

**説明**:
ログイン機能が動作しない問題を修正する。`process.env.CLAUDE_WORK_TOKEN`が正しくロードされていないため、正しいトークンでもログインが失敗する。

**調査内容**:
1. `.env`ファイルには`CLAUDE_WORK_TOKEN=your-secure-token-here`が設定されている
2. `server.ts:1`で`import 'dotenv/config'`が実行されているが、環境変数が読み込まれていない
3. `src/lib/auth.ts:51-56`の`validateToken`関数で`process.env.CLAUDE_WORK_TOKEN`が`undefined`になっている可能性

**実装手順（調査→修正）**:
1. server.ts起動時に環境変数ロード状況をログ出力
2. dotenv/configのロードタイミングを確認
3. 必要に応じてdotenv.config()を明示的に呼び出し
4. ecosystem.config.jsのenv設定との競合を確認
5. 環境変数が正しくロードされることを確認
6. ログインテストを実施（E2Eまたは手動）

**受入基準**:
- [ ] server.ts起動時に`CLAUDE_WORK_TOKEN`がログ出力される（最初の4文字のみ表示）
- [ ] `.env`ファイルの`CLAUDE_WORK_TOKEN`が`process.env.CLAUDE_WORK_TOKEN`として読み込まれる
- [ ] ログインページで正しいトークン`your-secure-token-here`を入力してログイン成功する
- [ ] ログイン成功後、プロジェクト一覧ページにリダイレクトされる
- [ ] サーバーログに`Login attempt with invalid token`が出力されない
- [ ] 環境変数ロード確認のログが追加されている
- [ ] コミットが存在する

**依存関係**: なし（最優先タスク）

**推定工数**: 30分（AIエージェント作業時間）
- 調査・ログ追加: 15分
- 修正・検証: 15分

**ステータス**: `TODO`

**情報の明確性**:

**明示された情報**:
- 対象ファイル: server.ts, src/lib/auth.ts
- 環境変数名: CLAUDE_WORK_TOKEN
- .envファイルの設定値: your-secure-token-here
- 既存のインポート: import 'dotenv/config' (server.ts:1)
- エラー現象: validateToken関数でprocess.env.CLAUDE_WORK_TOKENがundefinedになっている

**不明/要確認の情報**: なし（調査タスクのため、実装中に判断）

---

#### タスク23.2: Prismaクライアントの再生成とAuthSession取得問題の修正（Issue #2）

**説明**:
セッション認証が機能しない問題を修正する。`prisma.authSession.findUnique()`がnullを返すが、データベースにはデータが存在する。Prismaクライアントとスキーマの不一致が原因と推定。

**調査内容**:
1. データベースに有効なセッションが存在する（ID: `50659c5c-bf82-4b1f-be63-59f5bfd28a93`）
2. `prisma.authSession.findUnique({ where: { id: '...' } })`がnullを返す
3. `prisma/schema.prisma`のAuthSessionモデル定義は正しい
4. Prismaクライアントが古い可能性、またはDATABASE_URLの不一致

**実装手順（修正→検証）**:
1. `npx prisma generate`を実行してPrismaクライアントを再生成
2. `npx prisma db push`でスキーマをデータベースに反映（念のため）
3. DATABASE_URL環境変数が正しいデータベースファイルを指していることを確認
4. サーバーを再起動
5. テストセッションを作成（または既存セッションを使用）
6. `/api/auth/session`エンドポイントにGETリクエスト
7. `{"authenticated": true}`が返されることを確認

**受入基準**:
- [ ] `npx prisma generate`が正常に完了する
- [ ] `prisma.authSession.findUnique()`がデータベースの既存セッションを取得できる
- [ ] 有効なセッションCookieを持つリクエストで`/api/auth/session`が`{"authenticated": true}`を返す
- [ ] AuthGuardコンポーネントが認証済みユーザーをプロジェクト一覧ページに通す
- [ ] ログイン後、プロジェクト一覧ページが正常に表示される
- [ ] サーバーログにPrismaクエリエラーが出力されない
- [ ] DATABASE_URL設定が確認されている
- [ ] コミットが存在する

**依存関係**: タスク23.1（ログイン機能修正）- ログインできないとセッション作成もできないため

**推定工数**: 30分（AIエージェント作業時間）
- Prisma再生成・検証: 15分
- セッション認証テスト: 15分

**ステータス**: `TODO`

**情報の明確性**:

**明示された情報**:
- 対象モデル: AuthSession (prisma/schema.prisma:51-56)
- データベースファイル: prisma/data/claudework.db
- 既存のセッションID: 50659c5c-bf82-4b1f-be63-59f5bfd28a93
- 問題のAPI: src/app/api/auth/session/route.ts:47
- 問題の関数: src/lib/auth.ts:68-82 (getSession)

**不明/要確認の情報**: なし

---

### Phase 23完了基準

- [ ] タスク23.1が完了している（環境変数ロード修正）
- [ ] タスク23.2が完了している（Prismaクライアント修正）
- [ ] ログインページで正しいトークンを入力してログイン成功する
- [ ] ログイン後、プロジェクト一覧ページが表示される
- [ ] セッションCookieが正しく機能し、認証状態が維持される
- [ ] `/api/auth/session`が認証済みユーザーに対して`{"authenticated": true}`を返す
- [ ] すべてのコミットが作成されている
- [ ] 動作検証チェックリスト（docs/verification-checklist.md）のログイン関連項目がパスする

### 解決される不具合

**docs/verification-issues.md**:
- Issue #1: ログイン機能が動作しない（Critical）- 環境変数ロード問題
- Issue #2: セッション認証が機能しない（Critical）- Prismaクエリ問題

**docs/requirements.md**:
- REQ-055: ユーザーがログインページにアクセスした時、システムは認証トークン入力フォームを表示しなければならない
- REQ-056: ユーザーが正しいトークンを入力した時、システムはセッションを開始しプロジェクト一覧ページにリダイレクトしなければならない
- REQ-057: セッションの有効期限が切れた時、システムはユーザーをログインページにリダイレクトしなければならない

### 技術的な学び

- dotenv環境変数ロードのタイミングとトラブルシューティング
- Prismaクライアント生成とスキーマ同期の重要性
- iron-sessionとCookie認証のデバッグ方法
- PM2環境変数設定との競合解決

---

## Phase 24: High Priority UIコンポーネント実装（動作検証で発見）

**目的**: テストファイルのみ存在し実装が欠落している3つのUIコンポーネントと、ランスクリプトログUIを実装する。

**背景**: 動作検証で、テスト仕様は存在するが実装ファイルが欠落しているコンポーネント（GitStatusBadge、PromptHistoryDropdown、CommitHistory）が発見された。また、ランスクリプトログ表示UIも未実装。これらはユーザー体験に大きく影響するHigh Priority機能。

**検証レポート**: `docs/verification-issues.md`

---

#### タスク24.1: GitStatusBadge.tsxの実装（Issue #3）

**説明**:
TDDで`src/components/sessions/GitStatusBadge.tsx`を実装する。テスト仕様は既に存在する（`src/components/sessions/__tests__/GitStatusBadge.test.tsx`）ため、テストファーストで実装を進める。

**実装手順（TDD）**:
1. テスト確認: `src/components/sessions/__tests__/GitStatusBadge.test.tsx`の内容を確認
2. テスト実行: `npm test -- GitStatusBadge.test.tsx`を実行し、失敗を確認
3. 実装: `src/components/sessions/GitStatusBadge.tsx`を実装
   - Props: `isDirty: boolean`を受け取る
   - isDirty=trueの場合: 「変更あり」バッジ（黄色/オレンジ系）
   - isDirty=falseの場合: 「クリーン」バッジ（緑系）
   - Tailwind CSSでスタイリング
4. テスト通過: すべてのテストが通過するまで実装を調整
5. 統合: SessionCard.tsxにGitStatusBadgeを追加
6. 動作確認: セッション一覧でGit状態が視覚的に表示されることを確認

**受入基準**:
- [ ] `src/components/sessions/GitStatusBadge.tsx`ファイルが作成されている
- [ ] GitStatusBadgeコンポーネントがprops `isDirty: boolean`を受け取る
- [ ] isDirty=trueで「変更あり」バッジが表示される
- [ ] isDirty=falseで「クリーン」バッジが表示される
- [ ] Tailwind CSSでレスポンシブ対応されている
- [ ] `src/components/sessions/__tests__/GitStatusBadge.test.tsx`のすべてのテストが通過する
- [ ] SessionCard.tsxにGitStatusBadgeが統合されている
- [ ] ESLintエラーがゼロである
- [ ] コミットが存在する

**依存関係**: Phase 23（認証修正）- UI表示をテストするには認証が必要

**推定工数**: 30分（AIエージェント作業時間）
- テスト確認・実装: 20分
- 統合・動作確認: 10分

**ステータス**: `TODO`

**情報の明確性**:

**明示された情報**:
- 対象ファイル: src/components/sessions/GitStatusBadge.tsx（新規作成）
- テストファイル: src/components/sessions/__tests__/GitStatusBadge.test.tsx（既存）
- 統合先: src/components/sessions/SessionCard.tsx
- スタイリング: Tailwind CSS
- 表示内容: isDirtyに応じて「変更あり」/「クリーン」

**不明/要確認の情報**: なし（テスト仕様から実装詳細を取得）

---

#### タスク24.2: PromptHistoryDropdown.tsxの実装（Issue #4）

**説明**:
TDDで`src/components/sessions/PromptHistoryDropdown.tsx`を実装する。テスト仕様は既に存在し、プロンプト履歴API（`src/app/api/prompts/route.ts`）も実装済み。

**実装手順（TDD）**:
1. テスト確認: `src/components/sessions/__tests__/PromptHistoryDropdown.test.tsx`の内容を確認
2. API確認: `/api/prompts` GET エンドポイントの仕様を確認
3. テスト実行: `npm test -- PromptHistoryDropdown.test.tsx`を実行し、失敗を確認
4. 実装: `src/components/sessions/PromptHistoryDropdown.tsx`を実装
   - `/api/prompts`からプロンプト履歴を取得
   - ドロップダウンメニュー表示（Headless UI Menuコンポーネント使用）
   - 履歴選択時、親コンポーネントにプロンプトテキストを渡すコールバック
   - ローディング状態とエラーハンドリング
5. テスト通過: すべてのテストが通過するまで実装を調整
6. 統合: CreateSessionForm.tsxのプロンプト入力欄に統合
7. 動作確認: 新規セッション作成時に履歴ドロップダウンが機能することを確認

**受入基準**:
- [ ] `src/components/sessions/PromptHistoryDropdown.tsx`ファイルが作成されている
- [ ] GET `/api/prompts`からプロンプト履歴を取得する
- [ ] Headless UI Menuコンポーネントでドロップダウンを実装
- [ ] 履歴選択時、onSelect(promptText)コールバックが呼ばれる
- [ ] ローディング状態が表示される
- [ ] エラー発生時、適切なメッセージが表示される
- [ ] `src/components/sessions/__tests__/PromptHistoryDropdown.test.tsx`のすべてのテストが通過する
- [ ] CreateSessionForm.tsxに統合されている
- [ ] プロンプト入力欄の近くにドロップダウントリガーボタンが配置されている
- [ ] ESLintエラーがゼロである
- [ ] コミットが存在する

**依存関係**: Phase 23（認証修正）

**推定工数**: 40分（AIエージェント作業時間）
- テスト確認・実装: 25分
- 統合・動作確認: 15分

**ステータス**: `TODO`

**情報の明確性**:

**明示された情報**:
- 対象ファイル: src/components/sessions/PromptHistoryDropdown.tsx（新規作成）
- テストファイル: src/components/sessions/__tests__/PromptHistoryDropdown.test.tsx（既存）
- 統合先: src/components/sessions/CreateSessionForm.tsx
- API: GET /api/prompts（実装済み: src/app/api/prompts/route.ts）
- UIライブラリ: Headless UI Menu

**不明/要確認の情報**: なし（テスト仕様とAPI仕様から実装詳細を取得）

---

#### タスク24.3: CommitHistory.tsxの実装（Issue #5）

**説明**:
TDDで`src/components/git/CommitHistory.tsx`を実装する。テスト仕様は既に存在し、コミット取得API（GET `/api/sessions/:id/commits`）とリセットAPI（POST `/api/sessions/:id/reset`）も実装済み。

**実装手順（TDD）**:
1. テスト確認: `src/components/git/__tests__/CommitHistory.test.tsx`の内容を確認
2. API確認: `/api/sessions/:id/commits`と`/api/sessions/:id/reset`の仕様を確認
3. テスト実行: `npm test -- CommitHistory.test.tsx`を実行し、失敗を確認
4. 実装: `src/components/git/CommitHistory.tsx`を実装
   - GET `/api/sessions/:id/commits`からコミット履歴を取得
   - コミット一覧を時系列で表示（ハッシュ、メッセージ、日時、変更ファイル数）
   - コミット選択時、diff表示エリアを更新
   - 「このコミットに戻る」ボタンと確認ダイアログ
   - POST `/api/sessions/:id/reset`でリセット実行
5. テスト通過: すべてのテストが通過するまで実装を調整
6. 統合: セッション詳細ページ（`src/app/sessions/[id]/page.tsx`）に「Commits」タブを追加
7. 動作確認: コミット履歴の閲覧とリセット機能が動作することを確認

**受入基準**:
- [ ] `src/components/git/CommitHistory.tsx`ファイルが作成されている
- [ ] GET `/api/sessions/:id/commits`からコミット履歴を取得する
- [ ] コミット一覧が時系列で表示される（ハッシュ、メッセージ、日時、変更ファイル数）
- [ ] コミット選択時、diff表示エリアが更新される
- [ ] 「このコミットに戻る」ボタンをクリックで確認ダイアログが表示される
- [ ] ダイアログで確認後、POST `/api/sessions/:id/reset`が呼ばれる
- [ ] リセット成功時、コミット履歴が再読み込みされる
- [ ] `src/components/git/__tests__/CommitHistory.test.tsx`のすべてのテストが通過する
- [ ] セッション詳細ページに「Commits」タブが追加されている
- [ ] タブ切り替えでCommitHistoryコンポーネントが表示される
- [ ] ESLintエラーがゼロである
- [ ] コミットが存在する

**依存関係**: Phase 23（認証修正）

**推定工数**: 50分（AIエージェント作業時間）
- テスト確認・実装: 30分
- 統合・動作確認: 20分

**ステータス**: `TODO`

**情報の明確性**:

**明示された情報**:
- 対象ファイル: src/components/git/CommitHistory.tsx（新規作成）
- テストファイル: src/components/git/__tests__/CommitHistory.test.tsx（既存）
- 統合先: src/app/sessions/[id]/page.tsx（新タブ追加）
- API: GET /api/sessions/:id/commits, POST /api/sessions/:id/reset（実装済み）
- 表示内容: ハッシュ、メッセージ、日時、変更ファイル数

**不明/要確認の情報**: なし（テスト仕様とAPI仕様から実装詳細を取得）

---

#### タスク24.4: ランスクリプトログ表示UIの実装（Issue #6）

**説明**:
セッション詳細ページに「Scripts」タブを追加し、ランスクリプト実行時のログをリアルタイムで表示するUIを実装する。バックエンド（RunScriptManager）は実装済みのため、WebSocket経由でログイベントを受信する。

**実装手順（実装→テスト）**:
1. WebSocket拡張: SessionWebSocketHandlerにランスクリプトログイベントの転送を追加
   - RunScriptManagerの`log`イベントをリスニング
   - WebSocket経由でクライアントに`run_script_log`メッセージを送信
2. コンポーネント作成: `src/components/scripts/ScriptLogViewer.tsx`を作成
   - ログ一覧表示（時刻、ログレベル、メッセージ）
   - ログレベルフィルター（info/warn/error）- REQ-035
   - テキスト検索機能 - REQ-036
   - 終了コードと実行時間の表示 - REQ-037（Issue #8とも関連）
   - 自動スクロール（最新ログへ）
3. 統合: セッション詳細ページに「Scripts」タブを追加
   - ランスクリプト一覧表示（RunScriptList使用）
   - 実行ボタン、停止ボタン
   - ScriptLogViewerでログ表示
4. テスト作成: `src/components/scripts/__tests__/ScriptLogViewer.test.tsx`
5. 動作確認: ランスクリプト実行時、ログがリアルタイムで表示されることを確認

**受入基準**:
- [ ] SessionWebSocketHandlerがRunScriptManagerのlogイベントを転送する
- [ ] `src/components/scripts/ScriptLogViewer.tsx`ファイルが作成されている
- [ ] ログ一覧が時刻、ログレベル、メッセージを含めて表示される
- [ ] ログレベルフィルター（info/warn/error）が機能する（REQ-035）
- [ ] テキスト検索機能が実装されている（REQ-036）
- [ ] ランスクリプト終了時、終了コードと実行時間が表示される（REQ-037）
- [ ] 自動スクロールで最新ログが常に表示される
- [ ] セッション詳細ページに「Scripts」タブが追加されている
- [ ] ランスクリプト一覧と実行/停止ボタンが表示される
- [ ] ランスクリプト実行中、ログがリアルタイムで表示される
- [ ] `src/components/scripts/__tests__/ScriptLogViewer.test.tsx`が作成され、すべてのテストが通過する
- [ ] ESLintエラーがゼロである
- [ ] コミットが存在する

**依存関係**: Phase 23（認証修正）

**推定工数**: 60分（AIエージェント作業時間）
- WebSocket拡張: 15分
- ScriptLogViewer実装: 30分
- 統合・テスト・動作確認: 15分

**ステータス**: `TODO`

**情報の明確性**:

**明示された情報**:
- 対象ファイル:
  - src/components/scripts/ScriptLogViewer.tsx（新規作成）
  - src/lib/websocket/session-websocket-handler.ts（修正）
  - src/app/sessions/[id]/page.tsx（タブ追加）
- バックエンド: src/services/run-script-manager.ts（実装済み）
- 既存コンポーネント: src/components/settings/RunScriptList.tsx
- WebSocketメッセージタイプ: run_script_log（新規追加）
- 実装機能: ログ表示、フィルター、検索、終了コード/実行時間表示

**不明/要確認の情報**: なし

---

### Phase 24完了基準

- [ ] タスク24.1が完了している（GitStatusBadge実装）
- [ ] タスク24.2が完了している（PromptHistoryDropdown実装）
- [ ] タスク24.3が完了している（CommitHistory実装）
- [ ] タスク24.4が完了している（ランスクリプトログUI実装）
- [ ] すべてのテストが通過している（`npm test`）
- [ ] ESLintエラーがゼロである
- [ ] セッション一覧でGit状態インジケーターが表示される
- [ ] 新規セッション作成時、プロンプト履歴ドロップダウンが機能する
- [ ] セッション詳細ページ「Commits」タブでコミット履歴が閲覧できる
- [ ] セッション詳細ページ「Scripts」タブでランスクリプトログが表示される
- [ ] すべてのコミットが作成されている

### 解決される不具合

**docs/verification-issues.md**:
- Issue #3: Git状態インジケーターが未実装（High）
- Issue #4: プロンプト履歴ドロップダウンが未実装（High）
- Issue #5: コミット履歴UIが未実装（High）
- Issue #6: ランスクリプトログ表示UIが未実装（High）

**docs/requirements.md**:
- REQ-016: セッション一覧表示時、システムは各セッションのGit状態インジケーターを表示しなければならない
- REQ-018: プロンプト入力時、システムは過去のプロンプト履歴をドロップダウンで表示しなければならない
- REQ-019: ユーザーが履歴を選択した時、システムはプロンプト入力欄に挿入しなければならない
- REQ-034: ランスクリプト実行中、システムは出力をリアルタイムで専用ログタブに表示しなければならない
- REQ-035: ログタブ表示時、システムはログレベル（info/warn/error）でフィルターできる機能を提供しなければならない
- REQ-036: ログタブ表示時、システムはログをテキスト検索できる機能を提供しなければならない
- REQ-037: ランスクリプト終了時、システムは終了コードと実行時間を表示しなければならない
- REQ-039: セッション詳細ページのCommitsタブで、システムはworktree内のコミット履歴を時系列で表示しなければならない
- REQ-040: コミット履歴表示時、システムは各コミットのハッシュ、メッセージ、日時、変更ファイル数を表示しなければならない
- REQ-041: ユーザーがコミットを選択した時、システムは変更内容（diff）を表示しなければならない
- REQ-042: ユーザーが「このコミットに戻る」をクリックした時、システムは確認ダイアログを表示しなければならない

### 技術的な学び

- TDDでのReactコンポーネント実装
- テスト仕様から実装への変換プロセス
- WebSocketによるリアルタイムログ配信
- Headless UIによるアクセシブルなドロップダウン実装
- ログフィルタリングと検索のUXパターン

---

## Phase 25: Medium Priority機能改善（動作検証で発見）

**目的**: 部分的に実装されているが、UI表示やユーザー体験が不完全な2つの機能を改善する。

**背景**: サブエージェント出力の折りたたみ表示とランスクリプト終了コード表示は、データモデルやイベント発火は実装されているが、UI表示が未確認または不完全。

**検証レポート**: `docs/verification-issues.md`

---

#### タスク25.1: サブエージェント出力の折りたたみ表示確認と実装（Issue #7）

**説明**:
サブエージェント出力が折りたたみ可能なUIで表示されているか確認し、未実装の場合は実装する。データモデル（`src/store/index.ts:85-86`）には`sub_agents`フィールドが存在するため、MessageDisplayコンポーネントでの処理を確認・実装する。

**実装手順（調査→実装）**:
1. 調査: `src/components/sessions/MessageDisplay.tsx`でsub_agentsフィールドの処理を確認
2. テストデータ作成: sub_agentsを含むメッセージデータを用意
3. 表示確認: サブエージェント出力が折りたたみ表示されるか確認
4. 未実装の場合:
   - MessageDisplayにsub_agents表示ロジックを追加
   - Headless UI Disclosureコンポーネントで折りたたみUI実装
   - 各サブエージェントタスクの名前、ステータス、出力を表示
   - 展開/折りたたみアニメーション
5. テスト作成: `src/components/sessions/__tests__/MessageDisplay.test.tsx`にsub_agents表示テストを追加
6. 動作確認: セッション詳細ページでサブエージェント出力が適切に表示されることを確認

**受入基準**:
- [ ] MessageDisplay.tsxでsub_agentsフィールドを処理している
- [ ] サブエージェント出力が折りたたみ可能なUIで表示される
- [ ] 各サブエージェントタスクの名前、ステータス、出力が表示される
- [ ] Headless UI Disclosureで展開/折りたたみが実装されている
- [ ] デフォルトで折りたたまれている状態
- [ ] 展開/折りたたみアニメーションがスムーズ
- [ ] `src/components/sessions/__tests__/MessageDisplay.test.tsx`にテストが追加され、通過する
- [ ] ESLintエラーがゼロである
- [ ] コミットが存在する

**依存関係**: Phase 23（認証修正）

**推定工数**: 40分（AIエージェント作業時間）
- 調査・確認: 15分
- 実装（必要な場合）: 20分
- テスト・動作確認: 5分

**ステータス**: `TODO`

**情報の明確性**:

**明示された情報**:
- 対象ファイル: src/components/sessions/MessageDisplay.tsx
- データモデル: src/store/index.ts:85-86 (sub_agentsフィールド)
- UIライブラリ: Headless UI Disclosure
- 表示内容: サブエージェントタスクの名前、ステータス、出力

**不明/要確認の情報**: なし（調査タスクのため、実装中に判断）

---

#### タスク25.2: ランスクリプト終了コードと実行時間の表示確認（Issue #8）

**説明**:
ランスクリプト終了時の終了コードと実行時間がUIに表示されているか確認し、未実装の場合は実装する。RunScriptManager（`src/services/run-script-manager.ts:191-198`）でイベント発火は実装済み。

**実装手順（調査→実装）**:
1. 調査: Phase 24.4で実装するScriptLogViewerでの終了コード/実行時間表示を確認
2. イベント確認: RunScriptManagerの`end`イベントのデータ構造を確認
3. 表示確認: ログUI下部または最終行に終了コード/実行時間が表示されるか確認
4. 未実装の場合:
   - ScriptLogViewerに終了情報表示エリアを追加
   - `run_script_end`イベントで終了コード（exitCode）と実行時間（duration）を取得
   - 成功時（exitCode=0）は緑、失敗時（exitCode≠0）は赤で表示
   - 実行時間をhh:mm:ss形式でフォーマット
5. テスト追加: ScriptLogViewer.test.tsxに終了情報表示テストを追加
6. 動作確認: ランスクリプト実行終了時、終了コードと実行時間が表示されることを確認

**受入基準**:
- [ ] ScriptLogViewerが`run_script_end`イベントを処理する
- [ ] ランスクリプト終了時、終了コードが表示される
- [ ] 終了コード0は緑、0以外は赤で表示される
- [ ] 実行時間がhh:mm:ss形式で表示される
- [ ] ログUI下部または最終行に終了情報エリアが配置されている
- [ ] `src/components/scripts/__tests__/ScriptLogViewer.test.tsx`に終了情報表示テストが追加され、通過する
- [ ] ESLintエラーがゼロである
- [ ] コミットが存在する

**依存関係**: タスク24.4（ランスクリプトログUI実装）- ScriptLogViewerが実装されている必要がある

**推定工数**: 30分（AIエージェント作業時間）
- 調査・確認: 10分
- 実装（必要な場合）: 15分
- テスト・動作確認: 5分

**ステータス**: `TODO`

**情報の明確性**:

**明示された情報**:
- 対象ファイル: src/components/scripts/ScriptLogViewer.tsx（Phase 24.4で作成）
- イベント発火: src/services/run-script-manager.ts:191-198
- WebSocketイベント: run_script_end（新規追加が必要な場合）
- 表示内容: 終了コード（exitCode）、実行時間（duration）
- 表示形式: exitCode=0は緑、≠0は赤

**不明/要確認の情報**: なし

---

### Phase 25完了基準

- [ ] タスク25.1が完了している（サブエージェント表示確認・実装）
- [ ] タスク25.2が完了している（ランスクリプト終了コード表示確認）
- [ ] サブエージェント出力が折りたたみ可能なUIで表示される
- [ ] ランスクリプト終了時、終了コードと実行時間が表示される
- [ ] すべてのテストが通過している（`npm test`）
- [ ] ESLintエラーがゼロである
- [ ] すべてのコミットが作成されている

### 解決される不具合

**docs/verification-issues.md**:
- Issue #7: サブエージェント出力の折りたたみ表示が部分実装（Medium）
- Issue #8: ランスクリプト終了コードと実行時間の表示が部分実装（Medium）

**docs/requirements.md**:
- REQ-024: Claude Code出力時、システムはサブエージェントタスクの出力を折りたたみ可能に表示しなければならない
- REQ-037: ランスクリプト終了時、システムは終了コードと実行時間を表示しなければならない（Phase 24.4でも対応）

### 技術的な学び

- データモデルとUI表示の整合性確認
- イベント駆動アーキテクチャでのUI更新
- Headless UI Disclosureによるアクセシブルな折りたたみUI
- 実行結果の視覚的フィードバック（色分け、フォーマット）

---

## Phase 26: UI Navigation Bugs修正（Phase 25検証で発見）

**目的**: Phase 23-25実装後の網羅的検証で発見された、既存UIナビゲーション機能の3つの不具合を修正する。

**背景**: 2025-12-22のPhase 23-25網羅的動作検証（docs/verification-report-phase25-3.md）で、プロジェクト一覧「開く」ボタン、サイドバー「セッション」ボタン、サイドバープロジェクト一覧表示の3つのUIナビゲーション不具合が発見された。これらはPhase 23-25の実装とは無関係の既存UI実装問題。

**検証レポート**: `docs/verification-report-phase25-3.md`

---

#### タスク26.1: プロジェクト一覧「開く」ボタンのナビゲーション修正（Issue #1）

**説明**:
プロジェクト一覧ページの「開く」ボタンをクリックしてもページ遷移しない問題を修正する。onClickハンドラーまたはrouter.push()の実装を調査・修正する。

**調査内容**:
1. `src/components/projects/ProjectCard.tsx`の「開く」ボタン実装を確認
2. onClickハンドラーが正しく設定されているか確認
3. router.push()の呼び出しが失敗していないか確認
4. イベント伝播がpreventDefault()で阻止されていないか確認

**実装手順（調査→修正→テスト）**:
1. **調査**: ProjectCard.tsxの「開く」ボタンのコードを読み取り
2. **問題特定**: onClickハンドラーやrouter.push()の問題を特定
3. **修正**: 問題箇所を修正
   - onClickハンドラーが未設定の場合は追加
   - router.push()が呼ばれていない場合は呼び出しを追加
   - イベント伝播の問題があれば修正
4. **テスト作成/更新**: `src/components/projects/__tests__/ProjectCard.test.tsx`にテストを追加
   - 「開く」ボタンクリック時、router.push(`/projects/${projectId}`)が呼ばれることを確認
5. **動作確認**: プロジェクト一覧ページで「開く」ボタンが正常に動作することを確認
6. **コミット**: 修正をコミット

**受入基準**:
- [ ] ProjectCard.tsxの「開く」ボタンにonClickハンドラーが設定されている
- [ ] onClickハンドラーで`router.push(/projects/${projectId})`が呼ばれる
- [ ] プロジェクト一覧ページで「開く」ボタンをクリックするとプロジェクト詳細ページに遷移する
- [ ] `src/components/projects/__tests__/ProjectCard.test.tsx`にボタンクリックテストが追加され、通過する
- [ ] ESLintエラーがゼロである
- [ ] コミットが存在する

**依存関係**: なし

**推定工数**: 25分（AIエージェント作業時間）
- 調査・問題特定: 10分
- 修正・テスト: 10分
- 動作確認: 5分

**ステータス**: `TODO`

**情報の明確性**:

**明示された情報**:
- 対象ファイル: src/components/projects/ProjectCard.tsx
- テストファイル: src/components/projects/__tests__/ProjectCard.test.tsx
- 要件: REQ-003（プロジェクト一覧表示）
- 期待動作: 「開く」ボタンクリックでプロジェクト詳細ページ（/projects/:id）に遷移
- 現象: クリックしても何も起こらない
- 推定原因: onClick ハンドラー未設定、router.push()失敗、イベント伝播の阻止

**不明/要確認の情報**: なし（調査タスクのため、実装中に判断）

---

#### タスク26.2: サイドバー「セッション」ボタンのクリック問題修正（Issue #2）

**説明**:
サイドバーのプロジェクト「セッション」ボタンをクリックするとタイムアウトが発生する問題を修正する。ボタンのクリック可能性、z-index問題、イベントハンドラーを調査・修正する。

**調査内容**:
1. `src/components/layout/Sidebar.tsx`のプロジェクトセッションボタン実装を確認
2. ボタンがクリック不可能な状態になっていないか確認
3. z-indexの問題で他の要素に隠れていないか確認
4. イベントハンドラーが正しく設定されているか確認

**実装手順（調査→修正→テスト）**:
1. **調査**: Sidebar.tsxのプロジェクトセッションボタンのコードを読み取り
2. **問題特定**: クリックできない原因を特定
3. **修正**: 問題箇所を修正
   - ボタンのdisabled状態を修正
   - z-indexの問題を修正
   - イベントハンドラーを追加/修正
4. **テスト作成/更新**: `src/components/layout/__tests__/Sidebar.test.tsx`にテストを追加
   - プロジェクトセッションボタンクリック時、router.push()が呼ばれることを確認
5. **動作確認**: サイドバーのプロジェクトセッションボタンが正常にクリックできることを確認
6. **コミット**: 修正をコミット

**受入基準**:
- [ ] Sidebar.tsxのプロジェクトセッションボタンがクリック可能である
- [ ] ボタンクリック時、プロジェクト詳細ページに遷移する
- [ ] z-indexや他の要素に隠れていない
- [ ] イベントハンドラーが正しく設定されている
- [ ] `src/components/layout/__tests__/Sidebar.test.tsx`にボタンクリックテストが追加され、通過する
- [ ] ESLintエラーがゼロである
- [ ] コミットが存在する

**依存関係**: なし

**推定工数**: 30分（AIエージェント作業時間）
- 調査・問題特定: 15分
- 修正・テスト: 10分
- 動作確認: 5分

**ステータス**: `TODO`

**情報の明確性**:

**明示された情報**:
- 対象ファイル: src/components/layout/Sidebar.tsx
- テストファイル: src/components/layout/__tests__/Sidebar.test.tsx
- 要件: REQ-003（プロジェクト一覧表示）
- 期待動作: サイドバーの「セッション」ボタンクリックでプロジェクト詳細ページに遷移
- 現象: クリックがタイムアウトする
- 推定原因: ボタンがクリック不可能、z-index問題、イベントハンドラー未設定

**不明/要確認の情報**: なし（調査タスクのため、実装中に判断）

---

#### タスク26.3: サイドバープロジェクト一覧の誤表示修正（Issue #3）

**説明**:
サイドバーに「プロジェクトがありません」と誤表示される問題を修正する。実際にはプロジェクトが存在するが、サイドバーコンポーネントでのプロジェクト一覧取得ロジックに問題がある。

**調査内容**:
1. `src/components/layout/Sidebar.tsx`のプロジェクト一覧取得ロジックを確認
2. APIリクエスト（/api/projects）が失敗していないか確認
3. Zustand storeからの取得ロジックに問題がないか確認
4. 条件分岐でプロジェクトが存在しないと誤判定していないか確認

**実装手順（調査→修正→テスト）**:
1. **調査**: Sidebar.tsxのプロジェクト一覧取得コードを読み取り
2. **問題特定**: プロジェクト一覧が取得できない原因を特定
   - APIリクエストのエラーハンドリング確認
   - Zustand storeのstate確認
   - 条件分岐のロジック確認
3. **修正**: 問題箇所を修正
   - APIリクエストが失敗している場合は修正
   - Zustand storeからの取得ロジックを修正
   - 条件分岐のロジックを修正
4. **テスト作成/更新**: `src/components/layout/__tests__/Sidebar.test.tsx`にテストを追加
   - プロジェクトが存在する場合、プロジェクト一覧が表示されることを確認
   - プロジェクトが存在しない場合、「プロジェクトがありません」が表示されることを確認
5. **動作確認**: サイドバーにプロジェクト一覧が正しく表示されることを確認
6. **コミット**: 修正をコミット

**受入基準**:
- [ ] Sidebar.tsxでプロジェクト一覧が正しく取得される
- [ ] `/api/projects`からのデータ取得が成功する
- [ ] Zustand storeからの取得ロジックが正しい
- [ ] プロジェクトが存在する場合、サイドバーにプロジェクト一覧が表示される
- [ ] プロジェクトが存在しない場合のみ、「プロジェクトがありません」が表示される
- [ ] `src/components/layout/__tests__/Sidebar.test.tsx`にプロジェクト一覧表示テストが追加され、通過する
- [ ] ESLintエラーがゼロである
- [ ] コミットが存在する

**依存関係**: なし

**推定工数**: 30分（AIエージェント作業時間）
- 調査・問題特定: 15分
- 修正・テスト: 10分
- 動作確認: 5分

**ステータス**: `TODO`

**情報の明確性**:

**明示された情報**:
- 対象ファイル: src/components/layout/Sidebar.tsx
- テストファイル: src/components/layout/__tests__/Sidebar.test.tsx
- API: GET /api/projects
- 要件: REQ-003（プロジェクト一覧表示）
- 期待動作: サイドバーにプロジェクト一覧が表示される
- 現象: 「プロジェクトがありません」と誤表示される
- 推定原因: APIリクエスト失敗、Zustand storeロジック問題、条件分岐の誤判定

**不明/要確認の情報**: なし（調査タスクのため、実装中に判断）

---

### Phase 26完了基準

- [ ] タスク26.1が完了している（プロジェクト一覧「開く」ボタン修正）
- [ ] タスク26.2が完了している（サイドバー「セッション」ボタン修正）
- [ ] タスク26.3が完了している（サイドバープロジェクト一覧誤表示修正）
- [ ] プロジェクト一覧ページの「開く」ボタンでプロジェクト詳細ページに遷移できる
- [ ] サイドバーの「セッション」ボタンがクリック可能でプロジェクト詳細ページに遷移する
- [ ] サイドバーにプロジェクト一覧が正しく表示される
- [ ] すべてのテストが通過している（`npm test`）
- [ ] ESLintエラーがゼロである
- [ ] すべてのコミットが作成されている

### 解決される不具合

**docs/verification-report-phase25-3.md**:
- Issue #1: プロジェクト一覧「開く」ボタンが機能しない（Medium）
- Issue #2: サイドバー「セッション」ボタンがクリックできない（Medium）
- Issue #3: サイドバーに「プロジェクトがありません」と誤表示（Low）

**docs/requirements.md**:
- REQ-003: ログイン後、システムはプロジェクト一覧ページを表示しなければならない
  - プロジェクト一覧とサイドバーのナビゲーションが正常に動作する

### 技術的な学び

- Next.js App Routerでのクライアントサイドナビゲーションのデバッグ
- イベントハンドラーのトラブルシューティング
- Zustand storeとAPI連携のデバッグ
- UIコンポーネントのクリック可能性の問題解決
- z-indexとイベント伝播の問題解決

---

## Phase 27: セッションカードクリック問題の修正

**目的**: verification-report-comprehensive-phase26.mdで発見されたIssue #1（セッションカードクリック不可）を修正し、セッション詳細ページへのナビゲーションを復旧する。

**背景**: Phase 26でUI Navigation Bugsの修正を完了後、包括的UI検証を実施した結果、セッションカードをクリックしてもセッション詳細ページに遷移しない Critical な不具合が新たに発見された。この問題により、ユーザーはセッション詳細ページにアクセスできない状態となっている。

**検証レポート**: `docs/verification-report-comprehensive-phase26.md` (Issue #1)

---

#### タスク27.1: セッションカードクリックイベントの修正とテスト追加

**説明**:
TDDアプローチでセッションカードのクリックイベント問題を修正する。`src/components/sessions/SessionCard.tsx`のクリックイベントが正常に発火しない問題を調査し、Phase 26.1のProjectCard修正と同様のアプローチで修正する。

**影響を受けるコンポーネント**:
- `src/components/sessions/SessionCard.tsx` (line 26-27)
- `src/components/sessions/SessionList.tsx` (line 37)
- `src/app/projects/[id]/page.tsx` (line 37-38)

**実装手順（TDD）**:
1. **テスト作成**: `src/components/sessions/__tests__/SessionCard.test.tsx`に以下のテストケースを追加
   - セッションカードクリック時にonClickハンドラーが呼ばれる
   - セッションカードクリック時に正しいsessionIdが渡される
   - クリックイベントが親要素に伝播しない
   - 複数のセッションカードでそれぞれクリックイベントが独立して動作する
2. **テスト実行**: すべてのテストが失敗することを確認（現在の実装ではクリックイベントが発火しない）
3. **テストコミット**: テストのみをコミット
4. **問題調査**: SessionCard.tsx:26-27のdiv要素とクリックイベントの問題を調査
   - Phase 26.1のProjectCard.tsx修正内容を参照
   - イベント伝播の問題を確認
   - 子要素によるイベント阻害を確認
5. **修正実装**: SessionCard.tsxを修正してテストを通過させる
   - イベントハンドラーに `e.stopPropagation()` を追加（必要な場合）
   - div要素をbutton要素に変更（必要な場合）
   - または、適切なイベントハンドリング方法に修正
6. **テスト実行**: すべてのテストが通過することを確認
7. **実装コミット**: 修正をコミット
8. **手動検証**: ブラウザでセッションカードクリック動作を確認
   - プロジェクト詳細ページでセッションカードをクリック
   - セッション詳細ページ（/sessions/[id]）に遷移することを確認
   - URLが正しく変更されることを確認

**受入基準**:
- [ ] `src/components/sessions/__tests__/SessionCard.test.tsx`に新しいテストケースが4つ以上追加されている
- [ ] テストのみのコミットが存在する
- [ ] `src/components/sessions/SessionCard.tsx`が修正されている
- [ ] セッションカードをクリックすると`onClick`ハンドラーが正しく呼ばれる
- [ ] クリックイベントで正しい`sessionId`が渡される
- [ ] クリックイベントが親要素に伝播しない
- [ ] すべてのテストが通過する（`npm test`）
- [ ] ESLintエラーがゼロである
- [ ] ブラウザでセッションカードクリック時にセッション詳細ページに遷移する
- [ ] 修正のコミットが存在する

**依存関係**: なし

**推定工数**: 40分（AIエージェント作業時間）
- テスト作成・コミット: 15分
- 問題調査: 10分
- 修正実装・テスト通過・コミット: 15分

**ステータス**: `TODO`

**情報の明確性**:

**明示された情報**:
- 対象ファイル: src/components/sessions/SessionCard.tsx (line 26-27)
- テストファイル: src/components/sessions/__tests__/SessionCard.test.tsx
- 検証レポート: docs/verification-report-comprehensive-phase26.md (Issue #1)
- 要件違反: REQ-013
- 症状: セッションカードクリックでセッション詳細ページに遷移しない
- 期待動作: クリック時に `/sessions/[sessionId]` に遷移する
- 参考実装: Phase 26.1のProjectCard.tsx修正（e.stopPropagation()とtype="button"追加）

**不明/要確認の情報**: なし（調査・修正タスクのため、実装中に判断）

---

### Phase 27完了基準

- [ ] タスク27.1が完了している（セッションカードクリックイベント修正）
- [ ] セッションカードをクリックするとセッション詳細ページに遷移する
- [ ] すべてのテストが通過している（`npm test`）
- [ ] ESLintエラーがゼロである
- [ ] すべてのコミットが作成されている

### 解決される不具合

**docs/verification-report-comprehensive-phase26.md**:
- Issue #1: セッションカードクリック不可（Critical）

**docs/requirements.md**:
- REQ-013: セッションが作成された時、システムはセッション一覧に新しいセッションをステータス「初期化中」で表示しなければならない
  - セッションカードのクリックでセッション詳細に遷移できる

### 技術的な学び

- React イベントハンドリングのベストプラクティス
- div要素とbutton要素のクリックイベントの違い
- イベント伝播（Event Propagation）の制御
- Phase 26.1の修正パターンの再利用

---

## Phase 28: 未検証機能の検証と性能測定

**目的**: verification-issues.mdで未検証とされている機能の動作確認と、非機能要件の性能測定を実施する。

**背景**: Phase 23-26で主要機能の実装・修正が完了したが、モバイル対応、テーマ設定、非機能要件（性能）が未検証のまま。これらの検証を実施し、問題があれば修正する。

**検証レポート**: `docs/verification-issues.md`（未検証セクション）

---

#### タスク27.1: モバイル対応の実機検証とE2Eテスト追加

**説明**:
モバイルデバイス（画面幅768px未満）でのレスポンシブデザインの動作確認を実施し、E2Eテストにモバイルビューポートテストを追加する。実装は完了しているが、実機での動作確認とテストが未実施。

**調査内容**:
1. Chrome DevToolsのデバイスモードでモバイル表示を確認
2. 実際のモバイルデバイス（iOS Safari、Android Chrome）で動作確認（可能な場合）
3. タッチ操作の動作確認
4. セッション一覧のカード形式表示確認（REQ-064）
5. ハンバーガーメニューの動作確認

**実装手順（検証→テスト追加）**:
1. **Chrome DevToolsで検証**: モバイルビューポート（375px、768px）で全画面を確認
   - ログインページ
   - プロジェクト一覧ページ
   - プロジェクト詳細ページ
   - セッション詳細ページ
   - 設定ページ
2. **問題発見**: レイアウト崩れ、操作性の問題をリストアップ
3. **修正**: 問題があれば修正
4. **E2Eテスト追加**: `e2e/mobile.spec.ts`を作成
   - モバイルビューポート（375x667、414x896）でのテスト
   - ハンバーガーメニューの開閉テスト
   - タッチ操作のシミュレーション
   - セッション一覧のカード表示テスト
5. **検証レポート作成**: `docs/verification-report-mobile.md`を作成
6. **コミット**: 修正とテストをコミット

**受入基準**:
- [ ] Chrome DevToolsでモバイルビューポート（375px、768px）での動作を確認済み
- [ ] 全画面でレイアウト崩れがない
- [ ] ハンバーガーメニューが正常に開閉する
- [ ] セッション一覧がカード形式で1列表示される（REQ-064）
- [ ] タッチ操作が正常に動作する（REQ-065）
- [ ] `e2e/mobile.spec.ts`ファイルが作成されている
- [ ] モバイルビューポートでのE2Eテストが5つ以上含まれている
- [ ] すべてのE2Eテストが通過する（`npm run e2e`）
- [ ] `docs/verification-report-mobile.md`が作成されている
- [ ] 発見された問題がすべて修正されている
- [ ] コミットが存在する

**依存関係**: Phase 26（UI Navigation Bugs修正）- ナビゲーション機能が正常に動作している必要がある

**推定工数**: 60分（AIエージェント作業時間）
- Chrome DevTools検証: 20分
- 問題修正（必要な場合）: 20分
- E2Eテスト作成: 15分
- 検証レポート作成: 5分

**ステータス**: `TODO`

**情報の明確性**:

**明示された情報**:
- 対象ファイル:
  - e2e/mobile.spec.ts（新規作成）
  - docs/verification-report-mobile.md（新規作成）
- 要件: REQ-063（モバイルレイアウト）、REQ-064（カード形式表示）、REQ-065（タッチ操作）、NFR-013（iOS Safari、Android Chrome対応）
- 検証対象画面: ログイン、プロジェクト一覧、プロジェクト詳細、セッション詳細、設定
- モバイルビューポート: 375x667（iPhone SE）、414x896（iPhone 11 Pro）
- 既存実装: SessionList.tsx（grid-cols-1）、Header.tsx（ハンバーガーメニュー）

**不明/要確認の情報**: なし（検証タスクのため、実施中に判断）

---

#### タスク27.2: テーマ設定の全画面動作確認

**説明**:
ライト/ダークモードのテーマ切り替え機能が全画面で正常に動作することを確認する。実装は完了しているが、全画面での動作確認が未実施。

**検証内容**:
1. 各画面でテーマ切り替えボタンが表示されることを確認
2. テーマ切り替え時、全要素が正しくライト/ダークモードに変更されることを確認
3. ローカルストレージへのテーマ保存を確認（REQ-068）
4. ページリロード後、保存されたテーマが適用されることを確認（REQ-069）
5. OSのテーマ設定に従った初期表示を確認（REQ-066）

**実装手順（検証→テスト追加）**:
1. **全画面で検証**: 各画面でテーマ切り替えを実施
   - ログインページ
   - プロジェクト一覧ページ
   - プロジェクト詳細ページ
   - セッション詳細ページ（各タブ）
   - 設定ページ
2. **問題発見**: テーマが適用されていない要素、色が不適切な要素をリストアップ
3. **修正**: 問題があれば修正
4. **E2Eテスト追加**: `e2e/theme.spec.ts`を作成
   - テーマ切り替えテスト
   - ローカルストレージ保存テスト
   - ページリロード後のテーマ適用テスト
   - OSテーマ設定の反映テスト
5. **検証レポート作成**: `docs/verification-report-theme.md`を作成
6. **コミット**: 修正とテストをコミット

**受入基準**:
- [ ] 全画面でテーマ切り替えボタンが表示される
- [ ] テーマ切り替え時、全要素が正しくライト/ダークモードに変更される
- [ ] テーマ選択がローカルストレージに保存される（REQ-068）
- [ ] ページリロード後、保存されたテーマが適用される（REQ-069）
- [ ] 初回アクセス時、OSのテーマ設定に従ったテーマが適用される（REQ-066）
- [ ] `e2e/theme.spec.ts`ファイルが作成されている
- [ ] テーマ関連のE2Eテストが5つ以上含まれている
- [ ] すべてのE2Eテストが通過する（`npm run e2e`）
- [ ] `docs/verification-report-theme.md`が作成されている
- [ ] 発見された問題がすべて修正されている
- [ ] コミットが存在する

**依存関係**: なし

**推定工数**: 45分（AIエージェント作業時間）
- 全画面検証: 20分
- 問題修正（必要な場合）: 10分
- E2Eテスト作成: 10分
- 検証レポート作成: 5分

**ステータス**: `TODO`

**情報の明確性**:

**明示された情報**:
- 対象ファイル:
  - e2e/theme.spec.ts（新規作成）
  - docs/verification-report-theme.md（新規作成）
- 要件: REQ-066（OS設定に従う）、REQ-067（切り替え）、REQ-068（ローカルストレージ保存）、REQ-069（保存テーマ適用）
- 検証対象画面: ログイン、プロジェクト一覧、プロジェクト詳細、セッション詳細、設定
- 既存実装: next-themes ライブラリ使用

**不明/要確認の情報**: なし（検証タスクのため、実施中に判断）

---

#### タスク27.3: 非機能要件の性能測定

**説明**:
非機能要件（NFR-001〜003）の性能要件を測定し、基準を満たしているか確認する。測定結果をレポートとして記録する。

**測定項目**:
1. **NFR-001**: Claude Code出力の表示遅延（目標: 500ms以内）
2. **NFR-002**: 並列セッション管理（目標: 10個の並列セッション）
3. **NFR-003**: APIレスポンス時間（目標: 95パーセンタイルで200ms以内）

**実装手順（測定→レポート作成）**:
1. **NFR-001測定**: Claude Code出力の表示遅延測定
   - セッション詳細ページでClaude Code出力のタイムスタンプを記録
   - WebSocket受信時刻と画面表示時刻の差分を計測
   - 10回測定して平均値と95パーセンタイルを算出
2. **NFR-002測定**: 並列セッション管理のテスト
   - 10個のセッションを同時作成
   - すべてのセッションが正常に動作することを確認
   - CPU使用率、メモリ使用率を記録
3. **NFR-003測定**: APIレスポンス時間測定
   - 主要API（/api/projects、/api/sessions/:id、/api/sessions/:id/commits）のレスポンス時間を測定
   - 各API 100回リクエストして95パーセンタイルを算出
   - Chrome DevToolsのNetworkタブまたはcurlコマンドで測定
4. **性能測定スクリプト作成**: `scripts/performance-test.ts`を作成
   - 自動化された性能測定スクリプト
5. **測定レポート作成**: `docs/performance-report.md`を作成
   - 測定結果、基準との比較、改善提案を記載
6. **コミット**: スクリプトとレポートをコミット

**受入基準**:
- [ ] NFR-001の測定を10回実施し、95パーセンタイルが500ms以内である
- [ ] NFR-002の測定で10個の並列セッションが正常に動作する
- [ ] NFR-003の測定で主要API 3つの95パーセンタイルが200ms以内である
- [ ] `scripts/performance-test.ts`ファイルが作成されている
- [ ] 性能測定スクリプトが自動実行可能である
- [ ] `docs/performance-report.md`が作成されている
- [ ] 測定結果、基準との比較、改善提案が記載されている
- [ ] 基準を満たしていない項目がある場合、改善策が提案されている
- [ ] コミットが存在する

**依存関係**: Phase 23-26（主要機能の実装・修正完了）- 機能が正常に動作している必要がある

**推定工数**: 90分（AIエージェント作業時間）
- NFR-001測定: 20分
- NFR-002測定: 20分
- NFR-003測定: 20分
- 性能測定スクリプト作成: 20分
- 測定レポート作成: 10分

**ステータス**: `TODO`

**情報の明確性**:

**明示された情報**:
- 対象ファイル:
  - scripts/performance-test.ts（新規作成）
  - docs/performance-report.md（新規作成）
- 要件: NFR-001（出力500ms以内）、NFR-002（10並列セッション）、NFR-003（APIレスポンス200ms以内）
- 測定方法:
  - NFR-001: タイムスタンプ比較（WebSocket受信〜画面表示）
  - NFR-002: 10セッション同時作成、リソース使用率測定
  - NFR-003: Chrome DevTools NetworkタブまたはNode.jsスクリプト
- 測定回数: NFR-001とNFR-003は100回、95パーセンタイル算出

**不明/要確認の情報**: なし

---

### Phase 27完了基準

- [ ] タスク27.1が完了している（モバイル対応検証）
- [ ] タスク27.2が完了している（テーマ設定検証）
- [ ] タスク27.3が完了している（性能測定）
- [ ] モバイルビューポートで全画面が正常に動作する
- [ ] テーマ切り替えが全画面で正常に動作する
- [ ] すべての非機能要件（NFR-001〜003）が基準を満たしている
- [ ] E2Eテストにモバイルテストとテーマテストが追加されている
- [ ] すべてのE2Eテストが通過している（`npm run e2e`）
- [ ] 検証レポートと性能レポートが作成されている
- [ ] すべてのコミットが作成されている

### 解決される未検証項目

**docs/verification-issues.md**:
- 未検証: モバイル対応（REQ-063〜065、NFR-013）
- 未検証: テーマ設定（全画面での動作）（REQ-066〜069）
- 未検証: 非機能要件（NFR-001〜003）

**docs/requirements.md**:
- REQ-063: 画面幅768px未満でモバイルレイアウト表示
- REQ-064: モバイル表示でセッション一覧をカード形式表示
- REQ-065: モバイル表示でタッチ操作可能
- REQ-066: 初回アクセス時、OSテーマ設定に従う
- REQ-067: テーマ切り替えボタンでライト/ダーク切り替え
- REQ-068: テーマ選択をローカルストレージに保存
- REQ-069: 再アクセス時、保存テーマを適用
- NFR-001: Claude Code出力を500ms以内に表示
- NFR-002: 10個の並列セッション管理
- NFR-003: APIレスポンス95パーセンタイルで200ms以内
- NFR-013: iOS Safari、Android Chromeで動作

### 技術的な学び

- モバイルビューポートでのE2Eテスト手法
- Chrome DevToolsでのレスポンシブデザイン検証
- テーマ切り替え機能の全画面検証手法
- WebSocketメッセージの遅延測定方法
- 並列処理の性能測定とリソース監視
- APIレスポンス時間の統計的分析（95パーセンタイル）
- 性能測定の自動化スクリプト作成

---

## Phase 28: セキュリティ強化・テストカバレッジ向上・ドキュメント更新

**目的**: CodeRabbitレビューで指摘されたセキュリティ・品質改善項目の実装、APIテストカバレッジの向上、Phase 22以降の変更を反映したドキュメント更新を実施する。

**背景**: tasks.mdの「セキュリティ・品質改善タスク」セクションに5つの改善項目が記載されているが、Phaseとして正式にタスク化されていない。また、4つの重要なAPIエンドポイントにテストが欠落している。さらに、Phase 22（Claude CLI自動検出）以降の変更がドキュメントに反映されていない。

**参照**: tasks.md「セキュリティ・品質改善タスク」セクション、CodeRabbitレビュー #3574391877

---

#### タスク28.1: パストラバーサル対策の強化とプロジェクト所有権チェック実装（High Priority）

**説明**:
プロジェクト登録APIのセキュリティを強化する。2つの高優先度セキュリティ問題を修正：(1)任意のディレクトリをプロジェクトとして登録できる問題、(2)認証済みユーザーが他人のプロジェクトを更新・削除できる問題。

**実装内容**:

**1. パストラバーサル対策**:
- 環境変数`ALLOWED_PROJECT_DIRS`を追加（カンマ区切り）
- `src/app/api/projects/route.ts`でパス検証ロジックを実装
- リクエストパスが許可ディレクトリ配下にあることを検証
- 許可外のパスの場合は403エラーを返す
- NFR-014要件を満たす実装

**2. プロジェクト所有権チェック**:
- Prismaスキーマで`Project`モデルに`owner_id`フィールドを追加
- `AuthSession`と`Project`の関連を定義
- `src/app/api/projects/[project_id]/route.ts`のPUT/DELETEハンドラーで所有権チェック実装
- プロジェクト作成時に`owner_id`を自動設定
- GET `/api/projects`は自分のプロジェクトのみ返す

**実装手順（TDD）**:
1. **テスト作成**: `src/app/api/projects/__tests__/security.test.ts`を作成
   - パストラバーサル攻撃のテスト
   - 許可ディレクトリ外のパス登録拒否テスト
   - 他人のプロジェクト更新・削除拒否テスト
   - 自分のプロジェクトのみ取得するテスト
2. **テスト実行**: すべてのテストが失敗することを確認
3. **テストコミット**: テストのみをコミット
4. **Prismaスキーマ修正**: `prisma/schema.prisma`にowner_id追加
5. **マイグレーション実行**: `npx prisma db push && npx prisma generate`
6. **パス検証実装**: `src/lib/path-validation.ts`にパス検証関数を実装
7. **API修正**: POST /api/projects、PUT/DELETE /api/projects/:idを修正
8. **ENV_VARS.md更新**: ALLOWED_PROJECT_DIRS環境変数を追記
9. **テスト通過確認**: すべてのテストが通過することを確認
10. **実装コミット**: 実装とドキュメントをコミット

**受入基準**:
- [ ] 環境変数`ALLOWED_PROJECT_DIRS`が追加されている
- [ ] `src/lib/path-validation.ts`にパス検証関数が実装されている
- [ ] 許可ディレクトリ外のパスでプロジェクト作成を試みると403エラーが返る
- [ ] 許可ディレクトリ内のパスでは正常に作成できる
- [ ] Prismaスキーマに`Project.owner_id`フィールドが追加されている
- [ ] `AuthSession`と`Project`の関連が定義されている
- [ ] 他人のプロジェクトを更新・削除しようとすると403エラーが返る
- [ ] 自分のプロジェクトは正常に更新・削除できる
- [ ] GET `/api/projects`は自分のプロジェクトのみ返す
- [ ] `src/app/api/projects/__tests__/security.test.ts`が作成され、すべてのテストが通過する
- [ ] `docs/ENV_VARS.md`にALLOWED_PROJECT_DIRS環境変数が追記されている
- [ ] ESLintエラーがゼロである
- [ ] コミットが存在する（テスト、実装）

**依存関係**: なし（最優先セキュリティ対策）

**推定工数**: 90分（AIエージェント作業時間）
- テスト作成・コミット: 25分
- Prismaスキーマ修正・マイグレーション: 15分
- パス検証実装: 20分
- API修正: 20分
- ドキュメント更新・テスト確認: 10分

**ステータス**: `TODO`

**情報の明確性**:

**明示された情報**:
- 対象ファイル:
  - src/lib/path-validation.ts（新規作成）
  - src/app/api/projects/route.ts（修正）
  - src/app/api/projects/[project_id]/route.ts（修正）
  - prisma/schema.prisma（修正）
  - src/app/api/projects/__tests__/security.test.ts（新規作成）
  - docs/ENV_VARS.md（更新）
- 環境変数: ALLOWED_PROJECT_DIRS（カンマ区切りディレクトリリスト）
- Prismaスキーマ変更: Project.owner_id追加、AuthSessionとの関連定義
- 要件: NFR-014（許可ディレクトリ配下のみ登録可能）
- CodeRabbitレビュー指摘箇所: src/app/api/projects/route.ts:124-145、src/app/api/projects/[project_id]/route.ts:53-60,132-138

**不明/要確認の情報**: なし

---

#### タスク28.2: Git操作の非同期化とプロジェクトpath重複登録防止（Medium Priority）

**説明**:
Git操作の性能改善と、プロジェクトpath重複登録の防止を実装する。2つの中優先度改善項目を対応：(1)GitServiceのspawnSyncによるイベントループブロック、(2)同一pathで複数プロジェクト登録可能な問題。

**実装内容**:

**1. Git操作の非同期化**:
- `src/services/git-service.ts`の全メソッドを非同期化
- `spawnSync`を`spawn` + Promise化に変更
- タイムアウト設定を追加（デフォルト30秒、環境変数`GIT_OPERATION_TIMEOUT`で調整可能）
- `src/app/api/projects/route.ts`を`async/await`に対応

**2. プロジェクトpath重複登録の防止**:
- Prismaスキーマで`Project.path`フィールドに`@unique`制約を追加
- POST `/api/projects`でUniqueConstraintErrorをハンドリング（409 Conflict）
- NFR-015要件を満たす実装

**実装手順（TDD）**:
1. **テスト作成**: `src/services/__tests__/git-service.async.test.ts`を作成
   - Git操作の非同期実行テスト
   - タイムアウトテスト
   - エラーハンドリングテスト
2. **テスト作成**: `src/app/api/projects/__tests__/duplicate-path.test.ts`を作成
   - 同一pathで2回目の登録を試みると409エラーを返すテスト
3. **テスト実行**: すべてのテストが失敗することを確認
4. **テストコミット**: テストのみをコミット
5. **GitService非同期化**: `spawn` + Promise化に変更
6. **タイムアウト実装**: execWithTimeout関数を実装
7. **Prismaスキーマ修正**: `Project.path`に`@unique`制約追加
8. **マイグレーション実行**: `npx prisma db push && npx prisma generate`
9. **API修正**: POST /api/projectsでUniqueConstraintErrorハンドリング
10. **ENV_VARS.md更新**: GIT_OPERATION_TIMEOUT環境変数を追記
11. **テスト通過確認**: すべてのテストが通過することを確認
12. **実装コミット**: 実装とドキュメントをコミット

**受入基準**:
- [ ] `src/services/git-service.ts`の全メソッドが非同期化されている
- [ ] `spawn` + Promise化でノンブロッキング実行されている
- [ ] タイムアウト設定が実装されている（デフォルト30秒）
- [ ] 環境変数`GIT_OPERATION_TIMEOUT`でタイムアウトを調整できる
- [ ] タイムアウト時にエラーが返される
- [ ] Prismaスキーマで`Project.path`に`@unique`制約が追加されている
- [ ] 同一pathで2回目の登録を試みると409 Conflictエラーが返る
- [ ] エラーメッセージが「このパスは既に登録されています」である（NFR-015）
- [ ] `src/services/__tests__/git-service.async.test.ts`が作成され、すべてのテストが通過する
- [ ] `src/app/api/projects/__tests__/duplicate-path.test.ts`が作成され、すべてのテストが通過する
- [ ] 既存のGitServiceテストが全て通る
- [ ] `docs/ENV_VARS.md`にGIT_OPERATION_TIMEOUT環境変数が追記されている
- [ ] ESLintエラーがゼロである
- [ ] コミットが存在する（テスト、実装）

**依存関係**: なし

**推定工数**: 90分（AIエージェント作業時間）
- テスト作成・コミット: 25分
- GitService非同期化: 30分
- Prismaスキーマ修正・マイグレーション: 10分
- API修正: 15分
- ドキュメント更新・テスト確認: 10分

**ステータス**: `TODO`

**情報の明確性**:

**明示された情報**:
- 対象ファイル:
  - src/services/git-service.ts（修正）
  - src/app/api/projects/route.ts（修正）
  - prisma/schema.prisma（修正）
  - src/services/__tests__/git-service.async.test.ts（新規作成）
  - src/app/api/projects/__tests__/duplicate-path.test.ts（新規作成）
  - docs/ENV_VARS.md（更新）
- 環境変数: GIT_OPERATION_TIMEOUT（デフォルト: 30秒）
- Prismaスキーマ変更: Project.path @unique制約追加
- 要件: NFR-015（同一path重複登録時409エラー）
- CodeRabbitレビュー指摘箇所: src/app/api/projects/route.ts:127-136、src/services/git-service.ts

**不明/要確認の情報**: なし

---

#### タスク28.3: APIテストカバレッジ向上とログ機密情報対策

**説明**:
テストが欠落している4つの重要なAPIエンドポイントにテストを追加し、ログ出力の機密情報対策を実施する。

**実装内容**:

**1. APIテストカバレッジ向上**:
以下の4つのAPIエンドポイントにテストを追加：
- `src/app/api/auth/session/route.ts` - 認証セッション確認API
- `src/app/api/sessions/[id]/approve/route.ts` - 権限承認API
- `src/app/api/sessions/[id]/input/route.ts` - ユーザー入力送信API
- `src/app/api/sessions/[id]/messages/route.ts` - メッセージ取得API

**2. ログ出力の機密情報対策**:
- `src/app/api/sessions/[id]/merge/route.ts`のcommitMessageログ出力を制限
- 先頭80文字のみログ出力、全体の文字数も記録

**実装手順（TDD）**:
1. **テスト作成**: 以下の4つのテストファイルを作成
   - `src/app/api/auth/session/__tests__/route.test.ts`
   - `src/app/api/sessions/[id]/approve/__tests__/route.test.ts`
   - `src/app/api/sessions/[id]/input/__tests__/route.test.ts`
   - `src/app/api/sessions/[id]/messages/__tests__/route.test.ts`
2. **テスト実行**: すべてのテストが通過することを確認（実装済みのため）
3. **ログ修正**: `src/app/api/sessions/[id]/merge/route.ts`のログ出力を修正
4. **ログテスト作成**: `src/app/api/sessions/[id]/merge/__tests__/logging.test.ts`を作成
5. **テスト通過確認**: すべてのテストが通過することを確認
6. **コミット**: テストとログ修正をコミット

**受入基準**:
- [ ] `src/app/api/auth/session/__tests__/route.test.ts`が作成されている
  - [ ] 認証済みセッション確認のテスト
  - [ ] 未認証セッション確認のテスト
  - [ ] 有効期限切れセッション確認のテスト
- [ ] `src/app/api/sessions/[id]/approve/__tests__/route.test.ts`が作成されている
  - [ ] 権限承認テスト
  - [ ] 権限拒否テスト
- [ ] `src/app/api/sessions/[id]/input/__tests__/route.test.ts`が作成されている
  - [ ] ユーザー入力送信テスト
  - [ ] 無効なセッションIDでの入力送信拒否テスト
- [ ] `src/app/api/sessions/[id]/messages/__tests__/route.test.ts`が作成されている
  - [ ] メッセージ一覧取得テスト
  - [ ] ページネーションテスト
- [ ] すべてのテストが通過する（`npm test`）
- [ ] `src/app/api/sessions/[id]/merge/route.ts`のログ出力がcommitMessagePreview（先頭80文字）とcommitMessageLengthを記録している
- [ ] `src/app/api/sessions/[id]/merge/__tests__/logging.test.ts`が作成され、ログ出力を検証している
- [ ] ESLintエラーがゼロである
- [ ] コミットが存在する

**依存関係**: なし

**推定工数**: 75分（AIエージェント作業時間）
- 認証セッションAPIテスト作成: 15分
- 権限承認APIテスト作成: 15分
- ユーザー入力APIテスト作成: 15分
- メッセージ取得APIテスト作成: 15分
- ログ修正とテスト作成: 10分
- テスト確認: 5分

**ステータス**: `TODO`

**情報の明確性**:

**明示された情報**:
- 対象ファイル:
  - src/app/api/auth/session/__tests__/route.test.ts（新規作成）
  - src/app/api/sessions/[id]/approve/__tests__/route.test.ts（新規作成）
  - src/app/api/sessions/[id]/input/__tests__/route.test.ts（新規作成）
  - src/app/api/sessions/[id]/messages/__tests__/route.test.ts（新規作成）
  - src/app/api/sessions/[id]/merge/route.ts（修正）
  - src/app/api/sessions/[id]/merge/__tests__/logging.test.ts（新規作成）
- ログ出力制限: commitMessageを先頭80文字に制限
- CodeRabbitレビュー指摘箇所: src/app/api/sessions/[id]/merge/route.ts:103-109

**不明/要確認の情報**: なし

---

#### タスク28.4: ドキュメント更新（Phase 22以降の変更反映）

**説明**:
Phase 22（Claude CLI自動検出）、Phase 23-26（認証修正、UIコンポーネント実装）の変更を`docs/API.md`、`docs/ENV_VARS.md`、`docs/SETUP.md`に反映する。

**更新内容**:

**1. docs/ENV_VARS.md更新**:
- `CLAUDE_CODE_PATH`の説明を更新（自動検出機能の追加、Phase 22）
- Phase 22で追加された環境変数検出ロジックの説明
- タスク28.1で追加する`ALLOWED_PROJECT_DIRS`を追記
- タスク28.2で追加する`GIT_OPERATION_TIMEOUT`を追記

**2. docs/SETUP.md更新**:
- Claude CLI自動検出機能の説明を追加（Phase 22）
- `CLAUDE_CODE_PATH`環境変数が不要になったことを明記
- macOS/Linux環境でのセットアップ手順を簡略化

**3. docs/API.md更新**:
- Phase 23-26で追加・修正されたAPIエンドポイントを反映
- 新規UIコンポーネント（GitStatusBadge、PromptHistoryDropdown、CommitHistory、ScriptLogViewer）のAPI連携を追記
- 認証関連のAPI説明を更新（Phase 23）

**実装手順**:
1. **ENV_VARS.md更新**:
   - CLAUDE_CODE_PATHセクションを更新
   - ALLOWED_PROJECT_DIRSセクションを追加
   - GIT_OPERATION_TIMEOUTセクションを追加
2. **SETUP.md更新**:
   - セットアップ手順からCLAUDE_CODE_PATH設定を削除（オプション扱い）
   - Claude CLI自動検出の説明を追加
3. **API.md更新**:
   - Phase 23-26で変更されたAPIエンドポイントをリストアップ
   - 各エンドポイントの説明、リクエスト/レスポンス例を更新
4. **検証**: ドキュメント内容が正確で、矛盾がないことを確認
5. **コミット**: ドキュメント更新をコミット

**受入基準**:
- [ ] `docs/ENV_VARS.md`が更新されている
  - [ ] CLAUDE_CODE_PATHに自動検出機能の説明が追加されている
  - [ ] ALLOWED_PROJECT_DIRSの説明が追加されている
  - [ ] GIT_OPERATION_TIMEOUTの説明が追加されている
- [ ] `docs/SETUP.md`が更新されている
  - [ ] Claude CLI自動検出機能の説明が追加されている
  - [ ] CLAUDE_CODE_PATH環境変数がオプション扱いになっている
- [ ] `docs/API.md`が更新されている
  - [ ] Phase 23-26で追加・修正されたAPIエンドポイントが反映されている
  - [ ] 認証関連APIの説明が更新されている
- [ ] ドキュメント内容に矛盾がない
- [ ] マークダウンフォーマットが正しい
- [ ] コミットが存在する

**依存関係**: タスク28.1、28.2（環境変数追加）

**推定工数**: 45分（AIエージェント作業時間）
- ENV_VARS.md更新: 15分
- SETUP.md更新: 10分
- API.md更新: 15分
- 検証: 5分

**ステータス**: `TODO`

**情報の明確性**:

**明示された情報**:
- 対象ファイル:
  - docs/ENV_VARS.md（更新）
  - docs/SETUP.md（更新）
  - docs/API.md（更新）
- 反映する変更:
  - Phase 22: Claude CLI自動検出機能
  - Phase 23: 認証修正
  - Phase 24: GitStatusBadge、PromptHistoryDropdown、CommitHistory、ScriptLogViewer実装
  - Phase 28.1: ALLOWED_PROJECT_DIRS環境変数
  - Phase 28.2: GIT_OPERATION_TIMEOUT環境変数

**不明/要確認の情報**: なし

---

### Phase 28完了基準

- [ ] タスク28.1が完了している（パストラバーサル対策と所有権チェック）
- [ ] タスク28.2が完了している（Git操作非同期化とpath重複防止）
- [ ] タスク28.3が完了している（APIテストカバレッジ向上とログ対策）
- [ ] タスク28.4が完了している（ドキュメント更新）
- [ ] パストラバーサル攻撃が防止されている
- [ ] プロジェクト所有権チェックが実装されている
- [ ] Git操作が非同期化されている
- [ ] プロジェクトpath重複登録が防止されている
- [ ] 4つの重要なAPIエンドポイントにテストが追加されている
- [ ] ログ出力の機密情報対策が実施されている
- [ ] Phase 22以降の変更が全ドキュメントに反映されている
- [ ] すべてのテストが通過している（`npm test`）
- [ ] ESLintエラーがゼロである
- [ ] すべてのコミットが作成されている

### 解決される問題

**tasks.md「セキュリティ・品質改善タスク」セクション**:
- パストラバーサル対策の強化（優先度：高）
- Git操作の非同期化とタイムアウト設定（優先度：中）
- プロジェクトpath重複登録の防止（優先度：中）
- プロジェクト所有権チェックの実装（優先度：高）
- ログ出力の機密情報対策（優先度：低）

**APIテストカバレッジ不足**:
- `/api/auth/session`のテスト欠落
- `/api/sessions/:id/approve`のテスト欠落
- `/api/sessions/:id/input`のテスト欠落
- `/api/sessions/:id/messages`のテスト欠落

**ドキュメント更新不足**:
- docs/ENV_VARS.md（Phase 22以降の変更未反映）
- docs/SETUP.md（Phase 22以降の変更未反映）
- docs/API.md（Phase 23-26の変更未反映）

**docs/requirements.md**:
- NFR-014: ALLOWED_PROJECT_DIRS設定時、指定ディレクトリ配下のみ登録許可
- NFR-015: 既登録パスでプロジェクト追加時409エラーと明確なメッセージ

### 技術的な学び

- パストラバーサル攻撃の防止パターン
- プロジェクト所有権チェックの実装（マルチユーザー対応）
- Node.js child_processの非同期化とタイムアウト実装
- Prisma unique制約の追加とエラーハンドリング
- APIエンドポイントのテストカバレッジ向上手法
- ログ出力の機密情報対策
- ドキュメントの継続的更新プロセス
