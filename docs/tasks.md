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

## 今後の改善予定

Phase 43完了後は、以下の追加改善を検討:
- ターミナルの最小サイズ制約
- セッション名の自動サジェスト
- ツリー展開状態の永続化

**検証レポート**: `docs/verification-issues.md`
