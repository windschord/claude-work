# タスク管理: Docker統合機能

## 情報の明確性チェック（全体）

### ユーザーから明示された情報

- 実装対象: Claude WorkにDocker統合機能を追加
- アーキテクチャ: ClaudePTYManager + DockerPTYAdapterの委譲パターン
- Docker実行方法: docker run -it + node-pty
- イメージ名: claude-code-sandboxed
- セキュリティ: --cap-drop ALL、--security-opt no-new-privileges
- 認証情報マウント: ~/.claude, ~/.config/claude, ~/.ssh, ~/.gitconfig
- テストフレームワーク: Vitest（ユニット）、Playwright（E2E）

### 不明/要確認の情報

| 項目 | 現状の理解 | 確認状況 |
|------|-----------|---------|
| Node.jsバージョン | Dockerfile内でnode:20-slim使用 | 設計書で確定 |
| WSL2のSSH Agent転送 | 後続タスクで検討 | P3として後回し |

## 実装計画

### フェーズ1: 基盤構築
*推定合計工数: 120分（AIエージェント作業時間）*

---

#### タスク1.1: Dockerfile作成

**説明**:
- 対象ファイルパス: `docker/Dockerfile`
- Claude Code実行用の軽量Dockerイメージを定義
- node:20-slimベースでgit、openssh-client、curlをインストール

**技術的文脈**:
- ベースイメージ: node:20-slim
- Claude Codeインストール: npm install -g @anthropic-ai/claude-code
- 非rootユーザー: claude (UID 1000)

**情報の明確性**:

| 分類 | 内容 |
|------|------|
| 明示された情報 | ベースイメージ、インストールパッケージ、ユーザー名 |
| 不明/要確認の情報 | なし |

**実装手順**:
1. `docker/`ディレクトリを作成
2. Dockerfileを作成（設計書の仕様に従う）
3. ローカルでビルドテスト: `docker build -t claude-code-sandboxed:latest docker/`
4. コンテナ起動テスト: `docker run --rm -it claude-code-sandboxed:latest claude --version`

**受入基準**:
- [ ] `docker/Dockerfile`が存在する
- [ ] `docker build`が成功する
- [ ] イメージサイズが2GB以下（NFR-D010）
- [ ] claudeユーザーで実行される
- [ ] `claude --version`が正常に動作する

**依存関係**: なし
**対応要件**: REQ-D011
**推定工数**: 30分
**ステータス**: `DONE`

---

#### タスク1.2: DockerService基本実装

**説明**:
- 対象ファイルパス: `src/services/docker-service.ts`
- Docker CLIラッパーサービスを実装
- 可用性チェック、イメージ存在確認の基本機能

**技術的文脈**:
- child_processのexecを使用してdockerコマンドを実行
- Promiseベースの非同期API
- EventEmitter継承なし（シンプルなサービス）

**情報の明確性**:

| 分類 | 内容 |
|------|------|
| 明示された情報 | インターフェース定義（design.md） |
| 不明/要確認の情報 | なし |

**実装手順（TDD）**:
1. テスト作成: `src/services/__tests__/docker-service.test.ts`
   - isDockerAvailable()のテスト（成功/失敗）
   - imageExists()のテスト（存在/不在）
2. テスト実行: 失敗を確認
3. テストコミット
4. 実装: DockerService基本クラス
5. 実装コミット

**受入基準**:
- [ ] `src/services/docker-service.ts`が存在する
- [ ] TypeScript型定義が含まれている
- [ ] `isDockerAvailable()`が正常に動作する
- [ ] `imageExists()`が正常に動作する
- [ ] テストが3つ以上ある
- [ ] `npm test`で全テスト通過

**依存関係**: なし
**対応要件**: NFR-D009
**推定工数**: 40分
**ステータス**: `DONE`

---

#### タスク1.3: DockerServiceイメージビルド機能

**説明**:
- 対象ファイルパス: `src/services/docker-service.ts`
- buildImage()メソッドを追加
- 進捗コールバック対応

**技術的文脈**:
- child_processのspawnを使用（ストリーミング出力）
- onProgressコールバックでビルドログを逐次通知
- Dockerfileパスは`docker/Dockerfile`

**情報の明確性**:

| 分類 | 内容 |
|------|------|
| 明示された情報 | buildImage()シグネチャ、進捗通知要件 |
| 不明/要確認の情報 | なし |

**実装手順（TDD）**:
1. テスト追加: buildImage()のテスト
   - 成功ケース（モック）
   - 失敗ケース（モック）
   - 進捗コールバック呼び出し確認
2. テスト実行: 失敗を確認
3. テストコミット
4. 実装: buildImage()メソッド
5. 実装コミット

**受入基準**:
- [ ] `buildImage()`メソッドが存在する
- [ ] 進捗コールバックが呼び出される
- [ ] ビルド成功時にresolve
- [ ] ビルド失敗時にreject（エラーメッセージ付き）
- [ ] テストが追加されている

**依存関係**: タスク1.1、タスク1.2
**対応要件**: REQ-D012, REQ-D014
**推定工数**: 30分
**ステータス**: `DONE`

---

#### タスク1.4: 環境変数設定

**説明**:
- 対象ファイルパス: `src/services/docker-service.ts`, `docs/ENV_VARS.md`
- Docker関連の環境変数を定義・文書化

**技術的文脈**:
- DOCKER_IMAGE_NAME: デフォルト 'claude-code-sandboxed'
- DOCKER_IMAGE_TAG: デフォルト 'latest'
- DOCKER_MAX_CONTAINERS: デフォルト 5
- DOCKER_ENABLED: デフォルト true

**情報の明確性**:

| 分類 | 内容 |
|------|------|
| 明示された情報 | 環境変数名とデフォルト値 |
| 不明/要確認の情報 | なし |

**実装手順**:
1. DockerServiceConfigを環境変数から読み込むように修正
2. ENV_VARS.mdにDocker関連変数を追加
3. .env.exampleにサンプルを追加

**受入基準**:
- [ ] 環境変数が正しく読み込まれる
- [ ] デフォルト値が適用される
- [ ] ドキュメントが更新されている

**依存関係**: タスク1.2
**対応要件**: REQ-D018
**推定工数**: 20分
**ステータス**: `DONE`

---

### フェーズ2: コア機能
*推定合計工数: 180分（AIエージェント作業時間）*

---

#### タスク2.1: Prismaスキーマ変更

**説明**:
- 対象ファイルパス: `prisma/schema.prisma`
- Sessionモデルにdocker_mode、container_idフィールドを追加

**技術的文脈**:
- docker_mode: Boolean @default(false)
- container_id: String?
- SQLiteマイグレーションにdb pushを使用

**情報の明確性**:

| 分類 | 内容 |
|------|------|
| 明示された情報 | フィールド定義（design.md） |
| 不明/要確認の情報 | なし |

**実装手順**:
1. schema.prismaを編集
2. `npx prisma db push`を実行
3. `npx prisma generate`を実行
4. 既存のテストが通過することを確認

**受入基準**:
- [ ] docker_modeフィールドが追加されている
- [ ] container_idフィールドが追加されている
- [ ] Prisma clientが再生成されている
- [ ] 既存テストが通過する

**依存関係**: なし
**対応要件**: REQ-D001
**推定工数**: 20分
**ステータス**: `DONE`

---

#### タスク2.2: DockerPTYAdapter基本実装

**説明**:
- 対象ファイルパス: `src/services/docker-pty-adapter.ts`
- ClaudePTYManagerと同じインターフェースでDockerコンテナを操作

**技術的文脈**:
- EventEmitterを継承
- node-ptyでdocker runコマンドを実行
- イベント: 'data', 'exit', 'error'

**情報の明確性**:

| 分類 | 内容 |
|------|------|
| 明示された情報 | インターフェース定義、Docker起動コマンド構成 |
| 不明/要確認の情報 | なし |

**実装手順（TDD）**:
1. テスト作成: `src/services/__tests__/docker-pty-adapter.test.ts`
   - createSession()のテスト（モック）
   - write()のテスト
   - destroySession()のテスト
   - イベント発火のテスト
2. テスト実行: 失敗を確認
3. テストコミット
4. 実装: DockerPTYAdapterクラス
5. 実装コミット

**受入基準**:
- [ ] `src/services/docker-pty-adapter.ts`が存在する
- [ ] ClaudePTYManagerと同じメソッドシグネチャ
- [ ] EventEmitterを継承している
- [ ] テストが5つ以上ある
- [ ] `npm test`で全テスト通過

**依存関係**: タスク1.2
**対応要件**: REQ-D001, REQ-D002
**推定工数**: 60分
**ステータス**: `DONE`

---

#### タスク2.3: DockerPTYAdapterボリュームマウント

**説明**:
- 対象ファイルパス: `src/services/docker-pty-adapter.ts`
- 認証情報とワークスペースのマウント設定

**技術的文脈**:
- ワークスペース: worktreePath → /workspace (RW)
- Claude認証: ~/.claude, ~/.config/claude (RO)
- Git認証: ~/.ssh, ~/.gitconfig (RO)
- SSH Agent: SSH_AUTH_SOCK転送

**情報の明確性**:

| 分類 | 内容 |
|------|------|
| 明示された情報 | マウント構成表（design.md） |
| 不明/要確認の情報 | なし |

**実装手順（TDD）**:
1. テスト追加: ボリュームマウント引数生成のテスト
   - 必須マウントの確認
   - 読み取り専用フラグの確認
   - SSH Agent転送の確認
2. テスト実行: 失敗を確認
3. テストコミット
4. 実装: buildDockerArgs()メソッド
5. 実装コミット

**受入基準**:
- [ ] ワークスペースがRWでマウントされる
- [ ] 認証情報がROでマウントされる
- [ ] SSH_AUTH_SOCKが転送される
- [ ] ANTHROPIC_API_KEYが環境変数として渡される
- [ ] テストが追加されている

**依存関係**: タスク2.2
**対応要件**: REQ-D003, REQ-D004, REQ-D005, REQ-D006, REQ-D008, REQ-D009, REQ-D010
**推定工数**: 40分
**ステータス**: `DONE`

---

#### タスク2.4: DockerPTYAdapterセキュリティ設定

**説明**:
- 対象ファイルパス: `src/services/docker-pty-adapter.ts`
- コンテナセキュリティオプションの追加

**技術的文脈**:
- --security-opt no-new-privileges
- --cap-drop ALL
- --rm（自動削除）

**情報の明確性**:

| 分類 | 内容 |
|------|------|
| 明示された情報 | セキュリティオプション（design.md） |
| 不明/要確認の情報 | なし |

**実装手順（TDD）**:
1. テスト追加: セキュリティオプションのテスト
   - --cap-drop ALLの確認
   - --security-optの確認
   - --rmの確認
2. テスト実行: 失敗を確認
3. テストコミット
4. 実装: セキュリティオプション追加
5. 実装コミット

**受入基準**:
- [ ] --cap-drop ALLが設定されている
- [ ] --security-opt no-new-privilegesが設定されている
- [ ] --rmが設定されている
- [ ] テストが追加されている

**依存関係**: タスク2.3
**対応要件**: NFR-D003, NFR-D004, NFR-D005
**推定工数**: 20分
**ステータス**: `DONE`

---

#### タスク2.5: ClaudePTYManager変更

**説明**:
- 対象ファイルパス: `src/services/claude-pty-manager.ts`
- dockerModeオプションの追加とDockerPTYAdapterへの委譲

**技術的文脈**:
- CreateClaudePTYSessionOptionsにdockerMode追加
- dockerMode === trueの場合、DockerPTYAdapterを使用
- イベントの透過的転送

**情報の明確性**:

| 分類 | 内容 |
|------|------|
| 明示された情報 | 変更後のインターフェース（design.md） |
| 不明/要確認の情報 | なし |

**実装手順（TDD）**:
1. テスト追加: dockerModeオプションのテスト
   - dockerMode=falseで既存動作
   - dockerMode=trueでDockerPTYAdapter使用
2. テスト実行: 失敗を確認
3. テストコミット
4. 実装: 委譲ロジック追加
5. 実装コミット

**受入基準**:
- [ ] dockerModeオプションが追加されている
- [ ] dockerMode=falseで既存動作が維持される
- [ ] dockerMode=trueでDockerPTYAdapterが使用される
- [ ] イベントが正しく転送される
- [ ] 既存テストが通過する

**依存関係**: タスク2.4
**対応要件**: REQ-D001
**推定工数**: 40分
**ステータス**: `DONE`

---

### フェーズ3: API・UI
*推定合計工数: 100分（AIエージェント作業時間）*

---

#### タスク3.1: セッション作成API変更

**説明**:
- 対象ファイルパス: `src/app/api/projects/[id]/sessions/route.ts`
- dockerModeパラメータの追加とバリデーション

**技術的文脈**:
- リクエストボディにdockerMode追加
- Docker可用性チェック
- イメージ存在チェック

**情報の明確性**:

| 分類 | 内容 |
|------|------|
| 明示された情報 | API変更内容（design.md） |
| 不明/要確認の情報 | なし |

**実装手順（TDD）**:
1. テスト追加: `src/app/api/projects/[id]/sessions/__tests__/route.test.ts`
   - dockerMode=trueでのセッション作成
   - Docker未インストール時のエラー
   - イメージ未存在時の自動ビルド
2. テスト実行: 失敗を確認
3. テストコミット
4. 実装: API変更
5. 実装コミット

**受入基準**:
- [ ] dockerModeパラメータを受け付ける
- [ ] Docker未インストール時に503エラー
- [ ] セッションレコードにdocker_modeが保存される
- [ ] テストが追加されている

**依存関係**: タスク2.1, タスク2.5
**対応要件**: REQ-D001, REQ-D007, REQ-D012
**推定工数**: 40分
**ステータス**: `DONE`

---

#### タスク3.2: ClaudeWebSocketHandler変更

**説明**:
- 対象ファイルパス: `src/lib/websocket/claude-ws.ts`
- セッションのdocker_modeに基づいてPTYアダプタを選択

**技術的文脈**:
- セッション取得時にdocker_modeを確認
- ClaudePTYManager.createSession()にdockerModeを渡す

**情報の明確性**:

| 分類 | 内容 |
|------|------|
| 明示された情報 | WebSocket接続時のフロー |
| 不明/要確認の情報 | なし |

**実装手順**:
1. セッション取得ロジックでdocker_modeを読み込む
2. createSession呼び出し時にdockerModeオプションを渡す
3. 手動テストで動作確認

**受入基準**:
- [ ] docker_mode=trueのセッションでDockerPTYAdapterが使用される
- [ ] docker_mode=falseのセッションで既存動作が維持される
- [ ] WebSocket接続が正常に確立される

**依存関係**: タスク2.5, タスク3.1
**対応要件**: REQ-D021
**推定工数**: 20分
**ステータス**: `DONE`

---

#### タスク3.3: NewSessionForm UI変更

**説明**:
- 対象ファイルパス: `src/components/sessions/NewSessionForm.tsx`
- Dockerモードトグルの追加

**技術的文脈**:
- チェックボックスでdockerModeを切り替え
- Docker未インストール時はdisabled
- Tailwind CSSでスタイリング

**情報の明確性**:

| 分類 | 内容 |
|------|------|
| 明示された情報 | UIコンポーネント（design.md） |
| 不明/要確認の情報 | なし |

**実装手順**:
1. NewSessionFormDataにdockerModeフィールド追加
2. チェックボックスUI追加
3. API呼び出し時にdockerModeを送信
4. Docker可用性チェックAPIを追加（オプション）

**受入基準**:
- [ ] Dockerモードトグルが表示される
- [ ] トグル状態がAPIリクエストに含まれる
- [ ] UIがダークモード対応している

**依存関係**: タスク3.1
**対応要件**: REQ-D001
**推定工数**: 30分
**ステータス**: `DONE`

---

#### タスク3.4: セッション詳細ページ表示

**説明**:
- 対象ファイルパス: `src/app/sessions/[id]/page.tsx`
- Dockerモードセッションの表示対応

**技術的文脈**:
- セッションのdocker_modeを表示
- コンテナステータスの表示（将来拡張用）

**情報の明確性**:

| 分類 | 内容 |
|------|------|
| 明示された情報 | Dockerモード表示要件 |
| 不明/要確認の情報 | なし |

**実装手順**:
1. セッション情報にdocker_modeを含める
2. Dockerモードバッジを表示
3. スタイリング調整

**受入基準**:
- [ ] Dockerモードセッションに「Docker」バッジが表示される
- [ ] 既存セッション表示に影響がない

**依存関係**: タスク3.1
**対応要件**: REQ-D021
**推定工数**: 10分
**ステータス**: `DONE`

---

### フェーズ4: 品質・運用
*推定合計工数: 120分（AIエージェント作業時間）*

---

#### タスク4.1: 統合テスト追加

**説明**:
- 対象ファイルパス: `src/services/__tests__/docker-integration.test.ts`
- 実際のDockerコンテナを使用した統合テスト

**技術的文脈**:
- Docker環境が必要（CI/CDでスキップ可能に）
- テストタイムアウトを長めに設定

**情報の明確性**:

| 分類 | 内容 |
|------|------|
| 明示された情報 | テスト戦略（design.md） |
| 不明/要確認の情報 | なし |

**実装手順**:
1. 統合テストファイル作成
2. Dockerセッション作成テスト
3. ファイル操作テスト
4. セッション停止テスト

**受入基準**:
- [ ] 統合テストが作成されている
- [ ] Docker未インストール環境ではスキップされる
- [ ] テストがCIで実行可能

**依存関係**: タスク2.5
**対応要件**: NFR-D001
**推定工数**: 40分
**ステータス**: `DONE`

---

#### タスク4.2: エラーハンドリング強化

**説明**:
- 対象ファイルパス: 複数ファイル
- 各種Dockerエラーの適切なハンドリング

**技術的文脈**:
- Dockerデーモン停止検出
- イメージビルド失敗
- コンテナ起動失敗
- 認証情報マウント失敗

**情報の明確性**:

| 分類 | 内容 |
|------|------|
| 明示された情報 | エラーハンドリング表（design.md） |
| 不明/要確認の情報 | なし |

**実装手順**:
1. DockerServiceにエラー検出ロジック追加
2. 認証情報存在チェック追加
3. ユーザーフレンドリーなエラーメッセージ
4. ログ出力強化

**受入基準**:
- [ ] 各エラーケースで適切なメッセージが表示される
- [ ] エラーがログに記録される
- [ ] UIでエラーが表示される

**依存関係**: タスク3.1
**対応要件**: REQ-D007, REQ-D017, NFR-D009
**推定工数**: 30分
**ステータス**: `DONE`

---

#### タスク4.3: セッション停止・再開機能

**説明**:
- 対象ファイルパス: `src/services/docker-pty-adapter.ts`, API
- Dockerセッションの停止と再開

**技術的文脈**:
- 停止: docker stop → コンテナ削除
- 再開: 新しいコンテナを同じworktreeで起動

**情報の明確性**:

| 分類 | 内容 |
|------|------|
| 明示された情報 | 停止・再開フロー（design.md） |
| 不明/要確認の情報 | なし |

**実装手順（TDD）**:
1. テスト追加: 停止・再開のテスト
2. テスト実行: 失敗を確認
3. テストコミット
4. 実装: destroySession、restartSession
5. 実装コミット

**受入基準**:
- [ ] セッション停止でコンテナが停止される
- [ ] セッション再開で新しいコンテナが起動される
- [ ] worktreeの状態が維持される

**依存関係**: タスク2.5
**対応要件**: REQ-D015, REQ-D016
**推定工数**: 30分
**ステータス**: `TODO`

---

#### タスク4.4: ドキュメント更新

**説明**:
- 対象ファイルパス: `docs/SETUP.md`, `docs/ENV_VARS.md`, `README.md`
- Docker機能のドキュメント追加

**技術的文脈**:
- セットアップ手順
- 環境変数説明
- トラブルシューティング

**情報の明確性**:

| 分類 | 内容 |
|------|------|
| 明示された情報 | ドキュメント更新要件 |
| 不明/要確認の情報 | なし |

**実装手順**:
1. SETUP.mdにDocker要件を追加
2. ENV_VARS.mdにDocker環境変数を追加
3. トラブルシューティングセクション追加

**受入基準**:
- [ ] Docker要件が文書化されている
- [ ] 環境変数が文書化されている
- [ ] トラブルシューティングガイドがある

**依存関係**: タスク1.4
**対応要件**: なし（運用）
**推定工数**: 20分
**ステータス**: `TODO`

---

## タスクステータスの凡例

- `TODO` - 未着手
- `IN_PROGRESS` - 作業中
- `BLOCKED` - ブロック中
- `REVIEW` - レビュー待ち
- `DONE` - 完了

## タスク依存関係図

```text
Phase 1: 基盤
タスク1.1 (Dockerfile) ─────────────────────┐
                                            ↓
タスク1.2 (DockerService基本) ─→ タスク1.3 (イメージビルド)
            ↓                               ↓
タスク1.4 (環境変数) ←──────────────────────┘

Phase 2: コア機能
タスク2.1 (Prismaスキーマ) ──────────────────────────────────┐
                                                            ↓
タスク1.2 ─→ タスク2.2 (DockerPTYAdapter基本)                │
                    ↓                                        │
             タスク2.3 (ボリュームマウント)                    │
                    ↓                                        │
             タスク2.4 (セキュリティ設定)                      │
                    ↓                                        │
             タスク2.5 (ClaudePTYManager変更) ←───────────────┘

Phase 3: API・UI
タスク2.1 + タスク2.5 ─→ タスク3.1 (セッション作成API)
                              ↓
                        タスク3.2 (WebSocketHandler)
                              ↓
                        タスク3.3 (NewSessionForm)
                              ↓
                        タスク3.4 (セッション詳細ページ)

Phase 4: 品質・運用
タスク2.5 ─→ タスク4.1 (統合テスト)
タスク3.1 ─→ タスク4.2 (エラーハンドリング)
タスク2.5 ─→ タスク4.3 (停止・再開)
タスク1.4 ─→ タスク4.4 (ドキュメント)
```

## リスクと軽減策

| リスク | 影響度 | 発生確率 | 軽減策 |
|--------|--------|---------|--------|
| Docker APIの互換性問題 | 中 | 低 | Docker CLI使用で回避 |
| SSH Agent転送の環境差異 | 高 | 中 | macOS/Linuxを優先、WSL2は後回し |
| イメージビルド時間 | 中 | 中 | キャッシュ活用、バックグラウンドビルド |
| 認証情報の権限問題 | 高 | 中 | 読み取り専用マウント、エラーハンドリング |

## 要件トレーサビリティ

| 要件ID | タスクID | 優先度 |
|--------|---------|--------|
| REQ-D001 | 2.1, 2.2, 2.5, 3.1, 3.3 | P0 |
| REQ-D002 | 2.2, 2.3 | P0 |
| REQ-D003 | 2.3 | P1 |
| REQ-D004 | 2.3 | P0 |
| REQ-D005 | 2.3 | P0 |
| REQ-D006 | 2.3 | P1 |
| REQ-D007 | 3.1, 4.2 | P2 |
| REQ-D008 | 2.3 | P2 |
| REQ-D009 | 2.3 | P2 |
| REQ-D010 | 2.3 | P3 |
| REQ-D011 | 1.1 | P0 |
| REQ-D012 | 1.3, 3.1 | P2 |
| REQ-D013 | - (将来) | P2 |
| REQ-D014 | 1.3 | P3 |
| REQ-D015 | 4.3 | P1 |
| REQ-D016 | 4.3 | P1 |
| REQ-D017 | 4.2 | P3 |
| REQ-D018 | 1.4 | P3 |
| REQ-D019 | 2.3 | P1 |
| REQ-D020 | 2.3 | P1 |
| REQ-D021 | 3.2, 3.4 | P2 |
| REQ-D022 | 3.1, 3.2 | P2 |
