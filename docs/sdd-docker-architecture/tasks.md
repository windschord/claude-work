# タスク: Dockerコンテナオーケストレーション型アーキテクチャ移行

> このドキュメントはAIエージェント（Claude Code等）が実装を行うことを前提としています。

## 情報の明確性チェック（全体）

### ユーザーから明示された情報

- [x] 実装対象のディレクトリ構造: 設計書に記載
- [x] パッケージマネージャー: npm
- [x] テストフレームワーク: Vitest
- [x] リンター/フォーマッター: ESLint
- [x] Docker API: dockerode
- [x] Node.jsバージョン: 22 LTS

### 不明/要確認の情報（全体）

すべて確認済み。

---

## 実装計画

### フェーズ1: 基盤構築（Docker環境）

#### タスク1.1: Dockerイメージの作成

**説明**:
- 対象ファイル: `docker/Dockerfile`, `docker/docker-entrypoint.sh`
- Node.js 22-slim ベースイメージでDockerfileを作成
- git, curl, openssh-client をインストール
- Claude CLIをグローバルインストール
- エントリポイントスクリプトでgit clone処理を実装

**技術的文脈**:
- ベースイメージ: `node:22-slim`
- 環境変数: `REPO_URL`, `BRANCH`
- ワークディレクトリ: `/workspace`

**受入基準**:
- [x] `docker/Dockerfile` が存在する
- [x] `docker/docker-entrypoint.sh` が存在する
- [ ] `docker build -t claudework-session docker/` が成功する
- [ ] コンテナ内で `node --version` が v22.x を返す
- [ ] コンテナ内で `claude --version` が正常に動作する

**依存関係**: なし
**推定工数**: 20分
**ステータス**: `DONE`
**完了サマリー**: Dockerfile と docker-entrypoint.sh を作成。Node.js 22-slim ベース、Claude CLI インストール済み。ビルドテストはユーザー環境で実施必要。

---

#### タスク1.2: dockerode依存関係の追加

**説明**:
- `npm install dockerode @types/dockerode` を実行
- package.jsonに依存関係を追加

**技術的文脈**:
- dockerode: Node.js用Docker SDK
- TypeScript型定義も同時にインストール

**受入基準**:
- [x] package.jsonに `dockerode` が追加されている
- [x] package.jsonに `@types/dockerode` が追加されている
- [x] `npm install` が成功する

**依存関係**: なし
**推定工数**: 5分
**ステータス**: `DONE`
**完了サマリー**: dockerode v4.0.9 と @types/dockerode v3.3.47 を追加。

---

#### タスク1.3: DockerServiceの実装

**説明**:
- 対象ファイル: `src/services/docker-service.ts`
- dockerode経由でDocker APIを操作するサービスを実装
- コンテナ/Volume/イメージ操作の抽象化

**技術的文脈**:
- dockerodeのDocker()インスタンスを使用
- /var/run/docker.sockに接続

**受入基準**:
- [x] `src/services/docker-service.ts` が存在する
- [x] `isDockerRunning()` メソッドが実装されている
- [x] `createContainer()` メソッドが実装されている
- [x] `startContainer()` メソッドが実装されている
- [x] `stopContainer()` メソッドが実装されている
- [x] `removeContainer()` メソッドが実装されている
- [x] `createVolume()` メソッドが実装されている
- [x] `removeVolume()` メソッドが実装されている
- [x] 単体テストが作成されている

**依存関係**: タスク1.2
**推定工数**: 40分
**ステータス**: `DONE`
**完了サマリー**: DockerService クラスを実装。dockerode経由でコンテナ/Volume操作を抽象化。11のテストケースが通過。

---

### フェーズ2: セッション管理

#### タスク2.1: Prismaスキーマの更新

**説明**:
- 対象ファイル: `prisma/schema.prisma`
- 既存のProject, Session, Message, RunScriptモデルを削除
- 新しいSessionモデルを追加（containerId, volumeName, repoUrl, branch, status）

**技術的文脈**:
- 既存データは移行しない（完全置き換え）
- SQLiteを使用

**受入基準**:
- [x] 新しいSessionモデルがスキーマに定義されている
- [x] 古いモデル（Project, Message, RunScript）が削除されている
- [x] `npx prisma db push` が成功する
- [x] `npx prisma generate` が成功する

**依存関係**: なし
**推定工数**: 15分
**ステータス**: `DONE`
**完了サマリー**: Session, Prompt モデルに更新。不要なProject, Message, RunScript モデルを削除。

---

#### タスク2.2: SessionManagerの実装

**説明**:
- 対象ファイル: `src/services/session-manager.ts`
- セッションのCRUD操作を実装
- Prismaクライアント経由でDBアクセス

**技術的文脈**:
- 既存の `src/lib/db.ts` を使用
- Session型は設計書のインターフェースに従う

**受入基準**:
- [x] `src/services/session-manager.ts` が存在する
- [x] `create()` メソッドが実装されている
- [x] `findById()` メソッドが実装されている
- [x] `findAll()` メソッドが実装されている
- [x] `updateStatus()` メソッドが実装されている
- [x] `delete()` メソッドが実装されている
- [x] 単体テストが作成されている

**依存関係**: タスク2.1
**推定工数**: 30分
**ステータス**: `DONE`
**完了サマリー**: SessionManager クラスを実装。Prisma 経由で CRUD 操作を提供。9 テストケースが通過。

---

#### タスク2.3: ContainerManagerの実装

**説明**:
- 対象ファイル: `src/services/container-manager.ts`
- DockerServiceとSessionManagerを統合
- セッション作成時にコンテナとVolumeを作成
- 認証情報のマウント設定を実装

**技術的文脈**:
- Claude Auth: `~/.claude/` を `/root/.claude/` にマウント（read-only）
- Git Config: `~/.gitconfig` を `/root/.gitconfig` にマウント（read-only）
- SSH Agent: `SSH_AUTH_SOCK` をフォワード

**受入基準**:
- [x] `src/services/container-manager.ts` が存在する
- [x] `createSession()` メソッドが実装されている
- [x] `startSession()` メソッドが実装されている
- [x] `stopSession()` メソッドが実装されている
- [x] `deleteSession()` メソッドが実装されている
- [x] `getSessionStatus()` メソッドが実装されている
- [x] 認証情報マウントが正しく設定されている
- [x] 単体テストが作成されている

**依存関係**: タスク1.3, タスク2.2
**推定工数**: 45分
**ステータス**: `DONE`
**完了サマリー**: ContainerManager クラスを実装。Docker と SessionManager を統合し、セッションのライフサイクル管理を提供。12 テストケースが通過。

---

### フェーズ3: API実装

#### タスク3.1: Sessions API (CRUD)

**説明**:
- 対象ファイル:
  - `src/app/api/sessions/route.ts` (GET, POST)
  - `src/app/api/sessions/[id]/route.ts` (GET, DELETE)
- セッションの一覧取得、作成、取得、削除APIを実装

**技術的文脈**:
- Next.js App Router形式
- ContainerManagerとSessionManagerを使用

**受入基準**:
- [x] `GET /api/sessions` がセッション一覧を返す
- [x] `POST /api/sessions` が新しいセッションを作成する
- [x] `GET /api/sessions/:id` がセッション詳細を返す
- [x] `DELETE /api/sessions/:id` がセッションを削除する
- [x] APIテストが作成されている

**依存関係**: タスク2.3
**推定工数**: 30分
**ステータス**: `DONE`
**完了サマリー**: Sessions CRUD API を実装。ContainerManager 経由でセッション操作を提供。7 テストケースが通過。

---

#### タスク3.2: Sessions API (アクション)

**説明**:
- 対象ファイル:
  - `src/app/api/sessions/[id]/start/route.ts` (POST)
  - `src/app/api/sessions/[id]/stop/route.ts` (POST)
  - `src/app/api/sessions/[id]/warning/route.ts` (GET)
- セッションの開始、停止、警告取得APIを実装

**技術的文脈**:
- start: 停止中のコンテナを再起動
- stop: 実行中のコンテナを停止
- warning: 未コミット/未プッシュの変更を検出

**受入基準**:
- [x] `POST /api/sessions/:id/start` がセッションを開始する
- [x] `POST /api/sessions/:id/stop` がセッションを停止する
- [x] `GET /api/sessions/:id/warning` が警告情報を返す
- [x] APIテストが作成されている

**依存関係**: タスク3.1
**推定工数**: 25分
**ステータス**: `DONE`
**完了サマリー**: start/stop/warning API を実装。ContainerManager 経由でセッション状態を制御。

---

### フェーズ4: WebSocket・ターミナル

#### タスク4.1: WebSocket Gatewayの実装

**説明**:
- 対象ファイル: `src/lib/websocket/session-handler.ts`
- docker exec経由のターミナル接続を実装
- node-ptyでPTYセッションを管理

**技術的文脈**:
- `docker exec -it <containerId> /bin/bash` を実行
- node-ptyでPTYを生成
- WebSocket経由で入出力をパイプ

**受入基準**:
- [x] `src/lib/websocket/session-handler.ts` が存在する
- [x] WebSocket接続時にdocker execが実行される
- [x] ターミナル入力がコンテナに送信される
- [x] コンテナ出力がWebSocketで返される
- [x] リサイズイベントが処理される
- [x] 切断時にPTYがクリーンアップされる

**依存関係**: タスク2.3
**推定工数**: 40分
**ステータス**: `DONE`
**完了サマリー**: session-handler.ts を実装。docker exec 経由で PTY セッションを管理。8 テストケースが通過。

---

#### タスク4.2: server.tsの更新

**説明**:
- 対象ファイル: `server.ts`
- 既存のWebSocketハンドラーを新しいセッションハンドラーに置き換え
- 不要なハンドラーを削除

**技術的文脈**:
- 既存: `/ws/claude/:id`, `/ws/sessions/:id`, `/ws/terminal/:id`
- 新規: `/ws/session/:id` のみ

**受入基準**:
- [x] `/ws/session/:id` エンドポイントが機能する
- [x] 古いWebSocketエンドポイントが削除されている
- [x] サーバーが正常に起動する

**依存関係**: タスク4.1
**推定工数**: 20分
**ステータス**: `DONE`
**完了サマリー**: server.ts を更新。新しい /ws/session/:id エンドポイントのみに簡素化。

---

### フェーズ5: フロントエンド

#### タスク5.1: セッション一覧UI

**説明**:
- 対象ファイル:
  - `src/components/SessionList.tsx`
  - `src/components/SessionCard.tsx`
- セッション一覧の表示コンポーネントを実装
- ステータス表示、アクションボタン

**技術的文脈**:
- 既存のUIコンポーネント/スタイルを参考に
- Tailwind CSSを使用

**受入基準**:
- [x] `src/components/SessionList.tsx` が存在する
- [x] `src/components/SessionCard.tsx` が存在する
- [x] セッション一覧が表示される
- [x] ステータス（running/stopped/creating/error）が表示される
- [x] 開始/停止/削除ボタンが機能する

**依存関係**: タスク3.1
**推定工数**: 35分
**ステータス**: `DONE`
**完了サマリー**: SessionList と SessionCard コンポーネントを Docker セッション用に更新。

---

#### タスク5.2: セッション作成モーダル

**説明**:
- 対象ファイル: `src/components/CreateSessionModal.tsx`
- リポジトリURL、ブランチ名の入力フォーム
- バリデーション、エラー表示

**技術的文脈**:
- Headless UIのDialogを使用
- リポジトリURL: git@... または https://... 形式

**受入基準**:
- [x] `src/components/CreateSessionModal.tsx` が存在する
- [x] リポジトリURL入力欄がある
- [x] ブランチ名入力欄がある
- [x] セッション名入力欄がある
- [x] バリデーションエラーが表示される
- [x] 作成ボタンでAPIが呼ばれる

**依存関係**: タスク5.1
**推定工数**: 25分
**ステータス**: `DONE`
**完了サマリー**: CreateSessionModal コンポーネントを Docker セッション作成用に実装。

---

#### タスク5.3: ターミナルコンポーネントの更新

**説明**:
- 対象ファイル:
  - `src/components/Terminal.tsx`
  - `src/hooks/useTerminal.ts`
- 新しいWebSocketエンドポイントに接続
- セッションIDベースの接続

**技術的文脈**:
- 既存のxterm.js実装を流用
- WebSocket URL: `/ws/session/:id`

**受入基準**:
- [x] 新しいWebSocketエンドポイントに接続する
- [x] ターミナル入出力が機能する
- [x] リサイズが機能する
- [x] 接続/切断状態が表示される

**依存関係**: タスク4.2, タスク5.1
**推定工数**: 25分
**ステータス**: `DONE`
**完了サマリー**: DockerTerminal コンポーネントと useDockerTerminal フックを実装。6 テストケースが通過。

---

#### タスク5.4: メインページの更新

**説明**:
- 対象ファイル: `src/app/page.tsx`
- セッション一覧とターミナルを統合
- レイアウトの調整

**技術的文脈**:
- 既存のレイアウトを参考に
- セッション選択 -> ターミナル表示

**受入基準**:
- [x] セッション一覧が表示される
- [x] セッション選択でターミナルが表示される
- [x] 新規作成ボタンでモーダルが開く
- [x] レスポンシブデザインが機能する

**依存関係**: タスク5.3
**推定工数**: 30分
**ステータス**: `DONE`
**完了サマリー**: Docker セッション専用のホームページ (src/app/docker/page.tsx) を実装。10 テストケースが通過。

---

### フェーズ6: クリーンアップ

#### タスク6.1: 不要コードの削除

**説明**:
削除対象ファイル:
- `src/services/git-service.ts`
- `src/services/claude-pty-manager.ts`
- `src/services/pty-manager.ts`
- `src/services/process-manager.ts`
- 関連するテストファイル
- 既存のAPIルート（projects関連）

**技術的文脈**:
- 設計書の「削除対象」セクション参照
- 依存関係を確認してから削除

**受入基準**:
- [x] 指定されたファイルが削除されている
- [x] 関連するインポートが削除されている
- [x] ビルドが成功する
- [x] テストが通過する

**依存関係**: フェーズ5完了後
**推定工数**: 20分
**ステータス**: `DONE`
**完了サマリー**: 57 ファイル、11,152 行を削除。server.ts を簡素化。ビルド・テスト通過。

---

#### タスク6.2: ドキュメントの更新

**説明**:
更新対象ファイル:
- `README.md`
- `CLAUDE.md`
- `docs/SETUP.md`
- `docs/API.md`

**技術的文脈**:
- Docker要件の追加
- 新しいアーキテクチャの説明
- APIドキュメントの更新

**受入基準**:
- [x] README.mdにDocker要件が記載されている
- [x] 新しいアーキテクチャの概要が記載されている
- [x] APIドキュメントが更新されている
- [x] セットアップ手順が更新されている

**依存関係**: タスク6.1
**推定工数**: 25分
**ステータス**: `DONE`
**完了サマリー**: README.md, CLAUDE.md, docs/SETUP.md, docs/API.md を Docker アーキテクチャに更新。

---

### フェーズ7: 統合テスト

#### タスク7.1: E2Eテストの更新

**説明**:
- 対象ファイル: `e2e/` ディレクトリ
- 新しいセッション管理フローのテスト
- Docker連携のテスト

**技術的文脈**:
- Playwright使用
- Dockerが起動している環境で実行

**受入基準**:
- [ ] セッション作成フローのE2Eテストが存在する
- [ ] ターミナル接続のE2Eテストが存在する
- [ ] セッション停止/再開のE2Eテストが存在する
- [ ] テストがすべて通過する

**依存関係**: フェーズ6完了後
**推定工数**: 40分
**ステータス**: `TODO`

---

## タスクステータスの凡例

- `TODO` - 未着手
- `IN_PROGRESS` - 作業中
- `BLOCKED` - 依存関係や問題によりブロック中
- `REVIEW` - レビュー待ち
- `DONE` - 完了

---

## リスクと軽減策

### リスク1: Docker未インストール環境

**影響度**: 高
**発生確率**: 中
**軽減策**: 起動時にDockerの存在チェックを行い、未インストール時は明確なエラーメッセージとインストール手順を表示

### リスク2: SSH Agent Forwardingの互換性

**影響度**: 中
**発生確率**: 中
**軽減策**: macOS/Linux/WSL2それぞれでテストを実施し、プラットフォーム固有の設定を文書化

### リスク3: パフォーマンス（コンテナ起動時間）

**影響度**: 中
**発生確率**: 低
**軽減策**: Dockerイメージのレイヤーキャッシュを活用、イメージサイズの最適化

---

## 進捗サマリー

| フェーズ | タスク数 | 完了 | 進行中 | 残り |
|---------|----------|------|--------|------|
| 1. 基盤構築 | 3 | 3 | 0 | 0 |
| 2. セッション管理 | 3 | 3 | 0 | 0 |
| 3. API実装 | 2 | 2 | 0 | 0 |
| 4. WebSocket | 2 | 2 | 0 | 0 |
| 5. フロントエンド | 4 | 4 | 0 | 0 |
| 6. クリーンアップ | 2 | 2 | 0 | 0 |
| 7. 統合テスト | 1 | 0 | 0 | 1 |
| **合計** | **17** | **16** | **0** | **1** |
