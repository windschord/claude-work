# ローカルGitリポジトリブラウザ - タスク管理書

## 概要

このドキュメントは、ローカルGitリポジトリブラウザ機能の実装タスクを管理します。

---

## フェーズ1: バックエンド基盤

### タスク1.1: FilesystemService の実装

**説明**:
- 新規ファイル: `src/services/filesystem-service.ts`
- ディレクトリ一覧取得、Gitリポジトリ判定、パス検証を実装

**技術的文脈**:
- `fs/promises` を使用した非同期ファイルシステム操作
- `os.homedir()` でホームディレクトリを取得
- `path.resolve()` でパスを正規化しセキュリティチェック

**TDD手順**:
1. テストファイル作成: `src/services/__tests__/filesystem-service.test.ts`
2. テストケース:
   - `listDirectory`: 正常系（ディレクトリ一覧取得）
   - `listDirectory`: ホームディレクトリ外へのアクセス拒否
   - `listDirectory`: 存在しないパスでエラー
   - `isGitRepository`: .git ディレクトリが存在する場合 true
   - `isGitRepository`: .git がない場合 false
   - `isPathAllowed`: ホームディレクトリ内は true
   - `isPathAllowed`: ホームディレクトリ外は false
3. 実装

**受入基準**:
- [ ] `listDirectory()` がディレクトリエントリを返す
- [ ] `isGitRepository()` が正しく判定する
- [ ] ホームディレクトリ外へのアクセスが拒否される
- [ ] すべてのテストが通過する

**依存関係**: なし
**推定工数**: 30分
**ステータス**: `TODO`

---

### タスク1.2: ブランチ取得機能の実装

**説明**:
- `FilesystemService` に `getGitBranches()` と `getCurrentBranch()` を追加
- Git コマンドを実行してブランチ情報を取得

**技術的文脈**:
- `child_process.exec` または `simple-git` ライブラリを使用
- `git branch --list` でローカルブランチ一覧
- `git rev-parse --abbrev-ref HEAD` で現在のブランチ

**TDD手順**:
1. テストケース追加:
   - `getGitBranches`: ブランチ一覧を取得
   - `getGitBranches`: Gitリポジトリでない場合エラー
   - `getCurrentBranch`: 現在のブランチ名を取得
2. 実装

**受入基準**:
- [ ] `getGitBranches()` がブランチ一覧を返す
- [ ] `getCurrentBranch()` が現在のブランチを返す
- [ ] Gitリポジトリでない場合は適切なエラー

**依存関係**: タスク1.1
**推定工数**: 20分
**ステータス**: `TODO`

---

### タスク1.3: ファイルシステムAPI の実装

**説明**:
- 新規ファイル: `src/app/api/filesystem/browse/route.ts`
- 新規ファイル: `src/app/api/filesystem/branches/route.ts`

**技術的文脈**:
- Next.js App Router の API Route
- FilesystemService を使用
- クエリパラメータで path を受け取る

**TDD手順**:
1. テストファイル作成: `src/app/api/filesystem/__tests__/browse.test.ts`
2. テストケース:
   - GET /api/filesystem/browse: 正常系
   - GET /api/filesystem/browse?path=...: パス指定
   - GET /api/filesystem/browse: アクセス拒否のパスで403
   - GET /api/filesystem/branches: 正常系
   - GET /api/filesystem/branches: Gitリポジトリでない場合400
3. 実装

**受入基準**:
- [ ] GET /api/filesystem/browse が正常に動作
- [ ] GET /api/filesystem/branches が正常に動作
- [ ] セキュリティチェックが機能する
- [ ] エラーレスポンスが適切

**依存関係**: タスク1.1, タスク1.2
**推定工数**: 25分
**ステータス**: `TODO`

---

## フェーズ2: データモデル拡張

### タスク2.1: Session スキーマの更新

**説明**:
- `prisma/schema.prisma` に `localPath` フィールドを追加
- マイグレーション実行

**技術的文脈**:
- SQLite では `npx prisma db push` でスキーマ反映
- `localPath` は nullable（リモートURL使用時は null）

**実装手順**:
1. スキーマ更新
2. `npx prisma db push`
3. `npx prisma generate`

**受入基準**:
- [ ] `localPath` フィールドが追加されている
- [ ] 既存データに影響がない
- [ ] Prisma Client が正しく生成される

**依存関係**: なし
**推定工数**: 10分
**ステータス**: `TODO`

---

### タスク2.2: 型定義の更新

**説明**:
- `src/types/docker-session.ts` を更新
- `CreateDockerSessionRequest` に `sourceType` と `localPath` を追加

**技術的文脈**:
- TypeScript の union type でソースタイプを表現
- 既存の `repoUrl` は `sourceType: 'remote'` の場合のみ必須

**受入基準**:
- [ ] `CreateDockerSessionRequest` が拡張されている
- [ ] 型チェックが正しく機能する

**依存関係**: タスク2.1
**推定工数**: 10分
**ステータス**: `TODO`

---

## フェーズ3: ContainerManager 拡張

### タスク3.1: ローカルマウント対応

**説明**:
- `src/services/container-manager.ts` を拡張
- ローカルディレクトリをマウントしてコンテナを作成する機能

**技術的文脈**:
- Docker の bind mount を使用
- `HostConfig.Binds` に `localPath:/workspace:rw` を設定
- git clone 処理をスキップ

**TDD手順**:
1. テストケース追加（モック使用）:
   - ローカルパスでコンテナ作成
   - マウント設定の検証
2. 実装

**受入基準**:
- [ ] ローカルパスをマウントしてコンテナを作成できる
- [ ] git clone 処理がスキップされる
- [ ] 既存のリモートURL機能に影響がない

**依存関係**: タスク2.2
**推定工数**: 30分
**ステータス**: `TODO`

---

### タスク3.2: SessionManager 拡張

**説明**:
- `src/services/session-manager.ts` を拡張
- ローカルリポジトリからのセッション作成対応

**技術的文脈**:
- `sourceType` に基づいて処理を分岐
- ローカルの場合は `localPath` をDBに保存

**受入基準**:
- [ ] ローカルリポジトリでセッションを作成できる
- [ ] DBに `localPath` が保存される
- [ ] 既存機能に影響がない

**依存関係**: タスク3.1
**推定工数**: 20分
**ステータス**: `TODO`

---

## フェーズ4: フロントエンド実装

### タスク4.1: SourceTypeTabs コンポーネント

**説明**:
- 新規ファイル: `src/components/docker-sessions/SourceTypeTabs.tsx`
- リモート/ローカルの切り替えタブUI

**技術的文脈**:
- Headless UI の `TabGroup` を使用
- コンパクトなデザイン（モーダル内に収まる）

**TDD手順**:
1. テストファイル作成
2. テストケース:
   - 初期状態で「リモート」が選択されている
   - クリックで切り替わる
   - `onChange` が呼ばれる
3. 実装

**受入基準**:
- [ ] タブUIが表示される
- [ ] クリックで切り替わる
- [ ] アクセシビリティ対応

**依存関係**: なし
**推定工数**: 20分
**ステータス**: `TODO`

---

### タスク4.2: DirectoryBrowser コンポーネント

**説明**:
- 新規ファイル: `src/components/docker-sessions/DirectoryBrowser.tsx`
- ディレクトリ一覧表示とナビゲーション

**技術的文脈**:
- `/api/filesystem/browse` を使用
- フォルダアイコン、Gitリポジトリアイコンを区別
- パンくずリストで現在位置を表示

**TDD手順**:
1. テストファイル作成
2. テストケース:
   - 初期状態でホームディレクトリを表示
   - ディレクトリクリックでサブディレクトリに移動
   - Gitリポジトリをダブルクリックで選択
   - パンくずリストのクリックで移動
3. 実装

**受入基準**:
- [ ] ディレクトリ一覧が表示される
- [ ] ナビゲーションが機能する
- [ ] Gitリポジトリが視覚的に区別される
- [ ] ローディング/エラー状態が表示される

**依存関係**: タスク1.3
**推定工数**: 45分
**ステータス**: `TODO`

---

### タスク4.3: LocalRepoForm コンポーネント

**説明**:
- 新規ファイル: `src/components/docker-sessions/LocalRepoForm.tsx`
- ローカルリポジトリ選択時のフォーム

**技術的文脈**:
- セッション名入力
- リポジトリパス表示 + Browse ボタン
- ブランチ選択（ドロップダウン）

**TDD手順**:
1. テストファイル作成
2. テストケース:
   - 初期状態のフォーム表示
   - Browse ボタンクリックでブラウザを開く
   - リポジトリ選択後にブランチ一覧を取得
   - フォーム送信
3. 実装

**受入基準**:
- [ ] フォームが正しく表示される
- [ ] DirectoryBrowser と連携する
- [ ] ブランチ選択が機能する
- [ ] バリデーションが機能する

**依存関係**: タスク4.2
**推定工数**: 35分
**ステータス**: `TODO`

---

### タスク4.4: CreateSessionModal の統合

**説明**:
- `src/components/docker-sessions/CreateSessionModal.tsx` を更新
- SourceTypeTabs を追加し、フォームを切り替え

**技術的文脈**:
- 既存のフォームを `RemoteUrlForm` としてラップ
- `LocalRepoForm` との切り替え
- 共通のsubmit処理

**受入基準**:
- [ ] タブ切り替えが機能する
- [ ] リモートURL入力が動作する（既存機能）
- [ ] ローカルリポジトリ選択が動作する
- [ ] モーダルのレイアウトが崩れない

**依存関係**: タスク4.1, タスク4.3
**推定工数**: 30分
**ステータス**: `TODO`

---

## フェーズ5: API更新

### タスク5.1: セッション作成APIの更新

**説明**:
- `src/app/api/sessions/route.ts` を更新
- `sourceType` に基づいた処理分岐

**技術的文脈**:
- リクエストボディのバリデーション拡張
- ローカルパスの検証（存在確認、Gitリポジトリ確認）

**TDD手順**:
1. テストケース追加:
   - ローカルリポジトリでのセッション作成
   - 存在しないパスでエラー
   - Gitリポジトリでないパスでエラー
2. 実装

**受入基準**:
- [ ] ローカルリポジトリでセッション作成できる
- [ ] 適切なエラーハンドリング
- [ ] 既存機能に影響がない

**依存関係**: タスク3.2
**推定工数**: 25分
**ステータス**: `TODO`

---

## フェーズ6: テスト・統合

### タスク6.1: E2Eテストの追加

**説明**:
- `e2e/local-repo.spec.ts` を追加
- ローカルリポジトリ選択フローのE2Eテスト

**技術的文脈**:
- Playwright を使用
- テスト用のGitリポジトリを事前準備

**受入基準**:
- [ ] ローカルタブの選択テスト
- [ ] ディレクトリブラウザのナビゲーションテスト
- [ ] セッション作成の統合テスト

**依存関係**: タスク5.1
**推定工数**: 30分
**ステータス**: `TODO`

---

## 進捗サマリー

| フェーズ | タスク数 | 完了 | 進行中 | 残り |
|---------|----------|------|--------|------|
| 1. バックエンド基盤 | 3 | 0 | 0 | 3 |
| 2. データモデル拡張 | 2 | 0 | 0 | 2 |
| 3. ContainerManager拡張 | 2 | 0 | 0 | 2 |
| 4. フロントエンド実装 | 4 | 0 | 0 | 4 |
| 5. API更新 | 1 | 0 | 0 | 1 |
| 6. テスト・統合 | 1 | 0 | 0 | 1 |
| **合計** | **13** | **0** | **0** | **13** |
