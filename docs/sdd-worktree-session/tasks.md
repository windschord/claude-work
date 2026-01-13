# Worktreeベースセッション管理 - タスク管理書

> このドキュメントはAIエージェント（Claude Code等）が実装を行うことを前提としています。

## 情報の明確性チェック（全体）

### ユーザーから明示された情報
- [x] 実装対象のディレクトリ構造: 既存のNext.js + Prismaプロジェクト構造を継続
- [x] 使用するパッケージマネージャー: npm
- [x] テストフレームワーク: Vitest
- [x] リンター/フォーマッター: ESLint
- [x] コーディング規約: 既存のプロジェクト規約に従う
- [x] 既存データ: すべてリセット可能

### 不明/要確認の情報（全体）

すべての情報はユーザーとの対話で確認済みです。

---

## 実装計画

### フェーズ1: データベーススキーマ更新

#### タスク1.1: Prismaスキーマ更新 - Repositoryモデル追加

**説明**:
- `prisma/schema.prisma` にRepositoryモデルを追加
- フィールド: id, name, type, path, url, defaultBranch, createdAt, updatedAt
- Sessionモデルとのリレーション設定

**技術的文脈**:
- 既存: `prisma/schema.prisma` にSessionモデルあり
- typeフィールドは "local" または "remote"
- pathとurlは排他的（どちらか一方のみ設定）

**受入基準**:
- [ ] Repositoryモデルが定義されている
- [ ] SessionモデルにrepositoryIdフィールドが追加されている
- [ ] `npx prisma validate` が成功する

**依存関係**: なし
**ステータス**: `TODO`

#### タスク1.2: Prismaスキーマ更新 - Sessionモデル変更

**説明**:
- `prisma/schema.prisma` のSessionモデルを更新
- 削除: repoUrl, localPath
- 追加: repositoryId (FK), worktreePath, parentBranch
- branchフィールドはセッションブランチ名（session/xxx形式）

**技術的文脈**:
- 既存のrepoUrlとlocalPathはRepositoryに移行
- リレーション: Session → Repository (多対1)

**受入基準**:
- [ ] repoUrl, localPathが削除されている
- [ ] repositoryId, worktreePath, parentBranchが追加されている
- [ ] Repository-Sessionのリレーションが設定されている
- [ ] `npx prisma validate` が成功する

**依存関係**: タスク1.1
**ステータス**: `TODO`

#### タスク1.3: データベースマイグレーション実行

**説明**:
- `npx prisma db push` でスキーマをデータベースに反映
- 既存のセッションデータはリセット（ユーザー承認済み）
- Prisma Clientを再生成

**技術的文脈**:
- SQLiteを使用
- 既存データはすべてリセット可能

**受入基準**:
- [ ] `npx prisma db push` が成功する
- [ ] `npx prisma generate` が成功する
- [ ] データベースに新しいテーブル構造が反映されている

**依存関係**: タスク1.2
**ステータス**: `TODO`

---

### フェーズ2: バックエンドサービス実装

#### タスク2.1: WorktreeService実装

**説明**:
- `src/services/worktree-service.ts` を新規作成
- 機能: create(), remove(), list(), generateBranchName()
- Worktree配置先: `~/.claudework/worktrees/<repo-name>-<session-name>/`

**技術的文脈**:
- `git worktree add` / `git worktree remove` コマンドを実行
- child_processのexecAsyncを使用
- ブランチ名生成: `session/<session-name>`（スペース等はハイフンに変換）

**受入基準**:
- [ ] WorktreeServiceクラスが実装されている
- [ ] create()がWorktreeを作成できる
- [ ] remove()がWorktreeを削除できる
- [ ] generateBranchName()が正しいブランチ名を生成する
- [ ] 単体テストが作成され、すべて通過する

**依存関係**: なし
**ステータス**: `TODO`

#### タスク2.2: RepositoryManager実装

**説明**:
- `src/services/repository-manager.ts` を新規作成
- 機能: register(), findAll(), findById(), delete(), getBranches()
- Prismaを使用してデータベース操作

**技術的文脈**:
- ローカルリポジトリ登録時: FilesystemServiceでGit判定、デフォルトブランチ取得
- リモートリポジトリ登録時: `git ls-remote` でデフォルトブランチ取得
- 削除時: 関連セッションがある場合はエラー

**受入基準**:
- [ ] RepositoryManagerクラスが実装されている
- [ ] register()がローカル/リモートリポジトリを登録できる
- [ ] findAll(), findById()が正しく動作する
- [ ] delete()が関連セッションチェックを行う
- [ ] getBranches()がブランチ一覧を取得できる
- [ ] 単体テストが作成され、すべて通過する

**依存関係**: タスク1.3
**ステータス**: `TODO`

#### タスク2.3: ContainerManager更新

**説明**:
- `src/services/container-manager.ts` を更新
- createSession()のパラメータを変更（repositoryId指定）
- ローカルリポジトリ時: WorktreeService使用
- リモートリポジトリ時: 従来の動作を維持

**技術的文脈**:
- 既存のcreateSession()のシグネチャを変更
- ローカル: Worktree作成 → bind mount
- リモート: volume作成 → clone（従来動作）

**受入基準**:
- [ ] createSession()が新しいパラメータを受け付ける
- [ ] ローカルリポジトリでWorktreeが作成される
- [ ] リモートリポジトリで従来動作が維持される
- [ ] deleteSession()がWorktreeを削除する
- [ ] 単体テストが更新され、すべて通過する

**依存関係**: タスク2.1, タスク2.2
**ステータス**: `TODO`

#### タスク2.4: SessionManager更新

**説明**:
- `src/services/session-manager.ts` を更新
- create()のパラメータを変更（repositoryId指定）
- 新しいフィールドに対応

**技術的文脈**:
- 既存のcreate()メソッドのシグネチャを変更
- repositoryId, worktreePath, parentBranchを追加

**受入基準**:
- [ ] create()が新しいパラメータを受け付ける
- [ ] findAll(), findById()がRepository情報を含める
- [ ] 単体テストが更新され、すべて通過する

**依存関係**: タスク1.3
**ステータス**: `TODO`

---

### フェーズ3: API Routes実装

#### タスク3.1: Repository API実装

**説明**:
- `src/app/api/repositories/route.ts` を新規作成
- GET: リポジトリ一覧取得
- POST: リポジトリ登録

**技術的文脈**:
- 既存のAPIパターンに従う
- エラーハンドリング: 400, 404, 409, 500

**受入基準**:
- [ ] GET /api/repositories がリポジトリ一覧を返す
- [ ] POST /api/repositories がリポジトリを登録する
- [ ] バリデーションエラー時に400を返す
- [ ] 単体テストが作成され、すべて通過する

**依存関係**: タスク2.2
**ステータス**: `TODO`

#### タスク3.2: Repository詳細API実装

**説明**:
- `src/app/api/repositories/[id]/route.ts` を新規作成
- GET: リポジトリ詳細取得
- DELETE: リポジトリ削除

**技術的文脈**:
- 削除時: 関連セッションがある場合は409を返す

**受入基準**:
- [ ] GET /api/repositories/:id がリポジトリ詳細を返す
- [ ] DELETE /api/repositories/:id がリポジトリを削除する
- [ ] 関連セッションがある場合は409を返す
- [ ] 単体テストが作成され、すべて通過する

**依存関係**: タスク3.1
**ステータス**: `TODO`

#### タスク3.3: Repository Branches API実装

**説明**:
- `src/app/api/repositories/[id]/branches/route.ts` を新規作成
- GET: リポジトリのブランチ一覧取得

**技術的文脈**:
- ローカル: FilesystemService.getGitBranches()使用
- リモート: git ls-remoteコマンド使用

**受入基準**:
- [ ] GET /api/repositories/:id/branches がブランチ一覧を返す
- [ ] defaultBranchを含める
- [ ] 単体テストが作成され、すべて通過する

**依存関係**: タスク3.1
**ステータス**: `TODO`

#### タスク3.4: Sessions API更新

**説明**:
- `src/app/api/sessions/route.ts` を更新
- POST: 新しいパラメータ（repositoryId, parentBranch）を受け付ける
- GET: Repository情報を含める

**技術的文脈**:
- 既存のrepoUrl, localPathパラメータを削除
- repositoryId, parentBranchを必須パラメータに

**受入基準**:
- [ ] POST /api/sessions が新しいパラメータを受け付ける
- [ ] GET /api/sessions がRepository情報を含める
- [ ] 単体テストが更新され、すべて通過する

**依存関係**: タスク2.3, タスク2.4
**ステータス**: `TODO`

---

### フェーズ4: フロントエンド実装

#### タスク4.1: Repository Store実装

**説明**:
- `src/store/repository-store.ts` を新規作成
- Zustandを使用
- 状態: repositories, selectedRepository, loading, error
- アクション: fetchRepositories, addRepository, deleteRepository, selectRepository

**技術的文脈**:
- 既存のsession-store.tsを参考にする

**受入基準**:
- [ ] RepositoryStoreが実装されている
- [ ] fetchRepositories()がAPIからデータを取得する
- [ ] addRepository()がAPIにリポジトリを追加する
- [ ] deleteRepository()がAPIからリポジトリを削除する

**依存関係**: タスク3.1
**ステータス**: `TODO`

#### タスク4.2: RepositorySection実装

**説明**:
- `src/components/docker-sessions/RepositorySection.tsx` を新規作成
- サイドバーにリポジトリ一覧を表示
- アイコンでタイプ（local/remote）を区別
- セッション数を表示
- 追加/削除ボタン

**技術的文脈**:
- 既存のSessionListを参考にする
- Lucide iconsを使用

**受入基準**:
- [ ] リポジトリ一覧が表示される
- [ ] タイプによってアイコンが異なる
- [ ] セッション数が表示される
- [ ] 追加ボタンがAddRepositoryModalを開く
- [ ] 削除ボタンが動作する（セッションがない場合のみ）

**依存関係**: タスク4.1
**ステータス**: `TODO`

#### タスク4.3: AddRepositoryModal実装

**説明**:
- `src/components/docker-sessions/AddRepositoryModal.tsx` を新規作成
- タブでLocal/Remoteを切り替え
- Local: DirectoryBrowser（既存）を使用
- Remote: URL入力
- 名前入力（自動生成可）

**技術的文脈**:
- 既存のCreateSessionModalを参考にする
- DirectoryBrowser、SourceTypeTabsコンポーネントを再利用

**受入基準**:
- [ ] モーダルが開閉できる
- [ ] タブでLocal/Remoteを切り替えられる
- [ ] Localタブでディレクトリを選択できる
- [ ] Remoteタブでurlを入力できる
- [ ] 名前を入力できる（自動生成オプション付き）
- [ ] 登録ボタンでリポジトリが追加される

**依存関係**: タスク4.2
**ステータス**: `TODO`

#### タスク4.4: CreateSessionModal更新

**説明**:
- `src/components/docker-sessions/CreateSessionModal.tsx` を更新
- リポジトリ選択ドロップダウンを追加
- 親ブランチ選択を追加
- セッション名入力を維持
- ブランチ名プレビューを追加（session/<name>形式）
- 従来のSourceTypeTabs、LocalRepoFormを削除

**技術的文脈**:
- 既存コンポーネントのリファクタリング
- repositoryIdとparentBranchを送信

**受入基準**:
- [ ] リポジトリを選択できる
- [ ] 親ブランチを選択できる
- [ ] セッション名を入力できる
- [ ] ブランチ名プレビューが表示される
- [ ] セッション作成が正しく動作する

**依存関係**: タスク4.1, タスク3.4
**ステータス**: `TODO`

#### タスク4.5: サイドバーレイアウト更新

**説明**:
- `src/components/docker-sessions/DockerSessionsSidebar.tsx` を更新
- RepositorySectionを追加
- レイアウトを調整（リポジトリ → セッション）

**技術的文脈**:
- 既存のサイドバーコンポーネントを更新

**受入基準**:
- [ ] サイドバーにリポジトリセクションが表示される
- [ ] リポジトリセクションがセッションセクションの上に配置される
- [ ] 全体のレイアウトが崩れない

**依存関係**: タスク4.2
**ステータス**: `TODO`

---

### フェーズ5: クリーンアップと統合テスト

#### タスク5.1: 不要コンポーネント削除

**説明**:
- 不要になったコンポーネントを削除
- LocalRepoForm（機能はAddRepositoryModalに統合）
- 必要に応じてSourceTypeTabs（機能はAddRepositoryModalで再利用）

**技術的文脈**:
- CreateSessionModalからの参照を確認
- コンポーネントが他で使用されていないことを確認

**受入基準**:
- [ ] 不要なコンポーネントが削除されている
- [ ] インポートエラーがない
- [ ] ビルドが成功する

**依存関係**: タスク4.4
**ステータス**: `TODO`

#### タスク5.2: 全体テスト実行

**説明**:
- 全テストを実行して成功を確認
- TypeScriptコンパイルエラーがないことを確認
- ESLintエラーがないことを確認

**受入基準**:
- [ ] `npm test` が成功する
- [ ] `npm run build` が成功する
- [ ] `npm run lint` がエラーなしで完了する

**依存関係**: タスク5.1
**ステータス**: `TODO`

#### タスク5.3: E2Eテスト・手動テスト

**説明**:
- 実際にアプリケーションを起動して動作確認
- リポジトリ登録フロー
- セッション作成フロー
- セッション削除フロー

**受入基準**:
- [ ] ローカルリポジトリを登録できる
- [ ] リモートリポジトリを登録できる
- [ ] 登録済みリポジトリからセッションを作成できる
- [ ] Worktreeが正しく作成される（ローカルリポジトリ時）
- [ ] セッション削除時にWorktreeが削除される

**依存関係**: タスク5.2
**ステータス**: `TODO`

---

## タスクステータスの凡例
- `TODO` - 未着手
- `IN_PROGRESS` - 作業中
- `BLOCKED` - 依存関係や問題によりブロック中
- `REVIEW` - レビュー待ち
- `DONE` - 完了

## リスクと軽減策

### リスク1: Worktree作成の失敗

**影響度**: 高
**発生確率**: 中
**軽減策**:
- エラーメッセージを詳細に表示
- 同名Worktree存在時のチェックを事前に行う
- 失敗時のクリーンアップ処理を実装

### リスク2: 既存機能の破壊

**影響度**: 高
**発生確率**: 低
**軽減策**:
- 各フェーズでテストを実行
- 段階的な実装とテスト

### リスク3: リモートリポジトリのブランチ取得失敗

**影響度**: 中
**発生確率**: 中
**軽減策**:
- SSH認証エラーの適切なハンドリング
- タイムアウト設定
- エラーメッセージの改善

## 備考

- TDD: 各サービス実装時にテストを先に作成する
- コミット: 各タスク完了時にコミットを作成
- 既存機能: リモートリポジトリの従来動作は維持する
