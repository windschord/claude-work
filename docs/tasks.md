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

## Phase 30: E2Eテスト環境変数修正

### 概要

Phase 29の包括的UI検証で発見されたPlaywrightテストの環境変数不一致問題を修正します。

### 背景

検証レポート（docs/verification-report-phase29.md）で以下の問題が発見されました：

1. `playwright.config.ts`で`AUTH_TOKEN`を使用しているが、アプリは`CLAUDE_WORK_TOKEN`を期待
2. `e2e/login.spec.ts`も`AUTH_TOKEN`を参照している
3. これによりE2Eテストのログイン後リダイレクトが失敗する

### タスク一覧

| タスクID | タイトル | 依存関係 | 推定工数 | ステータス |
|----------|----------|----------|----------|------------|
| 30.1 | playwright.config.ts環境変数修正 | なし | 10分 | `TODO` |
| 30.2 | e2eテストファイルのトークン参照修正 | 30.1 | 15分 | `TODO` |

---

#### タスク30.1: playwright.config.ts環境変数修正

**説明**:
`playwright.config.ts`の環境変数設定で`AUTH_TOKEN`を`CLAUDE_WORK_TOKEN`に変更します。

**対象ファイル**: `playwright.config.ts`

**現在の実装**:
```typescript
env: {
  AUTH_TOKEN: process.env.AUTH_TOKEN || 'test-token',
  SESSION_SECRET: process.env.SESSION_SECRET || 'test-session-secret-key-for-e2e-testing-purposes-only',
  PORT: '3001',
},
```

**修正後**:
```typescript
env: {
  CLAUDE_WORK_TOKEN: process.env.CLAUDE_WORK_TOKEN || 'test-token',
  SESSION_SECRET: process.env.SESSION_SECRET || 'test-session-secret-key-for-e2e-testing-purposes-only',
  PORT: '3001',
},
```

**受入基準**:
- [ ] `playwright.config.ts`で`AUTH_TOKEN`が`CLAUDE_WORK_TOKEN`に変更されている
- [ ] ESLintエラーがゼロである
- [ ] コミットが存在する

**依存関係**: なし

**推定工数**: 10分（AIエージェント作業時間）

**ステータス**: `TODO`

**情報の明確性**:

**明示された情報**:
- 対象ファイル: playwright.config.ts
- 変更内容: AUTH_TOKEN → CLAUDE_WORK_TOKEN
- アプリケーションが期待する環境変数名: CLAUDE_WORK_TOKEN（.env, server.ts参照）

**不明/要確認の情報**: なし

---

#### タスク30.2: e2eテストファイルのトークン参照修正

**説明**:
E2Eテストファイル内の`AUTH_TOKEN`参照を`CLAUDE_WORK_TOKEN`に修正します。

**対象ファイル**:
- `e2e/login.spec.ts`
- その他`AUTH_TOKEN`を参照しているE2Eテストファイル

**現在の実装**（e2e/login.spec.ts）:
```typescript
const token = process.env.AUTH_TOKEN || 'test-token';
```

**修正後**:
```typescript
const token = process.env.CLAUDE_WORK_TOKEN || 'test-token';
```

**受入基準**:
- [ ] すべてのE2Eテストファイルで`AUTH_TOKEN`が`CLAUDE_WORK_TOKEN`に変更されている
- [ ] E2Eテストが正常に動作する（`npm run e2e`）
- [ ] ESLintエラーがゼロである
- [ ] コミットが存在する

**依存関係**: タスク30.1（playwright.config.ts修正）が完了していること

**推定工数**: 15分（AIエージェント作業時間）
- ファイル検索: 5分
- 修正: 5分
- テスト実行確認: 5分

**ステータス**: `TODO`

**情報の明確性**:

**明示された情報**:
- 主要な対象ファイル: e2e/login.spec.ts
- 変更内容: process.env.AUTH_TOKEN → process.env.CLAUDE_WORK_TOKEN
- テスト実行コマンド: npm run e2e

**不明/要確認の情報**: なし

---

### Phase 30完了基準

- [ ] タスク30.1が完了している（playwright.config.ts修正）
- [ ] タスク30.2が完了している（E2Eテストファイル修正）
- [ ] E2Eテストが正常に実行できる
- [ ] ESLintエラーがゼロである
- [ ] すべてのコミットが作成されている

### 解決される不具合

**docs/verification-report-phase29.md**:
- Issue #1: Playwrightテスト環境変数不一致（Medium）
- Issue #2: e2e/login.spec.tsのトークン取得（Medium）

### 技術的な学び

- 環境変数の命名一貫性の重要性
- E2Eテスト設定とアプリケーション設定の整合性確認

---

## Phase 31: 既存セッションのClaude Codeプロセス再起動機能

**目的**: サーバー再起動後も既存セッションでClaude Codeと対話できるようにする

**背景**:
- Claude Codeプロセスはセッション作成時のみProcessManager.startClaudeCode()で起動される
- サーバー再起動後、既存セッションにアクセスしてもプロセスは自動的には再起動されない
- プロセスがないセッションにメッセージを送信しても何も起きない（エラーも出ない）
- ユーザーは既存セッションで作業を継続したいが、現状それができない

**技術的制約**:
- ProcessManager.startClaudeCode(sessionId, worktreePath, model)を使用してプロセスを起動
- セッションのworktree_pathとproject情報はDBから取得可能
- WebSocket接続経由でメッセージを送受信
- SessionWebSocketHandlerでプロセス状態を管理

**検証レポート**: なし（新規機能）

---

### タスク31.1: プロセス状態確認APIの実装（TDD）

**説明**:
セッションのClaude Codeプロセスが実行中かどうかを確認するAPIエンドポイントを実装する。

**実装手順（TDD）**:
1. **テスト作成**: `src/app/api/sessions/[id]/process/__tests__/route.test.ts`にテストケースを作成
   - プロセスが実行中の場合、`{ running: true }`を返す
   - プロセスが停止中の場合、`{ running: false }`を返す
   - 認証されていない場合、401エラーを返す
   - セッションが存在しない場合、404エラーを返す
2. **テスト実行**: すべてのテストが失敗することを確認
3. **テストコミット**: テストのみをコミット
4. **実装**: `src/app/api/sessions/[id]/process/route.ts`を作成
   - GET: ProcessManager.hasProcess(sessionId)でプロセス状態を確認
   - 認証チェック（getIronSession）
   - セッション存在チェック（prisma.session.findUnique）
5. **テスト通過確認**: すべてのテストが通過することを確認
6. **実装コミット**: 実装をコミット

**技術的文脈**:
- ProcessManagerにhasProcess(sessionId)メソッドを追加する必要がある
- 既存のProcessManager.processes Mapを参照

**受入基準**:
- [ ] `src/app/api/sessions/[id]/process/route.ts`ファイルが作成されている
- [ ] GET `/api/sessions/:id/process`がプロセス状態を返す
- [ ] ProcessManager.hasProcess(sessionId)メソッドが実装されている
- [ ] 認証チェックが実装されている
- [ ] テストがすべて通過する
- [ ] ESLintエラーがゼロである
- [ ] 2つのコミット（テスト、実装）が存在する

**依存関係**: なし

**推定工数**: 30分（AIエージェント作業時間）
- テスト作成・コミット: 15分
- 実装・テスト通過・コミット: 15分

**ステータス**: `DONE`

**情報の明確性**:

**明示された情報**:
- 対象ファイル: src/app/api/sessions/[id]/process/route.ts（新規作成）
- ProcessManager: src/services/process-manager.ts
- 認証: src/lib/auth.ts (getIronSession)
- レスポンス形式: `{ running: boolean }`

**不明/要確認の情報**: なし

---

### タスク31.2: プロセス再起動APIの実装（TDD）

**説明**:
停止中のセッションのClaude Codeプロセスを再起動するAPIエンドポイントを実装する。

**実装手順（TDD）**:
1. **テスト作成**: `src/app/api/sessions/[id]/process/__tests__/route.test.ts`にPOSTのテストケースを追加
   - プロセスが正常に起動した場合、`{ success: true, running: true }`を返す
   - 既にプロセスが実行中の場合、`{ success: true, running: true, message: 'Process already running' }`を返す
   - 起動に失敗した場合、500エラーを返す
   - 認証されていない場合、401エラーを返す
   - セッションが存在しない場合、404エラーを返す
2. **テスト実行**: すべてのテストが失敗することを確認
3. **テストコミット**: テストのみをコミット
4. **実装**: `src/app/api/sessions/[id]/process/route.ts`にPOSTハンドラーを追加
   - 認証チェック
   - セッション取得（worktree_path, projectのdefault_model）
   - ProcessManager.hasProcess()でプロセス状態確認
   - 停止中の場合、ProcessManager.startClaudeCode()で起動
   - 結果を返す
5. **テスト通過確認**: すべてのテストが通過することを確認
6. **実装コミット**: 実装をコミット

**技術的文脈**:
- ProcessManager.startClaudeCode(sessionId, worktreePath, model)を使用
- セッションのworktree_pathとproject.default_modelをDBから取得
- 既にプロセスが実行中の場合は再起動せず成功を返す

**受入基準**:
- [ ] POST `/api/sessions/:id/process`でプロセスを起動できる
- [ ] セッションのworktree_pathを使用してプロセスが起動される
- [ ] 既にプロセスが実行中の場合、エラーにならず成功を返す
- [ ] 起動失敗時、適切なエラーメッセージを返す
- [ ] テストがすべて通過する
- [ ] ESLintエラーがゼロである
- [ ] 2つのコミット（テスト、実装）が存在する

**依存関係**: タスク31.1（プロセス状態確認API）

**推定工数**: 30分（AIエージェント作業時間）
- テスト作成・コミット: 15分
- 実装・テスト通過・コミット: 15分

**ステータス**: `DONE`

**情報の明確性**:

**明示された情報**:
- 対象ファイル: src/app/api/sessions/[id]/process/route.ts
- ProcessManager.startClaudeCode(sessionId, worktreePath, model)
- セッションスキーマ: worktree_path, project関連

**不明/要確認の情報**: なし

---

### タスク31.3: プロセス状態表示コンポーネントの実装（TDD）

**説明**:
セッション詳細ページにClaude Codeプロセスの状態を表示し、再起動ボタンを提供するコンポーネントを実装する。

**実装手順（TDD）**:
1. **テスト作成**: `src/components/sessions/__tests__/ProcessStatus.test.tsx`にテストケースを作成
   - プロセスが実行中の場合、緑のバッジと「実行中」を表示
   - プロセスが停止中の場合、赤のバッジと「停止」、「再起動」ボタンを表示
   - 再起動ボタンクリックでonRestart()コールバックが呼ばれる
   - ローディング中の表示
2. **テスト実行**: すべてのテストが失敗することを確認
3. **テストコミット**: テストのみをコミット
4. **実装**: `src/components/sessions/ProcessStatus.tsx`を作成
   - Props: `running: boolean`, `loading: boolean`, `onRestart: () => void`
   - 実行中: 緑のバッジ + 「実行中」テキスト
   - 停止中: 赤のバッジ + 「停止」テキスト + 「再起動」ボタン
   - ローディング: スピナー表示
   - Tailwind CSSでスタイリング
5. **テスト通過確認**: すべてのテストが通過することを確認
6. **実装コミット**: 実装をコミット

**技術的文脈**:
- スタイリング: Tailwind CSS
- アイコン: Lucide React（PlayCircle, StopCircle等）
- 再起動ボタンは停止中のみ表示

**受入基準**:
- [ ] `src/components/sessions/ProcessStatus.tsx`ファイルが作成されている
- [ ] プロセス実行中は緑のバッジと「実行中」が表示される
- [ ] プロセス停止中は赤のバッジと「停止」が表示される
- [ ] 停止中のみ「再起動」ボタンが表示される
- [ ] 再起動ボタンクリックでonRestart()が呼ばれる
- [ ] ローディング中はスピナーが表示される
- [ ] テストがすべて通過する
- [ ] ESLintエラーがゼロである
- [ ] 2つのコミット（テスト、実装）が存在する

**依存関係**: なし

**推定工数**: 25分（AIエージェント作業時間）
- テスト作成・コミット: 10分
- 実装・テスト通過・コミット: 15分

**ステータス**: `DONE`

**情報の明確性**:

**明示された情報**:
- 対象ファイル: src/components/sessions/ProcessStatus.tsx（新規作成）
- Props: running, loading, onRestart
- スタイリング: Tailwind CSS
- アイコン: Lucide React

**不明/要確認の情報**: なし

---

### タスク31.4: セッション詳細ページへのプロセス状態統合

**説明**:
セッション詳細ページ（`src/app/sessions/[id]/page.tsx`）にProcessStatusコンポーネントを統合し、プロセス状態確認と再起動機能を実装する。

**実装手順**:
1. **状態管理追加**: useStateでprocessRunning, processLoadingを管理
2. **プロセス状態確認ロジック追加**:
   - useEffectでマウント時にGET `/api/sessions/:id/process`を呼び出し
   - WebSocket接続確立時にもプロセス状態を確認
3. **再起動ハンドラー実装**:
   - POST `/api/sessions/:id/process`を呼び出し
   - 成功時、processRunningをtrueに更新
   - 失敗時、トースト通知でエラーメッセージ表示
4. **ProcessStatusコンポーネント配置**:
   - ヘッダーエリアまたはメッセージ入力欄の上に配置
   - running, loading, onRestartをpropsとして渡す
5. **メッセージ送信時のエラーハンドリング**:
   - プロセスが停止中の場合、送信を阻止してエラーメッセージ表示
   - 「プロセスを再起動してください」と案内
6. **動作確認**: サーバー再起動後、既存セッションでプロセス再起動が機能することを確認
7. **コミット**: 実装をコミット

**技術的文脈**:
- 既存のuseWebSocketフックとの連携
- トースト通知: react-hot-toast（既存使用）
- fetch APIでAPIを呼び出し

**受入基準**:
- [ ] セッション詳細ページにProcessStatusコンポーネントが表示される
- [ ] ページ読み込み時にプロセス状態が確認される
- [ ] プロセスが停止中の場合、再起動ボタンが表示される
- [ ] 再起動ボタンクリックでプロセスが起動される
- [ ] プロセス起動成功後、状態が「実行中」に更新される
- [ ] プロセス起動失敗時、エラートーストが表示される
- [ ] プロセス停止中にメッセージ送信すると、エラーメッセージが表示される
- [ ] ESLintエラーがゼロである
- [ ] コミットが存在する

**依存関係**:
- タスク31.1（プロセス状態確認API）
- タスク31.2（プロセス再起動API）
- タスク31.3（ProcessStatusコンポーネント）

**推定工数**: 40分（AIエージェント作業時間）
- 状態管理・ロジック実装: 25分
- 動作確認・コミット: 15分

**ステータス**: `DONE`

**情報の明確性**:

**明示された情報**:
- 対象ファイル: src/app/sessions/[id]/page.tsx
- API: GET/POST /api/sessions/:id/process
- コンポーネント: ProcessStatus
- トースト: react-hot-toast

**不明/要確認の情報**: なし

---

### タスク31.5: WebSocketメッセージ送信時のプロセス確認

**説明**:
サーバーサイドのSessionWebSocketHandlerでメッセージ送信時にプロセスの存在を確認し、存在しない場合はエラーメッセージを返す。

**実装手順**:
1. **調査**: `src/lib/websocket/session-ws.ts`のメッセージハンドリングを確認
2. **実装**:
   - `input`メッセージ受信時、ProcessManager.hasProcess(sessionId)を確認
   - プロセスが存在しない場合、エラーメッセージを返す
   - `{ type: 'error', message: 'Claude Code process is not running. Please restart the process.' }`
3. **クライアント対応**: useWebSocket.tsでerrorメッセージを処理
   - エラーメッセージをトースト通知で表示
4. **テスト追加**: WebSocketハンドラーのテストにプロセス未存在ケースを追加
5. **コミット**: 実装をコミット

**技術的文脈**:
- SessionWebSocketHandler: src/lib/websocket/session-ws.ts
- ProcessManager.sendInput()はプロセスが存在しない場合何もしない（現状）
- エラーメッセージはWebSocket経由でクライアントに送信

**受入基準**:
- [ ] メッセージ送信時にプロセスの存在が確認される
- [ ] プロセスが存在しない場合、errorメッセージがクライアントに送信される
- [ ] クライアントでエラーメッセージがトースト通知で表示される
- [ ] テストが追加され、すべて通過する
- [ ] ESLintエラーがゼロである
- [ ] コミットが存在する

**依存関係**: タスク31.1（hasProcessメソッド）

**推定工数**: 25分（AIエージェント作業時間）
- サーバーサイド実装: 15分
- クライアント対応・テスト: 10分

**ステータス**: `DONE`

**情報の明確性**:

**明示された情報**:
- 対象ファイル:
  - src/lib/websocket/session-ws.ts（サーバー）
  - src/hooks/useWebSocket.ts（クライアント）
- エラーメッセージ形式: `{ type: 'error', message: '...' }`

**不明/要確認の情報**: なし

---

### Phase 31完了基準

- [x] タスク31.1が完了している（プロセス状態確認API）
- [x] タスク31.2が完了している（プロセス再起動API）
- [x] タスク31.3が完了している（ProcessStatusコンポーネント）
- [x] タスク31.4が完了している（セッション詳細ページ統合）
- [x] タスク31.5が完了している（WebSocketエラーハンドリング）
- [x] セッション詳細ページでプロセス状態が表示される
- [x] プロセスが停止中の場合、再起動ボタンで起動できる
- [x] プロセス停止中のメッセージ送信でエラーが表示される
- [x] すべてのテストが通過している（`npm test`）
- [x] ESLintエラーがゼロである
- [x] すべてのコミットが作成されている

### 解決される要件

**docs/requirements.md**:
- REQ-077: セッション詳細ページを表示した時、システムはClaude Codeプロセスの状態をUIで表示しなければならない
- REQ-078: Claude Codeプロセスが停止している場合、システムは「プロセス再起動」ボタンを表示しなければならない
- REQ-079: ユーザーが「プロセス再起動」ボタンをクリックした時、システムはClaude Codeプロセスを起動しなければならない
- REQ-080: プロセスが正常に起動した時、システムはプロセス状態表示を「実行中」に更新しなければならない
- REQ-081: プロセスの起動に失敗した場合、システムはエラーメッセージをユーザーに表示しなければならない
- REQ-082: メッセージ送信時にプロセスが停止している場合、システムはエラーメッセージを表示しなければならない
- REQ-083: WebSocket接続確立時、システムはプロセス状態を自動的に確認しなければならない

### 技術的な学び

- ProcessManagerでのプロセス状態管理
- WebSocketとREST APIの連携パターン
- リアルタイム状態同期のベストプラクティス
- エラーハンドリングとユーザーフィードバック

---

## Phase 33: プロセス再起動とDiff表示の不具合修正

**目的**: Phase 32の総合検証で発見されたBUG-001（プロセス再起動失敗）とBUG-002（Diff表示不具合）を修正する

**関連する検証レポート**: docs/verification-report-phase32.md

### タスク33.1: プロセス再起動時の空プロンプト問題修正（BUG-001）

**説明**:
プロセス再起動APIが空のプロンプト（`prompt: ''`）でClaude Codeを起動するため、Claude Codeが入力待ちのまま即座に終了する問題を修正する。

**現象**:
- プロセス再起動ボタンをクリック → 「プロセスを起動しました」トースト表示
- プロセス状態が「実行中」に変わる
- しかしメッセージ送信時に「Claude Codeプロセスが実行されていません」エラー

**原因**:
`src/app/api/sessions/[id]/process/route.ts:154`で空のプロンプトを渡している：
```typescript
await processManager.startClaudeCode({
  sessionId: targetSession.id,
  worktreePath: targetSession.worktree_path,
  prompt: '', // 空のプロンプトで起動 → 即座に終了
  model: targetSession.model || undefined,
});
```

**影響を受ける要件**:
- REQ-079: プロセス再起動
- REQ-080: プロセス状態更新
- REQ-021: メッセージ送信

**実装手順（TDD）**:

1. **テスト作成**: `src/app/api/sessions/[id]/process/__tests__/route.test.ts`
   - プロセス再起動後、プロセスが継続して実行中であることを確認するテスト
   - プロセス再起動後、メッセージ送信が可能であることを確認するテスト

2. **テスト実行**: テストが失敗することを確認

3. **テストコミット**: テストのみをコミット

4. **実装案の検討**:
   - 案A: `--print`オプションなしでインタラクティブモードで起動（複雑：出力パース変更が必要）
   - 案B: promptをオプショナルにし、未指定時はstdinへの書き込みをスキップ（推奨：最もシンプル）
   - 案C: ダミープロンプト（例: "waiting for input"）で起動（不要な処理が発生）

5. **実装**: 案Bを採用 - promptをオプショナルにし、空の場合はstdin書き込みをスキップ

6. **実装コミット**: すべてのテストが通過したらコミット

**技術的文脈**:
- ProcessManager: src/services/process-manager.ts
- プロセス再起動API: src/app/api/sessions/[id]/process/route.ts
- Claude Code CLIは`--print`オプション時、stdinからの入力を待つ

**受入基準**:
- [ ] テストファイルが存在する
- [ ] プロセス再起動後、プロセスが継続して実行中である
- [ ] プロセス再起動後、メッセージ送信が可能である
- [ ] すべてのテストが通過する（`npm test`）
- [ ] ESLintエラーがゼロである
- [ ] コミットが存在する

**依存関係**: なし

**推定工数**: 45分（AIエージェント作業時間）
- テスト作成・コミット: 15分
- 調査・実装案検討: 15分
- 実装・テスト通過・コミット: 15分

**ステータス**: `DONE`

**情報の明確性**:

**明示された情報**:
- 原因箇所: src/app/api/sessions/[id]/process/route.ts:154
- 問題: 空プロンプトでの起動

**不明/要確認の情報**:
- Claude Codeの`--print`モードでプロセスを維持する正しい方法
- インタラクティブモードでの起動が適切かどうか

---

### タスク33.2: Diff表示の読み込み中フリーズ問題修正（BUG-002）

**説明**:
セッション詳細画面のDiffタブで「差分を読み込み中...」と表示されたまま止まる問題を修正する。

**現象**:
- Diffタブをクリック → 「差分を読み込み中...」表示
- ファイルリストも差分ビューワーも読み込み中のまま止まる
- ページリロード後も同様

**サーバーログ分析**:
```text
07:38:00 [info]: Got diff for session { id: "58df9ef1-4409-4e95-87f4-ce2c726b528c" }
```
サーバー側では正常にデータ取得完了している。

**原因推測**:
- フロントエンドの状態管理に問題がある可能性
- Zustandストアの更新がUIに反映されていない可能性
- APIレスポンスの形式がフロントエンドの期待と異なる可能性

**影響を受ける要件**:
- REQ-044: Diff表示
- REQ-045: 追加行/削除行のハイライト
- REQ-046: ファイル選択でのdiff表示
- REQ-047: ファイル一覧サイドバー

**実装手順（TDD）**:

1. **調査**: ブラウザのコンソールログを確認し、エラーの有無を調べる
   - 確認項目: ネットワークタブでAPI応答を確認
   - 確認項目: `fetchDiff`のPromiseがresolve/rejectしているか
   - 確認項目: ストアの`diff`プロパティが設定されているか

2. **テスト作成**: `src/store/__tests__/diff-store.test.ts`または関連するテストファイル
   - APIレスポンスが正しくストアに格納されるテスト
   - ストア更新がUIコンポーネントに反映されるテスト

3. **テスト実行**: テストが失敗することを確認

4. **テストコミット**: テストのみをコミット

5. **デバッグ**:
   - `src/store/index.ts`の`fetchDiff`関数を確認
   - APIレスポンス形式: `{ diff: { files: [], totalAdditions, totalDeletions } }`
   - ストアが期待する形式: 同上（`data.diff`をそのまま設定）
   - 問題発見: エラー時/例外時にローディング状態がリセットされない

6. **実装**: 問題箇所を修正
   - `isDiffLoading`と`diffError`状態を追加
   - ローディング開始時に`isDiffLoading: true`を設定
   - 成功/失敗時に`isDiffLoading: false`を設定
   - エラー時は`diffError`にメッセージを設定

7. **実装コミット**: すべてのテストが通過したらコミット

**技術的文脈**:
- Diffストア: src/store/index.ts
- Diff取得API: src/app/api/sessions/[id]/diff/route.ts
- Diffコンポーネント: src/components/git/DiffViewer.tsx

**受入基準**:
- [ ] テストファイルが存在する
- [ ] Diffタブでファイル一覧が表示される
- [ ] ファイルを選択するとdiff内容が表示される
- [ ] 追加行/削除行が正しくハイライトされる
- [ ] すべてのテストが通過する（`npm test`）
- [ ] ESLintエラーがゼロである
- [ ] コミットが存在する

**依存関係**: なし

**推定工数**: 40分（AIエージェント作業時間）
- 調査・原因特定: 15分
- テスト作成・コミット: 10分
- 実装・テスト通過・コミット: 15分

**ステータス**: `DONE`

**情報の明確性**:

**明示された情報**:
- サーバー側は正常動作（ログ確認済み）
- フロントエンドで問題発生

**不明/要確認の情報**:
- ブラウザコンソールのエラー内容
- APIレスポンスの正確な形式
- Zustandストアの実際の状態

---

### Phase 33完了基準

- [x] タスク33.1が完了している（プロセス再起動修正）
- [x] タスク33.2が完了している（Diff表示修正）
- [x] プロセス再起動後にメッセージ送信が可能である
- [x] Diffタブでファイル一覧と差分が表示される
- [x] すべてのテストが通過している（`npm test`）
- [x] ESLintエラーがゼロである
- [x] すべてのコミットが作成されている

### 解決される要件

**docs/requirements.md**:
- REQ-021: メッセージ送信（BUG-001修正により完全動作）
- REQ-044: Diff表示
- REQ-045: 追加行/削除行のハイライト
- REQ-046: ファイル選択でのdiff表示
- REQ-047: ファイル一覧サイドバー
- REQ-079: プロセス再起動（BUG-001修正）
- REQ-080: プロセス状態更新（BUG-001修正）

### 技術的な学び

- Claude Code CLIの`--print`モードの動作特性
- Zustandストアのデバッグ手法
- APIレスポンスとフロントエンド状態の整合性確認

---

## Phase 34: ブラウザ通知システム

**目的**: Claude Codeのイベント発生時にブラウザ通知を送信する機能を実装する

**対応要件**: REQ-084 〜 REQ-093

**技術的文脈**:
- フレームワーク: Next.js 15 (App Router)
- 状態管理: Zustand
- toast通知: react-hot-toast（既存）
- OS通知: Web Notifications API

---

### タスク34.1: 通知サービスの実装

**説明**:
`src/lib/notification-service.ts`にブラウザ通知の基盤を実装する

**実装手順（TDD）**:
1. テスト作成: `src/lib/__tests__/notification-service.test.ts`にテストケースを作成
   - 通知許可リクエストのテスト
   - イベント別通知設定の有効/無効テスト
   - タブのアクティブ/バックグラウンド状態でのルーティングテスト
   - ローカルストレージへの設定保存/読込テスト
2. テスト実行: すべてのテストが失敗することを確認
3. テストコミット: テストのみをコミット
4. 実装: `notification-service.ts`を実装してテストを通過させる
5. 実装コミット: すべてのテストが通過したらコミット

**ファイル構成**:
```text
src/lib/notification-service.ts
src/lib/__tests__/notification-service.test.ts
```

**実装詳細**:
```typescript
// src/lib/notification-service.ts
export type NotificationEventType = 'taskComplete' | 'permissionRequest' | 'error';

export interface NotificationSettings {
  onTaskComplete: boolean;
  onPermissionRequest: boolean;
  onError: boolean;
}

export interface NotificationEvent {
  type: NotificationEventType;
  sessionId: string;
  sessionName: string;
  message?: string;
}

const STORAGE_KEY = 'claudework:notification-settings';

const DEFAULT_SETTINGS: NotificationSettings = {
  onTaskComplete: true,
  onPermissionRequest: true,
  onError: true,
};

export function getSettings(): NotificationSettings;
export function saveSettings(settings: NotificationSettings): void;
export function requestPermission(): Promise<NotificationPermission>;
export function sendNotification(event: NotificationEvent): void;
export function isTabActive(): boolean;

// ヘルパー関数の実装例
function getSettingKey(type: NotificationEventType): keyof NotificationSettings {
  switch (type) {
    case 'taskComplete': return 'onTaskComplete';
    case 'permissionRequest': return 'onPermissionRequest';
    case 'error': return 'onError';
  }
}

function getDefaultMessage(type: NotificationEventType): string {
  switch (type) {
    case 'taskComplete': return 'タスクが完了しました';
    case 'permissionRequest': return '権限確認が必要です';
    case 'error': return 'エラーが発生しました';
  }
}

function getTitle(event: NotificationEvent): string {
  switch (event.type) {
    case 'taskComplete': return `タスク完了: ${event.sessionName}`;
    case 'permissionRequest': return `アクション要求: ${event.sessionName}`;
    case 'error': return `エラー発生: ${event.sessionName}`;
  }
}

// sendNotification の通知ルーティングロジック
function sendNotification(event: NotificationEvent): void {
  const settings = getSettings();
  const settingKey = getSettingKey(event.type);  // 'onTaskComplete' | 'onPermissionRequest' | 'onError'
  if (!settings[settingKey]) return;

  const message = event.message || getDefaultMessage(event.type);
  const fullMessage = `${event.sessionName}: ${message}`;

  if (isTabActive()) {
    // タブがアクティブ → react-hot-toast で表示
    if (event.type === 'error') {
      toast.error(fullMessage);
    } else {
      toast.success(fullMessage);
    }
  } else {
    // タブがバックグラウンド → OS通知（Notification API）
    if (Notification.permission === 'granted') {
      const title = getTitle(event);  // 例: 'タスク完了: session-1'
      const body = event.message || getDefaultMessage(event.type);
      new Notification(title, { body, icon: '/icon.png', tag: `claudework-${event.sessionId}` });
    }
  }
}
```

**受入基準**:
- [ ] テストファイル`src/lib/__tests__/notification-service.test.ts`が存在する
- [ ] テストが8つ以上含まれている
- [ ] 実装前にテストのみのコミットが存在する
- [ ] `src/lib/notification-service.ts`が実装されている
- [ ] `getSettings()`がローカルストレージから設定を読み込む
- [ ] `saveSettings()`が設定をローカルストレージに保存する
- [ ] `requestPermission()`がNotification.requestPermission()を呼び出す
- [ ] `sendNotification()`がタブ状態に応じてtoast/OS通知を送信する
- [ ] すべてのテストが通過する（`npm test`）
- [ ] ESLintエラーがゼロである

**依存関係**: なし
**推定工数**: 45分（AIエージェント作業時間）
**ステータス**: `TODO`

---

### タスク34.2: 通知ストアの実装

**説明**:
`src/store/notification.ts`にZustandストアを実装する

**実装手順（TDD）**:
1. テスト作成: `src/store/__tests__/notification.test.ts`にテストケースを作成
2. テスト実行: すべてのテストが失敗することを確認
3. テストコミット: テストのみをコミット
4. 実装: `notification.ts`を実装してテストを通過させる
5. 実装コミット: すべてのテストが通過したらコミット

**ファイル構成**:
```text
src/store/notification.ts
src/store/__tests__/notification.test.ts
```

**実装詳細**:
```typescript
// src/store/notification.ts
import { create } from 'zustand';
import {
  NotificationSettings,
  getSettings,
  saveSettings,
  requestPermission as requestPermissionService,
} from '@/lib/notification-service';

interface NotificationState {
  permission: NotificationPermission;
  settings: NotificationSettings;
  requestPermission: () => Promise<void>;
  updateSettings: (settings: Partial<NotificationSettings>) => void;
  initializeFromStorage: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  permission: typeof window !== 'undefined' ? Notification.permission : 'default',
  settings: getSettings(),
  requestPermission: async () => {
    const result = await requestPermissionService();
    set({ permission: result });
  },
  updateSettings: (newSettings) => {
    set((state) => {
      const updated = { ...state.settings, ...newSettings };
      saveSettings(updated);
      return { settings: updated };
    });
  },
  initializeFromStorage: () => {
    set({ settings: getSettings() });
  },
}));
```

**注意**: `initializeFromStorage()`の呼び出しについて:
- **呼び出し場所**: `src/components/common/NotificationSettings.tsx`
- **タイミング**: コンポーネントのマウント時に`useEffect`内で1回呼び出す
- **目的**: ローカルストレージから設定を読み込み、UIと同期する
- **補足**: ストアの初期化時（`getSettings()`）にも読み込むため、実際には冗長だが、
  他のタブでの設定変更を反映するためにマウント時にも呼び出す
```typescript
// NotificationSettings.tsx での呼び出し例
const { initializeFromStorage } = useNotificationStore();
useEffect(() => { initializeFromStorage(); }, [initializeFromStorage]);
```

**受入基準**:
- [ ] テストファイル`src/store/__tests__/notification.test.ts`が存在する
- [ ] テストが5つ以上含まれている
- [ ] 実装前にテストのみのコミットが存在する
- [ ] `src/store/notification.ts`が実装されている
- [ ] `useNotificationStore`がエクスポートされている
- [ ] `requestPermission`アクションが許可状態を更新する
- [ ] `updateSettings`アクションが設定を更新しローカルストレージに保存する
- [ ] すべてのテストが通過する（`npm test`）
- [ ] ESLintエラーがゼロである

**依存関係**: タスク34.1
**推定工数**: 30分（AIエージェント作業時間）
**ステータス**: `TODO`

---

### タスク34.3: WebSocketメッセージハンドラへの通知統合

**説明**:
`src/store/index.ts`の`handleWebSocketMessage`に通知トリガーを追加する

**実装手順**:
1. `src/store/index.ts`を修正
2. `status_change`メッセージで`completed`または`error`の場合に通知を送信
3. `permission_request`メッセージで通知を送信
4. 既存のテストを更新

**実装詳細**:
```typescript
// src/store/index.ts の handleWebSocketMessage 内に追加
import { sendNotification } from '@/lib/notification-service';

// status_change ハンドラ内
if (message.type === 'status_change') {
  if (message.status === 'completed') {
    sendNotification({
      type: 'taskComplete',
      sessionId: currentSession?.id || '',
      sessionName: currentSession?.name || '',
    });
  } else if (message.status === 'error') {
    sendNotification({
      type: 'error',
      sessionId: currentSession?.id || '',
      sessionName: currentSession?.name || '',
      message: 'プロセスがエラーで終了しました',
    });
  }
}

// permission_request ハンドラ内
if (message.type === 'permission_request') {
  sendNotification({
    type: 'permissionRequest',
    sessionId: currentSession?.id || '',
    sessionName: currentSession?.name || '',
    message: message.permission?.action,
  });
}
```

**受入基準**:
- [ ] `handleWebSocketMessage`が`status_change`で`completed`時に通知を送信する
- [ ] `handleWebSocketMessage`が`status_change`で`error`時に通知を送信する
- [ ] `handleWebSocketMessage`が`permission_request`時に通知を送信する
- [ ] 既存のテストが通過する
- [ ] ESLintエラーがゼロである

**依存関係**: タスク34.1, タスク34.2
**推定工数**: 20分（AIエージェント作業時間）
**ステータス**: `TODO`

---

### タスク34.4: 通知許可リクエストの自動実行

**説明**:
セッションページ初回アクセス時に通知許可をリクエストする

**実装手順**:
1. `src/app/sessions/[id]/page.tsx`を修正
2. useEffectで初回レンダリング時に許可リクエストを実行
3. 許可状態が`default`の場合のみリクエスト

**実装詳細**:
```typescript
// src/app/sessions/[id]/page.tsx
import { useNotificationStore } from '@/store/notification';

// コンポーネント内
const { permission, requestPermission } = useNotificationStore();

useEffect(() => {
  if (permission === 'default') {
    // 非同期処理だがawaitは不要（結果はストアに保存される）
    requestPermission();
  }
}, [permission, requestPermission]);
// 依存配列の解説:
// - permission: ストアから取得した現在の許可状態。変化を検知してエフェクトを再実行する。
// - requestPermission: Zustandのアクションは安定（毎回同じ参照）なので無限ループにはならない。
//   ESLintのexhaustive-depsルールに従い含める。
// - sessionId: 含めない。通知許可はブラウザ全体で1回のみリクエストすればよく、
//   セッション変更時に再リクエストは不要。
```

**受入基準**:
- [ ] セッションページ初回アクセス時に通知許可ダイアログが表示される
- [ ] 許可/拒否後、再度ダイアログは表示されない
- [ ] 許可状態がZustandストアに保存される
- [ ] ESLintエラーがゼロである

**依存関係**: タスク34.2
**推定工数**: 15分（AIエージェント作業時間）
**ステータス**: `TODO`

---

### タスク34.5: 通知設定UIの実装

**説明**:
ヘッダーに通知設定ドロップダウンを追加する

**実装手順（TDD）**:
1. テスト作成: `src/components/common/__tests__/NotificationSettings.test.tsx`
2. テスト実行: すべてのテストが失敗することを確認
3. テストコミット: テストのみをコミット
4. 実装: `src/components/common/NotificationSettings.tsx`を実装
5. ヘッダーコンポーネント（`src/components/layout/Header.tsx`）にNotificationSettingsを追加
   - ThemeToggleの左側に配置
   - `import { NotificationSettings } from '@/components/common/NotificationSettings';`
6. 実装コミット: すべてのテストが通過したらコミット

**レイアウト**:
- 配置: ヘッダー右側、ThemeToggleの左隣
- ドロップダウン: `absolute right-0`で右寄せ、`w-64`（256px）
- レスポンシブ:
  - モバイル（375px以下）: ドロップダウンは`right-0`で右端固定、画面内に収まる
  - 特別な調整は不要（ドロップダウン幅256px < 375px）

**ファイル構成**:
```text
src/components/common/NotificationSettings.tsx
src/components/common/__tests__/NotificationSettings.test.tsx
```

**実装詳細**:
```typescript
// src/components/common/NotificationSettings.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { useNotificationStore } from '@/store/notification';

export function NotificationSettings() {
  const [isOpen, setIsOpen] = useState(false);
  const { permission, settings, updateSettings } = useNotificationStore();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ドロップダウン外クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
        aria-label="通知設定"
      >
        {permission === 'granted' ? (
          <Bell className="w-5 h-5" />
        ) : (
          <BellOff className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border dark:border-gray-700 p-4">
          <h3 className="font-medium mb-3">通知設定</h3>

          <label className="flex items-center justify-between py-2">
            <span className="text-sm">タスク完了</span>
            <input
              type="checkbox"
              checked={settings.onTaskComplete}
              onChange={(e) => updateSettings({ onTaskComplete: e.target.checked })}
              className="rounded"
            />
          </label>

          <label className="flex items-center justify-between py-2">
            <span className="text-sm">権限要求</span>
            <input
              type="checkbox"
              checked={settings.onPermissionRequest}
              onChange={(e) => updateSettings({ onPermissionRequest: e.target.checked })}
              className="rounded"
            />
          </label>

          <label className="flex items-center justify-between py-2">
            <span className="text-sm">エラー発生</span>
            <input
              type="checkbox"
              checked={settings.onError}
              onChange={(e) => updateSettings({ onError: e.target.checked })}
              className="rounded"
            />
          </label>

          {permission === 'denied' && (
            <p className="text-xs text-red-500 mt-2">
              ブラウザの通知がブロックされています
            </p>
          )}
        </div>
      )}
    </div>
  );
}
```

**受入基準**:
- [ ] テストファイル`src/components/common/__tests__/NotificationSettings.test.tsx`が存在する
- [ ] テストが5つ以上含まれている
- [ ] 実装前にテストのみのコミットが存在する
- [ ] `src/components/common/NotificationSettings.tsx`が実装されている
- [ ] `src/components/layout/Header.tsx`にNotificationSettingsがインポート・配置されている
- [ ] ヘッダーに通知アイコンが表示される（ThemeToggleの左隣）
- [ ] クリックで設定ドロップダウンが開く
- [ ] ドロップダウン外クリックで閉じる
- [ ] チェックボックスで各イベントの通知をオン/オフできる
- [ ] 設定変更が即座にローカルストレージに保存される
- [ ] 通知がブロックされている場合に警告が表示される
- [ ] すべてのテストが通過する（`npm test`）
- [ ] ESLintエラーがゼロである

**依存関係**: タスク34.2
**推定工数**: 40分（AIエージェント作業時間）
**ステータス**: `TODO`

---

### タスク34.6: OS通知クリック時のフォーカス処理

**説明**:
OS通知をクリックした時に該当セッションのタブにフォーカスする

**実装手順**:
1. `src/lib/notification-service.ts`の`sendNotification`を修正
2. `Notification`オブジェクトの`onclick`ハンドラを設定
3. `window.focus()`と`location.href`でセッションページに遷移

**実装詳細**:
```typescript
// src/lib/notification-service.ts の sendNotification 内
function showOSNotification(event: NotificationEvent): void {
  const notification = new Notification(getTitle(event), {
    body: event.message || getDefaultBody(event),
    icon: '/icon.png',
    tag: `claudework-${event.sessionId}`,
  });

  notification.onclick = () => {
    window.focus();
    window.location.href = `/sessions/${event.sessionId}`;
    notification.close();
  };
}

function getTitle(event: NotificationEvent): string {
  switch (event.type) {
    case 'taskComplete':
      return `タスク完了: ${event.sessionName}`;
    case 'permissionRequest':
      return `アクション要求: ${event.sessionName}`;
    case 'error':
      return `エラー発生: ${event.sessionName}`;
  }
}
```

**受入基準**:
- [ ] OS通知クリック時にウィンドウがフォーカスされる
- [ ] OS通知クリック時に該当セッションページに遷移する
- [ ] 通知が自動的に閉じる
- [ ] ESLintエラーがゼロである

**依存関係**: タスク34.1
**推定工数**: 15分（AIエージェント作業時間）
**ステータス**: `TODO`

---

### Phase 34完了基準

- [ ] タスク34.1が完了している（通知サービス）
- [ ] タスク34.2が完了している（通知ストア）
- [ ] タスク34.3が完了している（WebSocketハンドラ統合）
- [ ] タスク34.4が完了している（許可リクエスト自動実行）
- [ ] タスク34.5が完了している（設定UI）
- [ ] タスク34.6が完了している（通知クリックフォーカス）
- [ ] タスク完了時にOS通知が送信される
- [ ] 権限要求時にOS通知が送信される
- [ ] エラー発生時にOS通知が送信される
- [ ] タブがアクティブな場合はtoast通知が表示される
- [ ] 通知設定UIで各イベントのオン/オフが可能
- [ ] 設定がローカルストレージに永続化される
- [ ] すべてのテストが通過している（`npm test`）
- [ ] ESLintエラーがゼロである
- [ ] すべてのコミットが作成されている

### 解決される要件

**docs/requirements.md**:
- REQ-084: 初回アクセス時の通知許可要求
- REQ-085: タスク完了時のOS通知
- REQ-086: 権限要求時のOS通知
- REQ-087: エラー発生時のOS通知
- REQ-088: アクティブタブでのtoast通知
- REQ-089: バックグラウンドタブでのOS通知
- REQ-090: 通知クリック時のフォーカス
- REQ-091: 通知設定のローカルストレージ保存
- REQ-092: 設定変更の即時適用
- REQ-093: イベント別オン/オフ設定
