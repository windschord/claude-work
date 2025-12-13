### タスク3.5: セッション詳細画面実装

**説明**:
Claude Codeとの対話画面を実装する
- メッセージ履歴表示
- ユーザー入力フォーム
- 権限確認ダイアログ（承認/拒否ボタン）
- セッション停止ボタン

**技術的文脈**:
- Next.js 14 App Router
- React 18、TypeScript strict mode
- Zustand 4.xでメッセージ状態管理
- Headless UI 2.x でダイアログ
- Tailwind CSSでスタイリング
- WebSocket接続は次フェーズ（タスク4.2）で実装
- 初期実装はREST APIでポーリング（3秒間隔）

**必要なパッケージ**:
```bash
# Headless UIは既にインストール済み
# 追加パッケージなし
```

**実装ファイル**:
- `src/app/sessions/[id]/page.tsx` - セッション詳細ページ
- `src/components/session/MessageList.tsx` - メッセージ履歴コンポーネント
- `src/components/session/MessageBubble.tsx` - メッセージバブルコンポーネント
- `src/components/session/InputForm.tsx` - ユーザー入力フォーム
- `src/components/session/PermissionDialog.tsx` - 権限確認ダイアログ
- `src/app/sessions/__tests__/[id].test.tsx` - セッション詳細ページテスト
- `src/components/session/__tests__/MessageList.test.tsx` - メッセージリストテスト
- `src/components/session/__tests__/PermissionDialog.test.tsx` - ダイアログテスト

**実装手順（TDD）**:
1. **テスト作成フェーズ**:
   - `src/app/sessions/__tests__/[id].test.tsx`作成
     - メッセージ履歴表示
     - 入力フォーム表示
     - セッション停止ボタン表示
   - `src/components/session/__tests__/MessageList.test.tsx`作成
     - ユーザー・アシスタントメッセージ表示
     - 自動スクロール
   - `src/components/session/__tests__/PermissionDialog.test.tsx`作成
     - 権限確認メッセージ表示
     - 承認/拒否ボタンクリック
   - テスト実行: `npm test` → すべて失敗することを確認
   - コミット: "Add session detail tests"

2. **実装フェーズ**:
   - `src/store/sessions.ts`拡張
     - `messages: Message[]`ステート追加
     - `fetchSessionDetail(id: string): Promise<void>` - GET /api/sessions/{id}
     - `sendMessage(sessionId: string, content: string): Promise<void>` - POST /api/sessions/{id}/input
     - `approvePermission(sessionId: string, approved: boolean): Promise<void>` - POST /api/sessions/{id}/approve
     - `stopSession(sessionId: string): Promise<void>` - POST /api/sessions/{id}/stop
   - `src/components/session/MessageBubble.tsx`作成
     - ユーザーメッセージ: 右側、青背景
     - アシスタントメッセージ: 左側、グレー背景
     - タイムスタンプ表示
   - `src/components/session/MessageList.tsx`作成
     - `MessageBubble`をマップして表示
     - `useRef`で自動スクロール
     - 空の場合: "メッセージがありません"
   - `src/components/session/InputForm.tsx`作成
     - テキストエリア: `<textarea placeholder="メッセージを入力" />`
     - 送信ボタン: Enter キーで送信（Shift+Enterで改行）
     - `sendMessage()`呼び出し
   - `src/components/session/PermissionDialog.tsx`作成
     - Headless UI `Dialog`使用
     - 権限内容表示
     - 「承認」「拒否」ボタン
     - `approvePermission()`呼び出し
   - `src/app/sessions/[id]/page.tsx`作成
     - `AuthGuard`で保護
     - `useParams()`でsessionId取得
     - `useEffect()`で`fetchSessionDetail(sessionId)`呼び出し
     - ポーリング: `setInterval()`で3秒ごとに`fetchSessionDetail()`
     - `MessageList`、`InputForm`、停止ボタン表示
     - 権限リクエスト時に`PermissionDialog`表示
   - テスト実行: `npm test` → すべて通過することを確認
   - コミット: "Implement session detail UI with polling"

**UI仕様**:

**MessageBubble**:
- ユーザー: `bg-blue-500 text-white rounded-lg p-3 max-w-[70%] ml-auto`
- アシスタント: `bg-gray-200 text-gray-900 rounded-lg p-3 max-w-[70%]`
- タイムスタンプ: `text-xs text-gray-500 mt-1`

**InputForm**:
- テキストエリア: `border rounded-lg p-2 resize-none`、高さ80px
- 送信ボタン: 右下、プライマリカラー
- Enter: 送信、Shift+Enter: 改行
- 送信中: ボタン無効化、スピナー表示

**PermissionDialog**:
- タイトル: "権限の確認"
- メッセージ: "Claude Codeが次の操作を実行しようとしています: {action}"
- ボタン: 「承認」（緑）、「拒否」（赤）

**停止ボタン**:
- 位置: 右上
- デザイン: `bg-red-500 text-white rounded px-4 py-2`
- テキスト: "セッション停止"

**Zustandストア拡張**:
```typescript
interface SessionState {
  // ... 既存のプロパティ
  messages: Message[];
  permissionRequest: PermissionRequest | null;
  fetchSessionDetail: (id: string) => Promise<void>; // GET /api/sessions/{id}
  sendMessage: (sessionId: string, content: string) => Promise<void>; // POST /api/sessions/{id}/input
  approvePermission: (sessionId: string, approved: boolean) => Promise<void>; // POST /api/sessions/{id}/approve
  stopSession: (sessionId: string) => Promise<void>; // POST /api/sessions/{id}/stop
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface PermissionRequest {
  requestId: string;
  action: string;
  details: string;
}
```

**ポーリング仕様**:
- 間隔: 3秒
- 条件: セッションが`running`または`waiting_input`状態の時のみ
- クリーンアップ: コンポーネントアンマウント時に`clearInterval()`

**エラーハンドリング**:
- メッセージ送信失敗: "メッセージの送信に失敗しました"
- セッション停止失敗: "セッションの停止に失敗しました"
- ネットワークエラー: "ネットワークエラーが発生しました"

**受入基準**:
- [ ] `src/app/sessions/[id]/page.tsx`が存在する
- [ ] `src/components/session/MessageList.tsx`が存在する
- [ ] `src/components/session/MessageBubble.tsx`が存在する
- [ ] `src/components/session/InputForm.tsx`が存在する
- [ ] `src/components/session/PermissionDialog.tsx`が存在する
- [ ] `src/store/sessions.ts`に4つの関数が実装されている
- [ ] メッセージ履歴が表示される
- [ ] ユーザー・アシスタントメッセージが区別される
- [ ] ユーザー入力を送信できる
- [ ] Enterキーで送信、Shift+Enterで改行
- [ ] 権限確認ダイアログが表示される
- [ ] 承認/拒否ボタンが機能する
- [ ] セッション停止ボタンが機能する
- [ ] 3秒ごとにポーリングされる
- [ ] メッセージが自動スクロールする
- [ ] テストファイル3つが存在する
- [ ] 全テストが通過する（`npm test`）
- [ ] ESLintエラーがゼロである（`npm run lint`）
- [ ] テストのみのコミットと実装のコミットが分かれている

**依存関係**:
- タスク1.2（フロントエンド基本設定）完了
- タスク2.5（セッションAPI実装）完了
- タスク3.4（セッション管理画面実装）完了
- `src/store/sessions.ts`が存在すること

**推定工数**: 50分（AIエージェント作業時間）
- テスト作成・コミット: 18分
- 実装・テスト通過・コミット: 32分

**ステータス**: `TODO`

---

### タスク3.6: Diff表示画面実装

**説明**:
Git diffの表示機能を実装する
- ファイル一覧サイドバー
- diff表示（追加行緑、削除行赤）
- ファイル選択でそのファイルのdiff表示

**技術的文脈**:
- Next.js 14 App Router
- React 18、TypeScript strict mode
- react-diff-viewer-continued 3.x でdiff表示
- Tailwind CSSでスタイリング
- unified diff形式

**必要なパッケージ**:
```bash
npm install react-diff-viewer-continued
```

**実装ファイル**:
- `src/components/git/DiffViewer.tsx` - diffビューワーコンポーネント
- `src/components/git/FileList.tsx` - 変更ファイル一覧コンポーネント
- `src/components/git/__tests__/DiffViewer.test.tsx` - diffビューワーテスト
- `src/components/git/__tests__/FileList.test.tsx` - ファイル一覧テスト
- セッション詳細ページにDiffタブ追加

**実装手順（TDD）**:
1. **テスト作成フェーズ**:
   - `src/components/git/__tests__/FileList.test.tsx`作成
     - ファイル一覧表示
     - ファイル選択
     - 変更種別アイコン（追加/変更/削除）
   - `src/components/git/__tests__/DiffViewer.test.tsx`作成
     - diff表示
     - 追加行が緑、削除行が赤
   - テスト実行: `npm test` → すべて失敗することを確認
   - コミット: "Add diff viewer tests"

2. **実装フェーズ**:
   - `src/store/sessions.ts`拡張
     - `diff: DiffData | null`ステート追加
     - `fetchDiff(sessionId: string): Promise<void>` - GET /api/sessions/{id}/diff
     - `selectedFile: string | null`ステート追加
     - `selectFile(path: string): void`
   - `src/components/git/FileList.tsx`作成
     - ファイル一覧表示
     - 変更種別アイコン: added（+）、modified（~）、deleted（-）
     - ファイル選択で`selectFile()`呼び出し
     - 選択中ファイルをハイライト
   - `src/components/git/DiffViewer.tsx`作成
     - react-diff-viewer-continued使用
     - `oldValue`と`newValue`を渡す
     - `splitView={false}`でunified表示
     - スタイル: ダーク/ライトモード対応
   - `src/app/sessions/[id]/page.tsx`更新
     - タブ: 「対話」「Diff」
     - Diffタブ: `FileList`と`DiffViewer`表示
     - `useEffect()`で`fetchDiff(sessionId)`呼び出し
   - テスト実行: `npm test` → すべて通過することを確認
   - コミット: "Implement diff viewer with react-diff-viewer-continued"

**UI仕様**:

**FileList**:
- サイドバー: 幅250px、スクロール可能
- ファイル項目:
  - added: `+`アイコン、緑色
  - modified: `~`アイコン、黄色
  - deleted: `-`アイコン、赤色
- 選択中: `bg-blue-100 dark:bg-blue-900`
- ホバー: `bg-gray-100 dark:bg-gray-800`

**DiffViewer**:
- unified表示: `splitView={false}`
- 追加行: `bg-green-100 dark:bg-green-900`
- 削除行: `bg-red-100 dark:bg-red-900`
- 行番号表示
- スクロール可能

**タブ**:
- タブ: 「対話」「Diff」
- アクティブ: `border-b-2 border-blue-500`
- 非アクティブ: `text-gray-500`

**Zustandストア拡張**:
```typescript
interface SessionState {
  // ... 既存のプロパティ
  diff: DiffData | null;
  selectedFile: string | null;
  fetchDiff: (sessionId: string) => Promise<void>; // GET /api/sessions/{id}/diff
  selectFile: (path: string) => void;
}

interface DiffData {
  files: DiffFile[];
  totalAdditions: number;
  totalDeletions: number;
}

interface DiffFile {
  path: string;
  status: 'added' | 'modified' | 'deleted';
  additions: number;
  deletions: number;
  oldContent: string;
  newContent: string;
}
```

**エラーハンドリング**:
- diff取得失敗: "差分の取得に失敗しました"
- ファイル未選択: "ファイルを選択してください"
- ネットワークエラー: "ネットワークエラーが発生しました"

**受入基準**:
- [ ] `src/components/git/DiffViewer.tsx`が存在する
- [ ] `src/components/git/FileList.tsx`が存在する
- [ ] `src/store/sessions.ts`に`fetchDiff`、`selectFile`が実装されている
- [ ] セッション詳細ページに「Diff」タブがある
- [ ] 変更ファイル一覧が表示される
- [ ] ファイル種別アイコンが表示される（+/~/−）
- [ ] diffが色分け表示される（緑/赤）
- [ ] ファイル選択でそのファイルのdiffのみ表示される
- [ ] unified表示になっている
- [ ] テストファイル2つが存在する
- [ ] 全テストが通過する（`npm test`）
- [ ] ESLintエラーがゼロである（`npm run lint`）
- [ ] テストのみのコミットと実装のコミットが分かれている

**依存関係**:
- タスク1.2（フロントエンド基本設定）完了
- タスク2.6（Git操作API実装）完了
- タスク3.5（セッション詳細画面実装）完了
- `src/store/sessions.ts`が存在すること

**推定工数**: 35分（AIエージェント作業時間）
- テスト作成・コミット: 12分
- 実装・テスト通過・コミット: 23分

**ステータス**: `TODO`

---

### タスク3.7: Git操作UI実装

**説明**:
Git操作（rebase、merge）のUIを実装する
- 「mainから取り込み」ボタン
- 「スカッシュしてマージ」ボタン
- コミットメッセージ入力モーダル
- コンフリクト通知ダイアログ
- worktree削除確認ダイアログ

**技術的文脈**:
- Next.js 14 App Router
- React 18、TypeScript strict mode
- Zustand 4.xでGit操作状態管理
- Headless UI 2.x でモーダル/ダイアログ
- Tailwind CSSでスタイリング
- 操作中はローディング表示
- エラー時はエラーメッセージ表示

**必要なパッケージ**:
```bash
# Headless UIは既にインストール済み
# 追加パッケージなし
```

**実装ファイル**:
- `src/components/git/RebaseButton.tsx` - rebaseボタンコンポーネント
- `src/components/git/MergeModal.tsx` - マージモーダルコンポーネント
- `src/components/git/ConflictDialog.tsx` - コンフリクトダイアログ
- `src/components/git/DeleteWorktreeDialog.tsx` - worktree削除確認ダイアログ
- `src/components/git/__tests__/RebaseButton.test.tsx` - rebaseボタンテスト
- `src/components/git/__tests__/MergeModal.test.tsx` - マージモーダルテスト
- `src/components/git/__tests__/ConflictDialog.test.tsx` - コンフリクトダイアログテスト
- セッション詳細ページにGit操作ボタン追加

**実装手順（TDD）**:
1. **テスト作成フェーズ**:
   - `src/components/git/__tests__/RebaseButton.test.tsx`作成
     - ボタンクリック
     - rebase成功
     - rebaseコンフリクト
     - ローディング表示
   - `src/components/git/__tests__/MergeModal.test.tsx`作成
     - モーダル表示
     - コミットメッセージ入力
     - マージ実行
   - `src/components/git/__tests__/ConflictDialog.test.tsx`作成
     - コンフリクトファイル一覧表示
     - 閉じるボタン
   - テスト実行: `npm test` → すべて失敗することを確認
   - コミット: "Add git operation UI tests"

2. **実装フェーズ**:
   - `src/store/sessions.ts`拡張
     - `isGitOperationLoading: boolean`ステート追加
     - `conflictFiles: string[] | null`ステート追加
     - `rebase(sessionId: string): Promise<void>` - POST /api/sessions/{id}/rebase
     - `merge(sessionId: string, commitMessage: string, deleteWorktree: boolean): Promise<void>` - POST /api/sessions/{id}/merge
   - `src/components/git/RebaseButton.tsx`作成
     - ボタン: 「mainから取り込み」
     - クリックで`rebase()`呼び出し
     - ローディング中: ボタン無効化、スピナー表示
     - 成功: トースト通知「rebase成功」
     - コンフリクト時: `ConflictDialog`表示
   - `src/components/git/ConflictDialog.tsx`作成
     - Headless UI `Dialog`使用
     - タイトル: "コンフリクトが発生しました"
     - メッセージ: "以下のファイルでコンフリクトが発生しました"
     - コンフリクトファイル一覧
     - 「閉じる」ボタン
   - `src/components/git/MergeModal.tsx`作成
     - Headless UI `Dialog`使用
     - タイトル: "mainブランチにマージ"
     - コミットメッセージ入力: `<textarea>`
     - worktree削除チェックボックス
     - 「マージ」ボタン、「キャンセル」ボタン
     - クリックで`merge()`呼び出し
   - `src/components/git/DeleteWorktreeDialog.tsx`作成
     - Headless UI `Dialog`使用
     - タイトル: "worktreeを削除しますか？"
     - メッセージ: "マージが成功しました。worktreeを削除しますか？"
     - 「削除」ボタン、「保持」ボタン
   - セッション詳細ページ更新
     - Git操作ボタンエリア追加
     - `RebaseButton`表示
     - 「スカッシュしてマージ」ボタン → `MergeModal`表示
   - テスト実行: `npm test` → すべて通過することを確認
   - コミット: "Implement git operation UI"

**UI仕様**:

**RebaseButton**:
- ボタン: `bg-blue-500 text-white rounded px-4 py-2`
- テキスト: "mainから取り込み"
- ローディング: スピナー + "処理中..."
- 成功: トースト通知（3秒表示）

**MergeModal**:
- タイトル: "mainブランチにマージ"
- コミットメッセージ: `<textarea rows="5" placeholder="コミットメッセージを入力" />`
- worktree削除: `<input type="checkbox" />` "マージ後にworktreeを削除"
- ボタン: 「マージ」（緑）、「キャンセル」

**ConflictDialog**:
- タイトル: "コンフリクトが発生しました"
- メッセージ: "以下のファイルでコンフリクトが発生しました。手動で解決してください。"
- ファイル一覧: `<ul>`、各ファイルを`<li>`で表示
- ボタン: 「閉じる」

**DeleteWorktreeDialog**:
- タイトル: "worktreeを削除しますか？"
- メッセージ: "マージが成功しました。worktreeを削除しますか？"
- ボタン: 「削除」（赤）、「保持」

**Zustandストア拡張**:
```typescript
interface SessionState {
  // ... 既存のプロパティ
  isGitOperationLoading: boolean;
  conflictFiles: string[] | null;
  rebase: (sessionId: string) => Promise<void>; // POST /api/sessions/{id}/rebase
  merge: (sessionId: string, commitMessage: string, deleteWorktree: boolean) => Promise<void>; // POST /api/sessions/{id}/merge
}
```

**エラーハンドリング**:
- rebase失敗: "rebaseに失敗しました"
- コンフリクト発生（409）: `ConflictDialog`表示
- merge失敗: "マージに失敗しました"
- ネットワークエラー: "ネットワークエラーが発生しました"

**受入基準**:
- [ ] `src/components/git/RebaseButton.tsx`が存在する
- [ ] `src/components/git/MergeModal.tsx`が存在する
- [ ] `src/components/git/ConflictDialog.tsx`が存在する
- [ ] `src/components/git/DeleteWorktreeDialog.tsx`が存在する
- [ ] `src/store/sessions.ts`に`rebase`、`merge`が実装されている
- [ ] 「mainから取り込み」ボタンが機能する
- [ ] rebase成功時に成功メッセージが表示される
- [ ] コンフリクト時にダイアログが表示される
- [ ] コンフリクトファイル一覧が表示される
- [ ] 「スカッシュしてマージ」でモーダルが開く
- [ ] コミットメッセージを入力できる
- [ ] マージ成功後にworktree削除確認が表示される
- [ ] 操作中にローディング表示される
- [ ] テストファイル3つが存在する
- [ ] 全テストが通過する（`npm test`）
- [ ] ESLintエラーがゼロである（`npm run lint`）
- [ ] テストのみのコミットと実装のコミットが分かれている

**依存関係**:
- タスク1.2（フロントエンド基本設定）完了
- タスク2.6（Git操作API実装）完了
- タスク3.6（Diff表示画面実装）完了
- `src/store/sessions.ts`が存在すること

**推定工数**: 35分（AIエージェント作業時間）
- テスト作成・コミット: 12分
- 実装・テスト通過・コミット: 23分

**ステータス**: `TODO`
