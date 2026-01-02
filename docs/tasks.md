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

## 完了済みフェーズ一覧

以下のフェーズは完了済みです。詳細は各検証レポートを参照してください。

| フェーズ | 内容 | 検証レポート |
|---------|------|-------------|
| Phase 1-4 | MVP基盤構築（Next.js、認証、WebSocket） | - |
| Phase 5-7 | 拡張機能（セッション管理、ターミナル、UI/UX） | - |
| Phase 8-10 | バグ修正（PR#2対応、マージ後修正） | - |
| Phase 19-20 | Critical Issue修正、SSRエラー修正 | verification-report-phase19.md |
| Phase 21 | UI/UX改善（ロゴナビゲーション） | verification-report-comprehensive-phase21.md |
| Phase 22 | Claude CLI自動検出機能 | - |
| Phase 23 | 環境変数ロード・Prisma認証修正 | - |
| Phase 24 | High Priority UIコンポーネント実装 | - |
| Phase 25 | Medium Priority機能改善 | - |
| Phase 30 | E2Eテスト環境変数修正 | - |
| Phase 45 | 認証機能の削除（ストーリー28） | - |
| Phase 31 | セッション再起動機能 | verification-report-phase31.md |
| Phase 33 | プロセス再起動・Diff表示修正 | verification-report-phase33.md |
| Phase 34 | ブラウザ通知システム | - |
| Phase 35 | 網羅的検証で発見された不具合修正 | verification-report-phase35.md |
| Phase 38 | 包括的UI検証で発見された不具合修正 | - |
| Phase 39 | ターミナル表示不具合修正 | - |
| Phase 40 | プロセスライフサイクル管理 | - |
| Phase 41 | JSON表示問題修正（stream-jsonフィルタリング） | - |
| Phase 43 | UX改善機能（ターミナルリサイズ、セッション復帰、Tree表示、ワンクリック作成、通知強化） | - |

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

**受入基準**:
- ログに出力されるcommitMessageが80文字以内
- 文字数情報が記録される

---

## Phase 42: セッション操作後のUI自動更新

**関連要件**: REQ-112, REQ-113

### 概要

セッション操作後のユーザー体験を改善:
1. セッション削除後にセッション一覧を即座に更新
2. セッション作成後に作成したセッションの詳細ページに自動遷移

### タスク42.1: deleteSession関数の修正

**ステータス**: `DONE`
**推定工数**: 15分

**説明**:
- `src/store/index.ts`の`deleteSession`関数を修正
- API削除成功後、ローカルの`sessions`配列から該当セッションを削除

**受入基準**:
- [ ] deleteSession成功後にsessions配列が更新される
- [ ] UIが即座に更新され、削除されたセッションが非表示になる
- [ ] 既存テストが通る

### タスク42.2: createSession関数の修正

**ステータス**: `DONE`
**推定工数**: 15分

**説明**:
- `src/store/index.ts`の`createSession`関数を修正
- 作成されたセッションのIDを返すように変更

**受入基準**:
- [ ] createSessionがセッションIDを返す
- [ ] 既存の動作（sessions配列への追加）が維持される
- [ ] 既存テストが通る

### タスク42.3: セッション作成後の自動遷移

**ステータス**: `DONE`
**推定工数**: 20分

**説明**:
- `src/app/projects/[id]/page.tsx`の`handleSessionCreated`を修正
- 作成されたセッションIDを受け取り、詳細ページに遷移

**受入基準**:
- [ ] セッション作成後に`/sessions/{id}`に自動遷移する
- [ ] 遷移先でセッション詳細が正しく表示される
- [ ] エラー時は遷移せずエラーメッセージを表示

### タスク42.4: テストの追加・更新

**ステータス**: `DONE`
**推定工数**: 20分

**説明**:
- 新しい動作に対応したテストを追加
- `src/store/__tests__/index.test.ts`の更新
- `src/components/sessions/__tests__/SessionCard.test.tsx`の確認

**受入基準**:
- [ ] deleteSession後のsessions更新テスト
- [ ] createSessionの戻り値テスト
- [ ] 全テストが通る

---

## Phase 43: UX改善機能

**関連要件**: REQ-114〜141, NFR-018〜024

### 概要

5つのUX改善機能を実装:
1. ターミナルサイズの自動調整（ストーリー18）
2. Claudeセッション復帰機能（ストーリー19）
3. セッション一覧のTree表示化（ストーリー20）
4. セッション作成の簡略化（ストーリー21）
5. ユーザーアクション要求時のブラウザ通知強化（ストーリー22）

---

### ストーリー18: ターミナルサイズの自動調整

#### タスク43.1: xterm-addon-fitパッケージの追加

**ステータス**: `DONE`
**推定工数**: 5分

**説明**:
- `xterm-addon-fit`パッケージをインストール

**実装手順**:
```bash
npm install xterm-addon-fit
```

**受入基準**:
- [ ] `package.json`に`xterm-addon-fit`が追加されている
- [ ] `npm install`が成功する

---

#### タスク43.2: useClaudeTerminalフックのリサイズ機能実装

**ステータス**: `DONE`
**推定工数**: 40分
**依存関係**: タスク43.1

**説明**:
- 対象ファイル: `src/hooks/useClaudeTerminal.ts`
- FitAddonを使用してターミナルサイズを自動調整
- デバウンス付きリサイズハンドラを実装

**実装手順（TDD）**:
1. テスト作成: `src/hooks/__tests__/useClaudeTerminal.test.ts`に以下のテストを追加
   - `fit()`が初回表示時に呼ばれることを確認
   - ウィンドウリサイズ時に300ms以内にfit()が呼ばれることを確認
   - isVisible変更時にfit()が呼ばれることを確認
   - リサイズ時にWebSocketでresizeメッセージが送信されることを確認
2. テスト実行: 失敗を確認
3. テストコミット
4. 実装: FitAddon統合、デバウンスハンドラ、isVisible対応
5. 実装コミット

**技術的文脈**:
- フレームワーク: React 18 + TypeScript
- XTerm.js: v5.x
- FitAddon: xterm-addon-fit
- デバウンス: lodash.debounce または自前実装（300ms）

**受入基準**:
- [ ] FitAddonがterminalにロードされる
- [ ] 初回表示時にfit()が実行される
- [ ] ウィンドウリサイズ時に300msデバウンスでfit()が実行される
- [ ] isVisible=trueになったときにfit()が実行される
- [ ] リサイズ後にWebSocketで`{type: 'resize', cols, rows}`が送信される
- [ ] 全テストが通る

---

#### タスク43.3: useTerminalフックのリサイズ機能実装

**ステータス**: `DONE`
**推定工数**: 30分
**依存関係**: タスク43.1, タスク43.2

**説明**:
- 対象ファイル: `src/hooks/useTerminal.ts`
- useClaudeTerminalと同様のリサイズ機能を実装

**実装手順（TDD）**:
1. テスト作成: `src/hooks/__tests__/useTerminal.test.ts`に同様のテストを追加
2. テスト実行: 失敗を確認
3. テストコミット
4. 実装: useClaudeTerminalと同じパターンで実装
5. 実装コミット

**受入基準**:
- [ ] useClaudeTerminalと同じリサイズ動作
- [ ] 全テストが通る

---

#### タスク43.4: PTYマネージャーのリサイズ対応

**ステータス**: `DONE`
**推定工数**: 30分
**依存関係**: タスク43.2

**説明**:
- 対象ファイル: `src/services/claude-pty-manager.ts`, `src/services/pty-manager.ts`
- WebSocketからのresizeメッセージを処理してPTYをリサイズ

**実装手順（TDD）**:
1. テスト作成: `src/services/__tests__/claude-pty-manager.test.ts`に以下を追加
   - resizeメッセージ受信時にpty.resize()が呼ばれることを確認
2. テスト実行: 失敗を確認
3. テストコミット
4. 実装: handleMessage内でtype='resize'を処理
5. 実装コミット

**受入基準**:
- [ ] `{type: 'resize', cols, rows}`メッセージを処理
- [ ] `pty.resize(cols, rows)`が呼ばれる
- [ ] 全テストが通る

---

### ストーリー19: Claudeセッション復帰機能

#### タスク43.5: ClaudePTYManagerの--resumeオプション対応

**ステータス**: `DONE`
**推定工数**: 45分

**説明**:
- 対象ファイル: `src/services/claude-pty-manager.ts`
- startClaude関数にresumeSessionIdオプションを追加
- Claude CLIの出力からセッションIDを抽出して保存

**実装手順（TDD）**:
1. テスト作成: `src/services/__tests__/claude-pty-manager.test.ts`に以下を追加
   - resumeSessionId指定時に`--resume`オプションが渡されることを確認
   - resumeSessionId未指定時は`--resume`が渡されないことを確認
   - Claude CLI出力からセッションIDが抽出されることを確認
2. テスト実行: 失敗を確認
3. テストコミット
4. 実装
5. 実装コミット

**技術的文脈**:
- Claude CLI: `claude --resume <session-id>`
- セッションIDパターン: `/session[:\s]+([a-f0-9-]+)/i` または `/\[worktree:[^]]+\]/` 形式

**受入基準**:
- [ ] StartOptionsにresumeSessionId追加
- [ ] --resumeオプションが正しく渡される
- [ ] セッションID抽出ロジックが動作する
- [ ] 全テストが通る

---

#### タスク43.6: resume APIエンドポイントの修正

**ステータス**: `DONE`
**推定工数**: 30分
**依存関係**: タスク43.5

**説明**:
- 対象ファイル: `src/app/api/sessions/[id]/resume/route.ts`
- resume_session_idを使用してセッションを再開

**実装手順（TDD）**:
1. テスト作成: `src/app/api/sessions/[id]/resume/__tests__/route.test.ts`
   - resume_session_id存在時に--resumeで起動されることを確認
   - resume_session_id未存在時に新規起動されることを確認
   - resumed_with_historyフラグが正しく返されることを確認
2. テスト実行: 失敗を確認
3. テストコミット
4. 実装
5. 実装コミット

**受入基準**:
- [ ] resume_session_id存在時に--resumeオプション使用
- [ ] レスポンスにresumed_with_historyを含む
- [ ] 全テストが通る

---

### ストーリー20: セッション一覧のTree表示化

#### タスク43.7: SessionTreeItemコンポーネントの作成

**ステータス**: `DONE`
**推定工数**: 30分

**説明**:
- 新規ファイル: `src/components/layout/SessionTreeItem.tsx`
- セッション名とステータスアイコンを表示するツリーノード

**実装手順（TDD）**:
1. テスト作成: `src/components/layout/__tests__/SessionTreeItem.test.tsx`
   - セッション名が表示されることを確認
   - ステータスアイコンが表示されることを確認
   - isActive=trueでハイライトされることを確認
   - クリック時にonClickが呼ばれることを確認
2. テスト実行: 失敗を確認
3. テストコミット
4. 実装
5. 実装コミット

**技術的文脈**:
- スタイリング: Tailwind CSS
- アイコン: SessionStatusIcon（既存）
- ハイライト: `bg-blue-50 dark:bg-blue-900/30`

**受入基準**:
- [ ] コンポーネントが作成される
- [ ] セッション名が表示される
- [ ] ステータスアイコンが表示される
- [ ] アクティブ状態でハイライト
- [ ] 全テストが通る

---

#### タスク43.8: ProjectTreeItemコンポーネントの作成

**ステータス**: `DONE`
**推定工数**: 40分
**依存関係**: タスク43.7

**説明**:
- 新規ファイル: `src/components/layout/ProjectTreeItem.tsx`
- プロジェクト名と展開/折りたたみ機能を持つツリーノード

**実装手順（TDD）**:
1. テスト作成: `src/components/layout/__tests__/ProjectTreeItem.test.tsx`
   - プロジェクト名が表示されることを確認
   - isExpanded=trueでセッションリストが表示されることを確認
   - isExpanded=falseでセッションリストが非表示であることを確認
   - クリック時にonToggleが呼ばれることを確認
   - 「+」ボタンが表示されることを確認
2. テスト実行: 失敗を確認
3. テストコミット
4. 実装
5. 実装コミット

**受入基準**:
- [ ] コンポーネントが作成される
- [ ] 展開/折りたたみが動作する
- [ ] 「+」ボタンが表示される
- [ ] 全テストが通る

---

#### タスク43.9: Sidebarコンポーネントの修正

**ステータス**: `DONE`
**推定工数**: 45分
**依存関係**: タスク43.7, タスク43.8

**説明**:
- 対象ファイル: `src/components/layout/Sidebar.tsx`
- ProjectTreeItemを使用したツリー表示に変更

**実装手順（TDD）**:
1. テスト作成: `src/components/layout/__tests__/Sidebar.test.tsx`を更新
   - プロジェクトごとにセッションがグループ化されることを確認
   - 展開状態が保持されることを確認
   - 現在のセッションがハイライトされることを確認
2. テスト実行: 失敗を確認
3. テストコミット
4. 実装
5. 実装コミット

**受入基準**:
- [ ] ProjectTreeItemを使用したツリー表示
- [ ] expandedProjects stateで展開状態管理
- [ ] currentSessionIdでハイライト
- [ ] 全テストが通る

---

#### タスク43.10: ストアにcurrentSessionId追加

**ステータス**: `DONE`
**推定工数**: 20分

**説明**:
- 対象ファイル: `src/store/index.ts`
- currentSessionIdとsetCurrentSessionIdを追加

**実装手順（TDD）**:
1. テスト作成: `src/store/__tests__/index.test.ts`に追加
   - setCurrentSessionIdでcurrentSessionIdが更新されることを確認
2. テスト実行: 失敗を確認
3. テストコミット
4. 実装
5. 実装コミット

**受入基準**:
- [ ] currentSessionIdが追加される
- [ ] setCurrentSessionIdアクションが動作する
- [ ] 全テストが通る

---

### ストーリー21: セッション作成の簡略化

#### タスク43.11: useSettingsStoreの作成

**ステータス**: `DONE`
**推定工数**: 25分

**説明**:
- 新規ファイル: `src/store/settings.ts`
- デフォルトモデル設定を管理するストア

**実装手順（TDD）**:
1. テスト作成: `src/store/__tests__/settings.test.ts`
   - 初期値がautoであることを確認
   - setDefaultModelで値が更新されることを確認
   - localStorageに永続化されることを確認
2. テスト実行: 失敗を確認
3. テストコミット
4. 実装
5. 実装コミット

**技術的文脈**:
- Zustand + persist middleware
- ストレージキー: `claudework:settings`

**受入基準**:
- [ ] defaultModelが管理される
- [ ] setDefaultModelが動作する
- [ ] localStorageに永続化される
- [ ] 全テストが通る

---

#### タスク43.12: QuickCreateButtonコンポーネントの作成

**ステータス**: `DONE`
**推定工数**: 35分
**依存関係**: タスク43.11

**説明**:
- 新規ファイル: `src/components/sessions/QuickCreateButton.tsx`
- ワンクリックでセッションを作成するボタン

**実装手順（TDD）**:
1. テスト作成: `src/components/sessions/__tests__/QuickCreateButton.test.tsx`
   - クリック時にcreateSessionが呼ばれることを確認
   - defaultModelが使用されることを確認
   - 作成中はローディング表示されることを確認
   - 成功時にonSuccessが呼ばれることを確認
2. テスト実行: 失敗を確認
3. テストコミット
4. 実装
5. 実装コミット

**受入基準**:
- [ ] ワンクリックでセッション作成
- [ ] ローディング状態表示
- [ ] エラー時にトースト表示
- [ ] 全テストが通る

---

#### タスク43.13: ModelSelectorコンポーネントの作成

**ステータス**: `DONE`
**推定工数**: 25分

**説明**:
- 新規ファイル: `src/components/common/ModelSelector.tsx`
- コンパクトモードとフルモードを持つモデル選択UI

**実装手順（TDD）**:
1. テスト作成: `src/components/common/__tests__/ModelSelector.test.tsx`
   - 4つのモデルオプションが表示されることを確認
   - compact=trueでselectが表示されることを確認
   - compact=falseでボタン群が表示されることを確認
   - 選択変更時にonChangeが呼ばれることを確認
2. テスト実行: 失敗を確認
3. テストコミット
4. 実装
5. 実装コミット

**受入基準**:
- [ ] コンパクトモード（select）
- [ ] フルモード（ボタン群）
- [ ] 選択状態のハイライト
- [ ] 全テストが通る

---

#### タスク43.14: SessionNameEditorコンポーネントの作成

**ステータス**: `DONE`
**推定工数**: 30分

**説明**:
- 新規ファイル: `src/components/sessions/SessionNameEditor.tsx`
- クリックで編集可能なセッション名表示

**実装手順（TDD）**:
1. テスト作成: `src/components/sessions/__tests__/SessionNameEditor.test.tsx`
   - 初期表示でセッション名が表示されることを確認
   - クリックで編集モードになることを確認
   - Enterキーで保存されることを確認
   - blurで保存されることを確認
   - 変更がない場合はAPIが呼ばれないことを確認
2. テスト実行: 失敗を確認
3. テストコミット
4. 実装
5. 実装コミット

**受入基準**:
- [ ] クリックで編集モード切り替え
- [ ] Enter/blurで保存
- [ ] 変更時のみAPI呼び出し
- [ ] 全テストが通る

---

#### タスク43.15: セッション作成APIのプロンプト任意化

**ステータス**: `DONE`
**推定工数**: 20分

**説明**:
- 対象ファイル: `src/app/api/projects/[id]/sessions/route.ts`
- プロンプトを必須から任意に変更

**実装手順（TDD）**:
1. テスト作成: `src/app/api/projects/[id]/sessions/__tests__/route.test.ts`
   - プロンプト未指定でも作成できることを確認
   - 既存のプロンプト指定動作が維持されることを確認
2. テスト実行: 失敗を確認
3. テストコミット
4. 実装
5. 実装コミット

**受入基準**:
- [ ] プロンプトがオプショナル
- [ ] デフォルト値は空文字列
- [ ] 既存動作が維持される
- [ ] 全テストが通る

---

#### タスク43.16: セッション名更新API（PATCH）の追加

**ステータス**: `DONE`
**推定工数**: 25分

**説明**:
- 対象ファイル: `src/app/api/sessions/[id]/route.ts`
- PATCHメソッドでセッション名を更新

**実装手順（TDD）**:
1. テスト作成: `src/app/api/sessions/[id]/__tests__/route.test.ts`
   - 有効な名前でセッション名が更新されることを確認
   - 空の名前で400エラーが返されることを確認
   - 存在しないセッションで404エラーが返されることを確認
2. テスト実行: 失敗を確認
3. テストコミット
4. 実装
5. 実装コミット

**受入基準**:
- [ ] PATCHメソッドが追加される
- [ ] 名前が更新される
- [ ] バリデーションが動作する
- [ ] 全テストが通る

---

### ストーリー22: ユーザーアクション要求時のブラウザ通知強化

#### タスク43.17: action-detector.tsの作成

**ステータス**: `DONE`
**推定工数**: 30分

**説明**:
- 新規ファイル: `src/lib/action-detector.ts`
- ANSIエスケープ除去とアクション要求パターン検出

**実装手順（TDD）**:
1. テスト作成: `src/lib/__tests__/action-detector.test.ts`
   - stripAnsiがANSIエスケープを除去することを確認
   - "Allow"/"Deny"パターンを検出することを確認
   - "Do you want to"パターンを検出することを確認
   - 通常のテキストでは検出されないことを確認
   - shouldNotifyが5秒以内の再呼び出しでfalseを返すことを確認
2. テスト実行: 失敗を確認
3. テストコミット
4. 実装
5. 実装コミット

**受入基準**:
- [ ] stripAnsi関数が動作する
- [ ] detectActionRequest関数が動作する
- [ ] shouldNotify関数が動作する（5秒クールダウン）
- [ ] 全テストが通る

---

#### タスク43.18: useClaudeTerminalへの通知機能統合

**ステータス**: `DONE`
**推定工数**: 35分
**依存関係**: タスク43.17

**説明**:
- 対象ファイル: `src/hooks/useClaudeTerminal.ts`
- ターミナル出力時にアクション要求を検出して通知

**実装手順（TDD）**:
1. テスト作成: `src/hooks/__tests__/useClaudeTerminal.test.ts`に追加
   - アクション要求検出時にsendNotificationが呼ばれることを確認
   - クールダウン期間内は通知されないことを確認
   - 通知設定がオフの場合は通知されないことを確認
2. テスト実行: 失敗を確認
3. テストコミット
4. 実装
5. 実装コミット

**受入基準**:
- [ ] 出力受信時にパターン検出
- [ ] 検出時に通知送信
- [ ] クールダウン動作
- [ ] 全テストが通る

---

#### タスク43.19: 通知サービスの拡張

**ステータス**: `DONE`
**推定工数**: 20分

**説明**:
- 対象ファイル: `src/lib/notification-service.ts`
- actionRequiredイベントタイプの追加

**実装手順（TDD）**:
1. テスト作成: `src/lib/__tests__/notification-service.test.ts`に追加
   - actionRequiredイベントが処理されることを確認
   - 設定でオフの場合は通知されないことを確認
2. テスト実行: 失敗を確認
3. テストコミット
4. 実装
5. 実装コミット

**受入基準**:
- [ ] actionRequiredイベントタイプ追加
- [ ] NotificationSettingsにonActionRequired追加
- [ ] 全テストが通る

---

#### タスク43.20: 通知設定UIの更新

**ステータス**: `DONE`
**推定工数**: 20分
**依存関係**: タスク43.19

**説明**:
- 対象ファイル: `src/components/common/NotificationSettings.tsx`
- アクション要求通知のトグル追加

**実装手順（TDD）**:
1. テスト作成: `src/components/common/__tests__/NotificationSettings.test.tsx`に追加
   - アクション要求のチェックボックスが表示されることを確認
   - トグル変更時にupdateSettingsが呼ばれることを確認
2. テスト実行: 失敗を確認
3. テストコミット
4. 実装
5. 実装コミット

**受入基準**:
- [ ] 「アクション要求時」チェックボックス追加
- [ ] 設定変更が反映される
- [ ] 全テストが通る

---

### 統合タスク

#### タスク43.21: 全機能の統合テスト

**ステータス**: `DONE`
**推定工数**: 60分
**依存関係**: タスク43.1〜43.20

**説明**:
- 全機能のE2Eテストを実施
- ブラウザでの動作確認

**実装手順**:
1. 開発サーバーを起動
2. 以下を手動テスト:
   - ターミナルリサイズ（ウィンドウリサイズ、タブ切り替え）
   - セッション再開（--resume動作確認）
   - サイドバーのツリー表示
   - ワンクリックセッション作成
   - セッション名編集
   - アクション要求時の通知

**受入基準**:
- [ ] ターミナルサイズがウィンドウに追従する
- [ ] セッション再開時に会話履歴が復元される
- [ ] サイドバーがツリー表示になっている
- [ ] ワンクリックでセッション作成できる
- [ ] セッション名を編集できる
- [ ] アクション要求時に通知が届く
- [ ] 全ユニットテストが通る
- [ ] Lintエラーがない

---

## 要件との整合性チェック

| 要件ID | 対応タスク |
|--------|-----------|
| REQ-114 | タスク43.2, 43.3 |
| REQ-115 | タスク43.2, 43.3 |
| REQ-116 | タスク43.2, 43.3 |
| REQ-117 | タスク43.2, 43.3, 43.4 |
| REQ-118 | タスク43.2, 43.3 |
| REQ-119 | タスク43.5, 43.6 |
| REQ-120 | タスク43.5, 43.6 |
| REQ-121 | タスク43.5 |
| REQ-122 | タスク43.5 |
| REQ-123 | タスク43.9 |
| REQ-124 | タスク43.8, 43.9 |
| REQ-125 | タスク43.7 |
| REQ-126 | タスク43.7, 43.10 |
| REQ-127 | タスク43.7 |
| REQ-128 | - (既存維持) |
| REQ-129 | タスク43.8, 43.12 |
| REQ-130 | タスク43.12, 43.15 |
| REQ-131 | タスク43.11, 43.12 |
| REQ-132 | タスク43.15 |
| REQ-133 | タスク43.14, 43.16 |
| REQ-134 | タスク43.11 |
| REQ-135 | タスク43.13 |
| REQ-136 | - (既存維持) |
| REQ-137 | タスク43.17, 43.18 |
| REQ-138 | タスク43.17 |
| REQ-139 | タスク43.17 |
| REQ-140 | タスク43.17 |
| REQ-141 | タスク43.18, 43.19 |

---

---

## Phase 44: UI/UX改善（セッション管理強化・通知修正・PR連携）

**関連要件**: REQ-142〜REQ-170, NFR-025〜NFR-032

### 概要

以下の5つの機能を実装:
1. ストーリー23: セッション一覧ページの廃止とTree表示への統一 (REQ-142〜145)
2. ストーリー24: Tree表示のデフォルト展開 (REQ-146〜149)
3. ストーリー25: セッション詳細ページからのセッション削除 (REQ-150〜155)
4. ストーリー26: アクション要求時ブラウザ通知の修正 (REQ-156〜160)
5. ストーリー27: セッション画面からのPR作成とリンク (REQ-161〜170)

---

### フェーズ1: セッション一覧ページの廃止（ストーリー23）

#### タスク44.1: /sessions/ページのリダイレクト実装

**ステータス**: `TODO`
**推定工数**: 10分

**説明**:
- 対象ファイル: `src/app/sessions/page.tsx`
- /sessions/パスにアクセスした場合、プロジェクト一覧ページ(/)にリダイレクト

**実装手順**:
1. `src/app/sessions/page.tsx`を修正
2. `redirect('/')`を使用してリダイレクト

**受入基準**:
- [ ] /sessions/にアクセスすると/にリダイレクトされる

---

#### タスク44.2: ナビゲーションからSessionsリンクを削除

**ステータス**: `TODO`
**推定工数**: 10分
**依存関係**: タスク44.1

**説明**:
- 対象ファイル: `src/components/layout/Header.tsx`または`Navigation.tsx`
- ナビゲーションメニューから「Sessions」リンクを削除

**実装手順**:
1. ナビゲーションコンポーネントを確認
2. Sessionsリンクを削除

**受入基準**:
- [ ] ナビゲーションにSessionsリンクが表示されない

---

### フェーズ2: Tree表示のデフォルト展開（ストーリー24）

#### タスク44.3: UIストアの作成

**ステータス**: `TODO`
**推定工数**: 20分

**説明**:
- 対象ファイル: `src/store/ui.ts`（新規）
- プロジェクト展開状態を管理するZustandストア
- ローカルストレージに永続化

**実装手順（TDD）**:
1. テスト作成: `src/store/__tests__/ui.test.ts`
   - isProjectExpanded()がデフォルトでtrueを返すことを確認
   - toggleProject()で状態が切り替わることを確認
   - persistで状態が保存されることを確認
2. テスト実行: 失敗を確認
3. テストコミット
4. 実装: `src/store/ui.ts`
5. 実装コミット

**受入基準**:
- [ ] `isProjectExpanded()`がデフォルトでtrueを返す
- [ ] `toggleProject()`で展開/折りたたみを切り替えられる
- [ ] 状態がローカルストレージに永続化される
- [ ] 全テストが通る

---

#### タスク44.4: Sidebarのデフォルト展開対応

**ステータス**: `TODO`
**推定工数**: 15分
**依存関係**: タスク44.3

**説明**:
- 対象ファイル: `src/components/layout/Sidebar.tsx`
- useUIStoreを使用してデフォルト展開を実現

**実装手順**:
1. `useUIStore`をインポート
2. `isProjectExpanded()`を使用
3. プロジェクトノードのクリックで`toggleProject()`を呼び出し

**受入基準**:
- [ ] ページ読み込み時にプロジェクトが展開されている
- [ ] クリックで折りたたみ/展開が切り替わる
- [ ] 状態が永続化される

---

### フェーズ3: セッション詳細ページからの削除機能（ストーリー25）

#### タスク44.5: DeleteSessionDialogコンポーネントの作成

**ステータス**: `TODO`
**推定工数**: 30分

**説明**:
- 対象ファイル: `src/components/sessions/DeleteSessionDialog.tsx`（新規）
- 確認ダイアログ、セッション名/パス表示、削除処理

**実装手順（TDD）**:
1. テスト作成: `src/components/sessions/__tests__/DeleteSessionDialog.test.tsx`
   - ダイアログが表示されることを確認
   - セッション名とパスが表示されることを確認
   - キャンセルでダイアログが閉じることを確認
   - 削除でAPIが呼ばれることを確認
2. テスト実行: 失敗を確認
3. テストコミット
4. 実装
5. 実装コミット

**受入基準**:
- [ ] 確認ダイアログが表示される
- [ ] セッション名とworktreeパスが表示される
- [ ] Escキーでキャンセルできる
- [ ] 削除ボタンでDELETE APIが呼ばれる
- [ ] 削除成功後にプロジェクトページにリダイレクト
- [ ] エラー時にトースト通知が表示される
- [ ] 全テストが通る

---

#### タスク44.6: DeleteSessionButtonコンポーネントの作成

**ステータス**: `TODO`
**推定工数**: 15分
**依存関係**: タスク44.5

**説明**:
- 対象ファイル: `src/components/sessions/DeleteSessionButton.tsx`（新規）
- 削除ボタンとダイアログの制御

**実装手順**:
1. ボタンコンポーネント作成
2. DeleteSessionDialogとの連携

**受入基準**:
- [ ] 削除ボタンが赤色で表示される
- [ ] クリックで確認ダイアログが開く

---

#### タスク44.7: セッション詳細ページに削除ボタンを追加

**ステータス**: `TODO`
**推定工数**: 15分
**依存関係**: タスク44.6

**説明**:
- 対象ファイル: `src/app/sessions/[id]/page.tsx`
- ヘッダー部分にDeleteSessionButtonを追加

**実装手順**:
1. DeleteSessionButtonをインポート
2. ヘッダー部分に配置

**受入基準**:
- [ ] セッション詳細ページに削除ボタンが表示される
- [ ] 削除が正常に動作する

---

### フェーズ4: アクション要求時ブラウザ通知の修正（ストーリー26）

#### タスク44.8: action-detector.tsのパターン改善

**ステータス**: `TODO`
**推定工数**: 25分

**説明**:
- 対象ファイル: `src/lib/action-detector.ts`
- ANSIエスケープ除去の強化
- 検出パターンの追加

**実装手順（TDD）**:
1. テスト作成: `src/lib/__tests__/action-detector.test.ts`を拡張
   - 新しいパターン検出テスト追加
   - ANSIエスケープ除去テスト追加
2. テスト実行: 失敗を確認
3. テストコミット
4. 実装: stripAnsi()改善、ACTION_PATTERNS拡張
5. 実装コミット

**受入基準**:
- [ ] `stripAnsi()`がCSI, OSC, DCS等を除去できる
- [ ] `Allow|Deny`パターンを検出できる
- [ ] `Yes to confirm`パターンを検出できる
- [ ] 短すぎる出力は無視される
- [ ] 全テストが通る

---

#### タスク44.9: useClaudeTerminalの通知統合確認

**ステータス**: `TODO`
**推定工数**: 15分
**依存関係**: タスク44.8

**説明**:
- 対象ファイル: `src/hooks/useClaudeTerminal.ts`
- detectActionRequestとsendNotificationの統合確認
- notificationCooldownRefが正しく機能することを確認

**実装手順**:
1. 既存コードを確認
2. 必要に応じて修正

**受入基準**:
- [ ] アクション要求パターン検出時に通知が送信される
- [ ] 5秒以内の重複通知が抑制される
- [ ] バックグラウンド時のみOS通知が送信される

---

### フェーズ5: PR作成機能（ストーリー27）

#### タスク44.10: Prismaスキーマ更新（PR関連フィールド追加）

**ステータス**: `TODO`
**推定工数**: 15分

**説明**:
- 対象ファイル: `prisma/schema.prisma`
- Sessionモデルにpr_url, pr_number, pr_status, pr_updated_atを追加

**実装手順**:
1. スキーマにフィールド追加
2. `npx prisma db push`で適用
3. `npx prisma generate`でクライアント再生成

**受入基準**:
- [ ] Sessionモデルにpr_url, pr_number, pr_status, pr_updated_atが追加される
- [ ] マイグレーションが成功する

---

#### タスク44.11: PR作成APIエンドポイントの実装

**ステータス**: `TODO`
**推定工数**: 40分
**依存関係**: タスク44.10

**説明**:
- 対象ファイル: `src/app/api/sessions/[id]/pr/route.ts`（新規）
- POST: PR作成（gh pr create）
- GET: PRステータス取得

**実装手順（TDD）**:
1. テスト作成: `src/app/api/sessions/[id]/pr/__tests__/route.test.ts`
   - POST成功時の動作
   - gh CLI未インストール時のエラー
   - GET成功時の動作
2. テスト実行: 失敗を確認
3. テストコミット
4. 実装
5. 実装コミット

**受入基準**:
- [ ] POST /api/sessions/{id}/prでPRが作成される
- [ ] PRのURLとnumberがDBに保存される
- [ ] gh CLI未インストール時に503エラーが返る
- [ ] GET /api/sessions/{id}/prでPRステータスが取得できる
- [ ] 全テストが通る

---

#### タスク44.12: PRSectionコンポーネントの作成

**ステータス**: `TODO`
**推定工数**: 30分
**依存関係**: タスク44.11

**説明**:
- 対象ファイル: `src/components/sessions/PRSection.tsx`（新規）
- PRリンク表示、ステータスバッジ、作成ボタン

**実装手順（TDD）**:
1. テスト作成: `src/components/sessions/__tests__/PRSection.test.tsx`
   - PR未作成時に作成ボタンが表示される
   - PR作成済み時にリンクが表示される
   - ステータスバッジが正しく表示される
2. テスト実行: 失敗を確認
3. テストコミット
4. 実装
5. 実装コミット

**受入基準**:
- [ ] PR未作成時に「PRを作成」ボタンが表示される
- [ ] PR作成済み時にPRリンクが表示される
- [ ] PRステータス（open/merged/closed）がバッジで表示される
- [ ] gh CLI未利用時にボタンが無効化される
- [ ] 全テストが通る

---

#### タスク44.13: CreatePRDialogコンポーネントの作成

**ステータス**: `TODO`
**推定工数**: 30分
**依存関係**: タスク44.11

**説明**:
- 対象ファイル: `src/components/sessions/CreatePRDialog.tsx`（新規）
- タイトル・説明入力フォーム、ブランチ名表示

**実装手順（TDD）**:
1. テスト作成: `src/components/sessions/__tests__/CreatePRDialog.test.tsx`
   - フォームが表示される
   - タイトル必須バリデーション
   - 作成ボタンでAPIが呼ばれる
   - 成功時にonSuccessコールバック
2. テスト実行: 失敗を確認
3. テストコミット
4. 実装
5. 実装コミット

**受入基準**:
- [ ] タイトル入力フィールドがある
- [ ] 説明入力フィールドがある
- [ ] ソースブランチ名が表示される
- [ ] タイトル未入力時にエラーが表示される
- [ ] 作成中はローディング表示
- [ ] 全テストが通る

---

#### タスク44.14: セッション詳細ページにPRSectionを追加

**ステータス**: `TODO`
**推定工数**: 15分
**依存関係**: タスク44.12, タスク44.13

**説明**:
- 対象ファイル: `src/app/sessions/[id]/page.tsx`
- PRSectionコンポーネントを配置

**実装手順**:
1. PRSectionをインポート
2. 適切な位置に配置（ヘッダー下部など）

**受入基準**:
- [ ] セッション詳細ページにPRセクションが表示される
- [ ] PR作成・リンク表示が正常に動作する

---

### 統合タスク

#### タスク44.15: 全機能の統合テスト

**ステータス**: `TODO`
**推定工数**: 60分
**依存関係**: タスク44.1〜44.14

**説明**:
- 全機能のE2Eテストを実施
- ブラウザでの動作確認

**実装手順**:
1. 開発サーバーを起動
2. 以下を手動テスト:
   - /sessions/へのアクセスがリダイレクトされる
   - ナビゲーションにSessionsリンクがない
   - サイドバーがデフォルトで展開されている
   - 展開状態が永続化される
   - セッション詳細ページから削除できる
   - 削除確認ダイアログが表示される
   - アクション要求時に通知が届く
   - PRを作成できる
   - PRリンクが表示される

**受入基準**:
- [ ] /sessions/が/にリダイレクトされる
- [ ] ナビゲーションにSessionsリンクがない
- [ ] サイドバーがデフォルトで展開されている
- [ ] 折りたたみ状態がリロード後も維持される
- [ ] セッション削除が確認ダイアログ付きで動作する
- [ ] 削除後にプロジェクトページにリダイレクトされる
- [ ] アクション要求時に通知が届く（バックグラウンド時）
- [ ] PRを作成できる（gh CLI利用可能時）
- [ ] PRリンクとステータスが表示される
- [ ] 全ユニットテストが通る
- [ ] Lintエラーがない

---

## 要件との整合性チェック（Phase 44）

| 要件ID | 対応タスク |
|--------|-----------|
| REQ-142 | タスク44.1 |
| REQ-143 | タスク44.2 |
| REQ-144 | 既存実装維持 |
| REQ-145 | 既存実装維持 |
| REQ-146 | タスク44.3, 44.4 |
| REQ-147 | タスク44.3 |
| REQ-148 | タスク44.3 |
| REQ-149 | タスク44.3 |
| REQ-150 | タスク44.6, 44.7 |
| REQ-151 | タスク44.5 |
| REQ-152 | タスク44.5 |
| REQ-153 | タスク44.5 |
| REQ-154 | タスク44.5 |
| REQ-155 | タスク44.5 |
| REQ-156 | タスク44.8, 44.9 |
| REQ-157 | タスク44.8 |
| REQ-158 | タスク44.8 |
| REQ-159 | タスク44.9 |
| REQ-160 | タスク44.8 |
| REQ-161 | タスク44.12 |
| REQ-162 | タスク44.13 |
| REQ-163 | タスク44.13 |
| REQ-164 | タスク44.13 |
| REQ-165 | タスク44.11 |
| REQ-166 | タスク44.11 |
| REQ-167 | タスク44.12 |
| REQ-168 | タスク44.12 |
| REQ-169 | タスク44.12 |
| REQ-170 | タスク44.12 |

---

## 今後の改善予定

Phase 44完了後は、以下の追加改善を検討:
- ターミナルの最小サイズ制約
- セッション名の自動サジェスト
- PRテンプレートのカスタマイズ
- PRコメントの表示

**検証レポート**: `docs/verification-issues.md`

---

## Phase 45: 認証機能の削除（ストーリー28）

**関連要件**: REQ-171〜REQ-177

### 概要

シングルユーザー向けアプリケーションとして、認証機能を完全に削除する。これにより：
- コードベースの簡略化
- ログイン手順の省略による利便性向上
- メンテナンス負荷の軽減

### 変更サマリ

| カテゴリ | 対象 | 数量 |
|---------|------|------|
| 削除ファイル | ログインページ、認証API、AuthGuard、auth.ts、auth-middleware.ts | 7 |
| 修正ファイル | ストア、Header、ページ、APIルート、server.ts、schema.prisma | 約30 |

---

### フェーズ1: バックエンド認証コードの削除

#### タスク45.1: 認証APIルートの削除

**ステータス**: `DONE`
**推定工数**: 10分

**説明**:
- 削除対象ディレクトリ: `src/app/api/auth/`
- 含まれるファイル:
  - `src/app/api/auth/login/route.ts`
  - `src/app/api/auth/logout/route.ts`
  - `src/app/api/auth/session/route.ts`

**実装手順**:
```bash
rm -rf src/app/api/auth/
```

**受入基準**:
- [ ] `src/app/api/auth/`ディレクトリが削除される
- [ ] 関連テストファイルも削除される

---

#### タスク45.2: 認証ライブラリの削除

**ステータス**: `DONE`
**推定工数**: 10分
**依存関係**: タスク45.3

**説明**:
- 削除対象ファイル:
  - `src/lib/auth.ts`
  - `src/lib/websocket/auth-middleware.ts`
- 関連テストファイルも削除

**実装手順**:
```bash
rm src/lib/auth.ts
rm src/lib/websocket/auth-middleware.ts
rm -rf src/lib/__tests__/auth.test.ts
rm -rf src/lib/websocket/__tests__/auth-middleware.test.ts
```

**受入基準**:
- [ ] 認証関連ライブラリファイルが削除される
- [ ] 関連テストファイルも削除される

---

#### タスク45.3: 全APIルートから認証チェックを削除

**ステータス**: `DONE`
**推定工数**: 45分

**説明**:
- 対象ファイル: 全APIルート（約20ファイル）
- 各ファイルから以下のパターンを削除:
  - `import { getSession } from '@/lib/auth';` の削除
  - `sessionId`のcookieチェック処理の削除
  - `Unauthorized` (401) レスポンスの削除

**対象ファイル一覧**:
1. `src/app/api/projects/route.ts`
2. `src/app/api/projects/[project_id]/route.ts`
3. `src/app/api/projects/[project_id]/scripts/route.ts`
4. `src/app/api/projects/[project_id]/scripts/[scriptId]/route.ts`
5. `src/app/api/projects/[project_id]/sessions/route.ts`
6. `src/app/api/sessions/[id]/route.ts`
7. `src/app/api/sessions/[id]/commits/route.ts`
8. `src/app/api/sessions/[id]/diff/route.ts`
9. `src/app/api/sessions/[id]/input/route.ts`
10. `src/app/api/sessions/[id]/merge/route.ts`
11. `src/app/api/sessions/[id]/messages/route.ts`
12. `src/app/api/sessions/[id]/rebase/route.ts`
13. `src/app/api/sessions/[id]/reset/route.ts`
14. `src/app/api/sessions/[id]/stop/route.ts`
15. `src/app/api/sessions/[id]/process/route.ts`
16. `src/app/api/sessions/[id]/resume/route.ts`
17. `src/app/api/sessions/[id]/approve/route.ts`
18. `src/app/api/sessions/[id]/run/route.ts`
19. `src/app/api/sessions/[id]/run/[run_id]/stop/route.ts`
20. `src/app/api/sessions/[id]/pr/route.ts`
21. `src/app/api/prompts/route.ts`
22. `src/app/api/prompts/[id]/route.ts`

**変更パターン**:
```typescript
// 削除前
export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get('sessionId')?.value;
  if (!sessionId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // ... 処理
}

// 削除後
export async function GET(request: NextRequest) {
  // 認証チェックなし、直接処理を実行
  // ... 処理
}
```

**受入基準**:
- [ ] 全APIルートから認証チェックコードが削除される
- [ ] `import { getSession } from '@/lib/auth';`が削除される
- [ ] 401レスポンスが削除される
- [ ] APIが認証なしでアクセス可能になる

---

#### タスク45.4: server.tsからWebSocket認証を削除

**ステータス**: `DONE`
**推定工数**: 20分
**依存関係**: タスク45.2

**説明**:
- 対象ファイル: `server.ts`
- WebSocket認証ミドルウェアのインポートと使用を削除
- 環境変数の必須チェックから`CLAUDE_WORK_TOKEN`と`SESSION_SECRET`を削除

**変更内容**:
1. `authenticateWebSocket`のインポートを削除
2. WebSocket接続時の認証チェックを削除
3. 環境変数の必須チェックを修正:
   ```typescript
   // 変更前
   const requiredEnvVars = ['CLAUDE_WORK_TOKEN', 'SESSION_SECRET', 'DATABASE_URL'];
   // 変更後
   const requiredEnvVars = ['DATABASE_URL'];
   ```

**受入基準**:
- [ ] WebSocket認証が削除される
- [ ] 環境変数チェックが修正される
- [ ] サーバーがCLAUDE_WORK_TOKENなしで起動できる

---

### フェーズ2: フロントエンド認証コードの削除

#### タスク45.5: ログインページの削除とリダイレクト設定

**ステータス**: `DONE`
**推定工数**: 15分

**説明**:
- 削除対象: `src/app/login/page.tsx`
- middlewareで/loginへのアクセスを/にリダイレクト

**実装手順**:
1. `src/app/login/page.tsx`を削除
2. `src/middleware.ts`を修正:
   ```typescript
   import { NextResponse } from 'next/server';
   import type { NextRequest } from 'next/server';

   export function middleware(request: NextRequest) {
     // /loginへのアクセスは/にリダイレクト
     if (request.nextUrl.pathname === '/login') {
       return NextResponse.redirect(new URL('/', request.url));
     }
     return NextResponse.next();
   }

   export const config = {
     matcher: ['/login'],
   };
   ```

**受入基準**:
- [ ] ログインページが削除される
- [ ] /loginにアクセスすると/にリダイレクトされる

---

#### タスク45.6: AuthGuardコンポーネントの削除

**ステータス**: `DONE`
**推定工数**: 10分

**説明**:
- 削除対象: `src/components/AuthGuard.tsx`
- 関連テストファイルも削除

**実装手順**:
```bash
rm src/components/AuthGuard.tsx
rm -rf src/components/__tests__/AuthGuard.test.tsx
```

**受入基準**:
- [ ] AuthGuardコンポーネントが削除される
- [ ] 関連テストファイルも削除される

---

#### タスク45.7: ストアから認証関連状態を削除

**ステータス**: `DONE`
**推定工数**: 20分

**説明**:
- 対象ファイル: `src/store/index.ts`
- 削除する状態:
  - `isAuthenticated`
  - `token`
  - `sessionId`
  - `expiresAt`
- 削除するアクション:
  - `login`
  - `logout`
  - `checkAuth`

**受入基準**:
- [ ] 認証関連の状態が削除される
- [ ] 認証関連のアクションが削除される
- [ ] ストアのテストが更新される
- [ ] 型定義から認証関連を削除

---

#### タスク45.8: Headerからログアウトボタンを削除

**ステータス**: `DONE`
**推定工数**: 15分
**依存関係**: タスク45.7

**説明**:
- 対象ファイル: `src/components/layout/Header.tsx`
- ログアウトボタンと関連するストア呼び出しを削除

**受入基準**:
- [ ] ログアウトボタンが削除される
- [ ] 認証状態に基づく条件分岐が削除される
- [ ] Headerのテストが更新される

---

#### タスク45.9: ページコンポーネントからAuthGuardを削除

**ステータス**: `DONE`
**推定工数**: 20分
**依存関係**: タスク45.6

**説明**:
- 対象ファイル:
  - `src/app/page.tsx`
  - `src/app/sessions/[id]/page.tsx`
  - `src/app/projects/[id]/page.tsx`
  - `src/app/projects/[id]/settings/page.tsx`
  - `src/app/projects/page.tsx`
- 各ファイルからAuthGuardラッパーを削除

**変更パターン**:
```tsx
// 変更前
export default function Page() {
  return (
    <AuthGuard>
      <MainLayout>
        <Content />
      </MainLayout>
    </AuthGuard>
  );
}

// 変更後
export default function Page() {
  return (
    <MainLayout>
      <Content />
    </MainLayout>
  );
}
```

**受入基準**:
- [ ] 全ページからAuthGuardが削除される
- [ ] ページが認証なしで表示される

---

### フェーズ3: データベース・環境変数の更新

#### タスク45.10: Prismaスキーマからfrom AuthSessionを削除

**ステータス**: `DONE`
**推定工数**: 15分

**説明**:
- 対象ファイル: `prisma/schema.prisma`
- AuthSessionモデルを削除

**変更内容**:
```prisma
// 削除
model AuthSession {
  id         String   @id @default(uuid())
  token_hash String
  expires_at DateTime
  created_at DateTime @default(now())
}
```

**実装手順**:
1. schema.prismaからAuthSessionモデルを削除
2. `npx prisma db push`で適用
3. `npx prisma generate`でクライアント再生成

**受入基準**:
- [ ] AuthSessionモデルが削除される
- [ ] マイグレーションが成功する
- [ ] Prismaクライアントが再生成される

---

#### タスク45.11: 環境変数ドキュメントの更新

**ステータス**: `DONE`
**推定工数**: 10分

**説明**:
- 対象ファイル:
  - `.env.example`
  - `docs/ENV_VARS.md`
  - `CLAUDE.md`
- CLAUDE_WORK_TOKENとSESSION_SECRETをオプションに変更

**受入基準**:
- [ ] `.env.example`が更新される
- [ ] ドキュメントが更新される
- [ ] 環境変数が必須でないことが明記される

---

### フェーズ4: テストとクリーンアップ

#### タスク45.12: 認証関連テストの削除・更新

**ステータス**: `DONE`
**推定工数**: 30分
**依存関係**: タスク45.1〜45.11

**説明**:
- 認証関連のテストファイルを削除
- 残存するテストから認証関連のモックを削除
- 全テストが通ることを確認

**対象**:
- `src/lib/__tests__/auth.test.ts` - 削除
- `src/lib/websocket/__tests__/auth-middleware.test.ts` - 削除
- `src/components/__tests__/AuthGuard.test.tsx` - 削除
- `src/store/__tests__/index.test.ts` - 認証関連テストを削除
- APIルートテスト - 認証モックを削除

**受入基準**:
- [ ] 認証関連テストファイルが削除される
- [ ] 残存テストから認証モックが削除される
- [ ] `npm test`が全て通る

---

#### タスク45.13: ビルドとLint確認

**ステータス**: `DONE`
**推定工数**: 15分
**依存関係**: タスク45.12

**説明**:
- ビルドが成功することを確認
- Lintエラーがないことを確認
- 未使用インポートを削除

**実装手順**:
```bash
npm run lint
npm run build
```

**受入基準**:
- [ ] `npm run lint`がエラーなし
- [ ] `npm run build`が成功
- [ ] 未使用インポートがない

---

#### タスク45.14: 動作確認

**ステータス**: `DONE`
**推定工数**: 20分
**依存関係**: タスク45.13

**説明**:
- 開発サーバーを起動して動作確認
- 以下を確認:
  - ルートURLに直接アクセスできる
  - 全ページが認証なしで表示される
  - 全APIが認証なしで動作する
  - WebSocketが認証なしで接続できる
  - /loginがリダイレクトされる

**受入基準**:
- [ ] ルートURL(/)に認証なしでアクセスできる
- [ ] 全ページが表示される
- [ ] 全APIが動作する
- [ ] WebSocketが接続できる
- [ ] /loginが/にリダイレクトされる
- [ ] ログアウトボタンが表示されない

---

## 要件との整合性チェック（Phase 45）

| 要件ID | 対応タスク | 確認内容 |
|--------|-----------|----------|
| REQ-171 | タスク45.9, 45.14 | ルートURLに認証なしでアクセス可能 |
| REQ-172 | タスク45.3 | 全APIから認証チェック削除 |
| REQ-173 | タスク45.4 | WebSocket認証チェック削除 |
| REQ-174 | タスク45.8 | ログアウトボタン非表示 |
| REQ-175 | タスク45.5 | /loginが/にリダイレクト |
| REQ-176 | タスク45.10 | AuthSessionテーブル削除 |
| REQ-177 | タスク45.4, 45.11 | 環境変数がオプション化 |

---

## 注意事項

- 認証削除後はネットワーク境界での保護（VPN、ファイアウォール等）を推奨
- 将来的に認証が必要になった場合は、OAuth/OIDC等の標準的な認証方式を検討
