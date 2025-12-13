## フェーズ3: フロントエンドコア機能
*推定期間: 210分（AIエージェント作業時間）*
*MVP: Yes*

### タスク3.1: 認証画面実装

**説明**:
ログイン画面とログアウト機能を実装する
- `/login`ページ作成
- トークン入力フォーム
- ログイン成功時のリダイレクト
- 認証状態管理（Zustand）
- 認証ガード（未認証時リダイレクト）

**技術的文脈**:
- Next.js 14 App Router
- React 18、TypeScript strict mode
- Tailwind CSSでスタイリング
- Zustand 4.xで認証状態管理
- Next.js `redirect()`でリダイレクト
- `fetch()`で`/api/auth/login`呼び出し
- フォームバリデーション: 入力必須チェック

**必要なパッケージ**:
```bash
# Zustandは既にタスク1.2でインストール済み
# 追加パッケージなし
```

**実装ファイル**:
- `src/app/login/page.tsx` - ログインページ
- `src/store/auth.ts` - 認証Zustandストア（タスク1.2で作成済み、拡張）
- `src/components/AuthGuard.tsx` - 認証ガードコンポーネント
- `src/app/__tests__/login.test.tsx` - ログインページテスト
- `src/components/__tests__/AuthGuard.test.tsx` - 認証ガードテスト

**実装手順（TDD）**:
1. **テスト作成フェーズ**:
   - `src/app/__tests__/login.test.tsx`作成
     - ログインフォーム表示（トークン入力フィールド、送信ボタン）
     - 正しいトークンでログイン成功、`/`にリダイレクト
     - 誤ったトークンでエラー表示
     - 空のトークンで送信ボタン無効化
   - `src/components/__tests__/AuthGuard.test.tsx`作成
     - 未認証時に`/login`にリダイレクト
     - 認証済み時に子コンポーネント表示
   - テスト実行: `npm test` → すべて失敗することを確認
   - コミット: "Add login and AuthGuard tests"

2. **実装フェーズ**:
   - `src/store/auth.ts`拡張
     - `isAuthenticated: boolean`ステート追加
     - `login(token: string): Promise<void>`アクション追加
     - `logout(): Promise<void>`アクション追加
     - `checkAuth(): Promise<void>`アクション追加（ページロード時にセッション確認）
   - `src/app/login/page.tsx`作成
     - トークン入力フォーム（`<input type="password">`）
     - 送信ボタン
     - エラーメッセージ表示エリア
     - ローディング状態表示
     - `login()`呼び出し、成功時に`redirect('/')`
   - `src/components/AuthGuard.tsx`作成
     - `useAuth()`でストア取得
     - `useEffect()`で`checkAuth()`呼び出し
     - 未認証時に`redirect('/login')`
     - 認証済み時に`children`をレンダリング
   - テスト実行: `npm test` → すべて通過することを確認
   - コミット: "Implement login page and AuthGuard"

**UI仕様**:
- ログインページ:
  - 中央配置、最大幅400px
  - タイトル: "ClaudeWork"
  - サブタイトル: "ログイン"
  - トークン入力: `<input type="password" placeholder="認証トークンを入力" />`
  - 送信ボタン: "ログイン"（プライマリカラー）
  - エラー表示: 赤色テキスト、ボーダー付き
  - ローディング時: ボタン無効化、スピナー表示

**Zustandストア仕様**:
```typescript
interface AuthState {
  isAuthenticated: boolean;
  sessionId: string | null;
  expiresAt: string | null;
  login: (token: string) => Promise<void>; // POST /api/auth/login
  logout: () => Promise<void>; // POST /api/auth/logout
  checkAuth: () => Promise<void>; // セッション確認
}
```

**エラーハンドリング**:
- ネットワークエラー: "ネットワークエラーが発生しました"
- 401エラー: "トークンが無効です"
- 500エラー: "サーバーエラーが発生しました"
- その他: "ログインに失敗しました"

**受入基準**:
- [ ] `src/app/login/page.tsx`が存在する
- [ ] `src/components/AuthGuard.tsx`が存在する
- [ ] `src/store/auth.ts`に`login`、`logout`、`checkAuth`が実装されている
- [ ] `/login`ページが表示される
- [ ] トークン入力フォームがある
- [ ] 送信ボタンがある
- [ ] 空のトークンで送信ボタンが無効化される
- [ ] ログイン成功時に`/`にリダイレクトされる
- [ ] ログイン失敗時にエラーメッセージが表示される
- [ ] 未認証で`/`アクセス時に`/login`にリダイレクトされる
- [ ] 認証済みで`/login`アクセス時に`/`にリダイレクトされる
- [ ] テストファイル2つが存在する
- [ ] 全テストが通過する（`npm test`）
- [ ] ESLintエラーがゼロである（`npm run lint`）
- [ ] テストのみのコミットと実装のコミットが分かれている

**依存関係**:
- タスク1.2（フロントエンド基本設定）完了
- タスク2.1（認証API実装）完了
- `src/store/index.ts`が存在すること

**推定工数**: 40分（AIエージェント作業時間）
- テスト作成・コミット: 15分
- 実装・テスト通過・コミット: 25分

**ステータス**: `TODO`

---

### タスク3.2: レイアウトとナビゲーション実装

**説明**:
アプリケーションの基本レイアウトを実装する
- ヘッダー（ロゴ、ログアウトボタン）
- サイドバー（プロジェクト一覧）
- メインコンテンツエリア
- レスポンシブ対応（モバイル時はサイドバー折りたたみ）

**技術的文脈**:
- Next.js 14 App Router
- Tailwind CSS 3.x
- Zustand 4.xでプロジェクト一覧取得
- モバイルブレークポイント: `md:`（768px）
- レスポンシブ: `hidden md:block`でサイドバー制御
- ハンバーガーメニュー: モバイル時のサイドバートグル

**必要なパッケージ**:
```bash
# 追加パッケージなし（Tailwind CSSは既にインストール済み）
# アイコン用（オプション）:
npm install lucide-react
```

**実装ファイル**:
- `src/components/layout/Header.tsx` - ヘッダーコンポーネント
- `src/components/layout/Sidebar.tsx` - サイドバーコンポーネント
- `src/components/layout/MainLayout.tsx` - メインレイアウトコンポーネント
- `src/app/layout.tsx` - ルートレイアウト（MainLayout適用）
- `src/components/layout/__tests__/Header.test.tsx` - ヘッダーテスト
- `src/components/layout/__tests__/Sidebar.test.tsx` - サイドバーテスト
- `src/components/layout/__tests__/MainLayout.test.tsx` - メインレイアウトテスト

**実装手順（TDD）**:
1. **テスト作成フェーズ**:
   - `src/components/layout/__tests__/Header.test.tsx`作成
     - ロゴ表示
     - ログアウトボタン表示・クリック
   - `src/components/layout/__tests__/Sidebar.test.tsx`作成
     - プロジェクト一覧表示
     - プロジェクト選択
     - 折りたたみ機能（モバイル）
   - `src/components/layout/__tests__/MainLayout.test.tsx`作成
     - ヘッダー・サイドバー・メインエリア表示
     - レスポンシブ動作
   - テスト実行: `npm test` → すべて失敗することを確認
   - コミット: "Add layout component tests"

2. **実装フェーズ**:
   - `src/components/layout/Header.tsx`作成
     - ロゴ: "ClaudeWork"
     - ログアウトボタン
     - `useAuth().logout()`呼び出し
   - `src/components/layout/Sidebar.tsx`作成
     - プロジェクト一覧: `useProjects()`でZustandから取得
     - プロジェクト選択: `router.push(/projects/${id})`
     - 「プロジェクト追加」ボタン
     - モバイル時の折りたたみ: `isSidebarOpen`ステート管理
   - `src/components/layout/MainLayout.tsx`作成
     - Header + Sidebar + main要素
     - グリッドレイアウト: `grid grid-cols-[250px_1fr]`（デスクトップ）
     - フレックスレイアウト: `flex flex-col`（モバイル）
   - `src/app/layout.tsx`更新
     - AuthGuardで保護
     - MainLayoutで全ページをラップ
   - テスト実行: `npm test` → すべて通過することを確認
   - コミット: "Implement responsive layout with Header and Sidebar"

**UI仕様**:

**Header**:
- 高さ: 64px
- 背景: `bg-white dark:bg-gray-800`、ボーダー下: `border-b`
- ロゴ: 左側、フォントサイズ`text-xl font-bold`
- ログアウトボタン: 右側、`text-sm text-gray-600`

**Sidebar**:
- 幅: 250px（デスクトップ）、100vw（モバイル）
- 背景: `bg-gray-50 dark:bg-gray-900`
- プロジェクト一覧: スクロール可能、最大高さ`max-h-screen`
- プロジェクト項目: ホバー時`bg-gray-100 dark:bg-gray-800`
- 選択中: `bg-blue-100 dark:bg-blue-900`

**MainLayout**:
- デスクトップ: `grid grid-cols-[250px_1fr] h-screen`
- モバイル: `flex flex-col h-screen`
- サイドバー: `md:block hidden` + モバイルトグル時`block`

**レスポンシブ動作**:
- 768px以上: サイドバー常時表示
- 768px未満: ハンバーガーメニューでトグル、オーバーレイ表示

**Zustandストア連携**:
```typescript
// プロジェクトストア
interface ProjectState {
  projects: Project[];
  selectedProjectId: string | null;
  fetchProjects: () => Promise<void>; // GET /api/projects
  selectProject: (id: string) => void;
}

// UIストア
interface UIState {
  isSidebarOpen: boolean; // モバイル用
  toggleSidebar: () => void;
}
```

**エラーハンドリング**:
- プロジェクト一覧取得失敗: エラーメッセージ表示、リトライボタン
- ログアウト失敗: エラーメッセージ表示

**受入基準**:
- [ ] `src/components/layout/Header.tsx`が存在する
- [ ] `src/components/layout/Sidebar.tsx`が存在する
- [ ] `src/components/layout/MainLayout.tsx`が存在する
- [ ] `src/app/layout.tsx`が更新されている
- [ ] ヘッダーが表示される（ロゴ、ログアウトボタン）
- [ ] サイドバーにプロジェクト一覧が表示される
- [ ] プロジェクト選択で遷移する
- [ ] 768px以上でサイドバーが常時表示される
- [ ] 768px未満でサイドバーが折りたたまれる
- [ ] モバイルでハンバーガーメニューが表示される
- [ ] ハンバーガーメニュークリックでサイドバートグル
- [ ] ログアウトボタンが機能する
- [ ] テストファイル3つが存在する
- [ ] 全テストが通過する（`npm test`）
- [ ] ESLintエラーがゼロである（`npm run lint`）
- [ ] テストのみのコミットと実装のコミットが分かれている

**依存関係**:
- タスク1.2（フロントエンド基本設定）完了
- タスク3.1（認証画面実装）完了
- `src/store/index.ts`が存在すること
- `src/store/projects.ts`が存在すること（タスク1.2で作成済み）

**推定工数**: 35分（AIエージェント作業時間）
- テスト作成・コミット: 12分
- 実装・テスト通過・コミット: 23分

**ステータス**: `TODO`

---

### タスク3.3: プロジェクト管理画面実装

**説明**:
プロジェクト一覧と追加/削除機能を実装する
- プロジェクト一覧表示
- プロジェクト追加モーダル
- プロジェクト削除確認ダイアログ
- プロジェクト選択でセッション一覧表示

**技術的文脈**:
- Next.js 14 App Router
- React 18、TypeScript strict mode
- Zustand 4.xでプロジェクト状態管理
- Headless UI 2.x でモーダル/ダイアログ
- Tailwind CSSでスタイリング
- フォームバリデーション: パス入力必須、存在確認

**必要なパッケージ**:
```bash
npm install @headlessui/react
```

**実装ファイル**:
- `src/app/page.tsx` - ダッシュボード（プロジェクト一覧ページ）
- `src/components/projects/ProjectList.tsx` - プロジェクト一覧コンポーネント
- `src/components/projects/ProjectCard.tsx` - プロジェクトカードコンポーネント
- `src/components/projects/AddProjectModal.tsx` - プロジェクト追加モーダル
- `src/components/projects/DeleteProjectDialog.tsx` - 削除確認ダイアログ
- `src/app/__tests__/projects.test.tsx` - プロジェクト管理画面テスト
- `src/components/projects/__tests__/AddProjectModal.test.tsx` - モーダルテスト
- `src/components/projects/__tests__/DeleteProjectDialog.test.tsx` - ダイアログテスト

**実装手順（TDD）**:
1. **テスト作成フェーズ**:
   - `src/app/__tests__/projects.test.tsx`作成
     - プロジェクト一覧表示
     - プロジェクト選択で遷移
     - 「追加」ボタンクリックでモーダル表示
   - `src/components/projects/__tests__/AddProjectModal.test.tsx`作成
     - パス入力フォーム表示
     - 有効なパスでプロジェクト追加成功
     - 無効なパスでエラー表示
     - モーダル閉じる
   - `src/components/projects/__tests__/DeleteProjectDialog.test.tsx`作成
     - 削除確認メッセージ表示
     - 削除実行
     - キャンセル
   - テスト実行: `npm test` → すべて失敗することを確認
   - コミット: "Add project management tests"

2. **実装フェーズ**:
   - `src/store/projects.ts`拡張（タスク1.2で作成済み）
     - `addProject(path: string): Promise<void>` - POST /api/projects
     - `deleteProject(id: string): Promise<void>` - DELETE /api/projects/{id}
     - `updateProject(id: string, data: Partial<Project>): Promise<void>` - PUT /api/projects/{id}
   - `src/components/projects/ProjectCard.tsx`作成
     - プロジェクト名、パス、セッション数表示
     - 「開く」ボタン、「削除」ボタン
   - `src/components/projects/ProjectList.tsx`作成
     - `useProjects()`でZustandからプロジェクト一覧取得
     - `ProjectCard`をマップして表示
     - 「プロジェクト追加」ボタン
   - `src/components/projects/AddProjectModal.tsx`作成
     - Headless UI `Dialog`使用
     - パス入力フォーム
     - バリデーション: 空チェック
     - `addProject()`呼び出し
     - 成功時: モーダル閉じる、一覧更新
     - 失敗時: エラーメッセージ表示
   - `src/components/projects/DeleteProjectDialog.tsx`作成
     - Headless UI `Dialog`使用
     - 確認メッセージ: "プロジェクト「{name}」を削除しますか？"
     - 「削除」ボタン、「キャンセル」ボタン
     - `deleteProject()`呼び出し
   - `src/app/page.tsx`作成
     - `AuthGuard`で保護
     - `ProjectList`表示
   - テスト実行: `npm test` → すべて通過することを確認
   - コミット: "Implement project management UI with Headless UI"

**UI仕様**:

**ProjectCard**:
- カード形式: `border rounded-lg p-4 hover:shadow-md`
- プロジェクト名: `text-lg font-semibold`
- パス: `text-sm text-gray-600`
- セッション数バッジ: `bg-blue-100 text-blue-800 rounded-full px-2 py-1 text-xs`
- ボタン: 「開く」（プライマリ）、「削除」（デンジャー）

**AddProjectModal**:
- タイトル: "プロジェクトを追加"
- パス入力: `<input type="text" placeholder="/path/to/git/repo" />`
- ボタン: 「追加」、「キャンセル」
- エラー表示: 赤色テキスト

**DeleteProjectDialog**:
- タイトル: "プロジェクトを削除"
- メッセージ: "プロジェクト「{name}」を削除しますか？worktreeは削除されません。"
- ボタン: 「削除」（赤色）、「キャンセル」

**Zustandストア拡張**:
```typescript
interface ProjectState {
  projects: Project[];
  selectedProjectId: string | null;
  isLoading: boolean;
  error: string | null;
  fetchProjects: () => Promise<void>; // GET /api/projects
  addProject: (path: string) => Promise<void>; // POST /api/projects
  updateProject: (id: string, data: Partial<Project>) => Promise<void>; // PUT /api/projects/{id}
  deleteProject: (id: string) => Promise<void>; // DELETE /api/projects/{id}
  selectProject: (id: string) => void;
}
```

**エラーハンドリング**:
- Gitリポジトリでない: "指定されたパスはGitリポジトリではありません"
- パス不正: "有効なパスを入力してください"
- ネットワークエラー: "ネットワークエラーが発生しました"
- その他: "プロジェクトの追加に失敗しました"

**受入基準**:
- [ ] `src/app/page.tsx`が存在する
- [ ] `src/components/projects/ProjectList.tsx`が存在する
- [ ] `src/components/projects/ProjectCard.tsx`が存在する
- [ ] `src/components/projects/AddProjectModal.tsx`が存在する
- [ ] `src/components/projects/DeleteProjectDialog.tsx`が存在する
- [ ] `src/store/projects.ts`に`addProject`、`deleteProject`、`updateProject`が実装されている
- [ ] プロジェクト一覧が表示される
- [ ] 「追加」ボタンでモーダルが開く
- [ ] パス入力してプロジェクト追加できる
- [ ] 無効なパスでエラーメッセージが表示される
- [ ] プロジェクト削除確認ダイアログが表示される
- [ ] 削除実行でプロジェクトが削除される
- [ ] プロジェクト選択でセッション一覧に遷移する
- [ ] テストファイル3つが存在する
- [ ] 全テストが通過する（`npm test`）
- [ ] ESLintエラーがゼロである（`npm run lint`）
- [ ] テストのみのコミットと実装のコミットが分かれている

**依存関係**:
- タスク1.2（フロントエンド基本設定）完了
- タスク2.2（プロジェクトAPI実装）完了
- タスク3.2（レイアウトとナビゲーション実装）完了
- `src/store/projects.ts`が存在すること

**推定工数**: 45分（AIエージェント作業時間）
- テスト作成・コミット: 15分
- 実装・テスト通過・コミット: 30分

**ステータス**: `TODO`

---

### タスク3.4: セッション管理画面実装

**説明**:
セッション一覧と作成機能を実装する
- セッション一覧表示（ステータスアイコン付き）
- セッション作成フォーム（名前、プロンプト）
- セッション選択でセッション詳細画面へ遷移

**技術的文脈**:
- Next.js 14 App Router
- React 18、TypeScript strict mode
- Zustand 4.xでセッション状態管理
- Headless UI 2.x でフォーム
- Tailwind CSSでスタイリング
- セッションステータス: initializing, running, waiting_input, completed, error
- リアルタイムステータス更新は次フェーズ（タスク4.3）で実装

**必要なパッケージ**:
```bash
# Headless UIは既にタスク3.3でインストール済み
# 追加パッケージなし
```

**実装ファイル**:
- `src/app/projects/[id]/page.tsx` - プロジェクト詳細（セッション一覧ページ）
- `src/components/sessions/SessionList.tsx` - セッション一覧コンポーネント
- `src/components/sessions/SessionCard.tsx` - セッションカードコンポーネント
- `src/components/sessions/CreateSessionForm.tsx` - セッション作成フォーム
- `src/components/sessions/SessionStatusIcon.tsx` - ステータスアイコンコンポーネント
- `src/app/projects/__tests__/[id].test.tsx` - プロジェクト詳細ページテスト
- `src/components/sessions/__tests__/CreateSessionForm.test.tsx` - フォームテスト
- `src/components/sessions/__tests__/SessionStatusIcon.test.tsx` - アイコンテスト

**実装手順（TDD）**:
1. **テスト作成フェーズ**:
   - `src/app/projects/__tests__/[id].test.tsx`作成
     - セッション一覧表示
     - セッション作成フォーム表示
     - セッション選択で詳細画面に遷移
   - `src/components/sessions/__tests__/CreateSessionForm.test.tsx`作成
     - 名前・プロンプト入力フォーム表示
     - セッション作成成功
     - バリデーションエラー表示
   - `src/components/sessions/__tests__/SessionStatusIcon.test.tsx`作成
     - 各ステータスに応じたアイコン・色表示
   - テスト実行: `npm test` → すべて失敗することを確認
   - コミット: "Add session management tests"

2. **実装フェーズ**:
   - `src/store/sessions.ts`作成（タスク1.2のstore拡張）
     - `sessions: Session[]`ステート
     - `fetchSessions(projectId: string): Promise<void>` - GET /api/projects/{id}/sessions
     - `createSession(projectId: string, data: CreateSessionData): Promise<void>` - POST /api/projects/{id}/sessions
     - `selectSession(id: string): void`
   - `src/components/sessions/SessionStatusIcon.tsx`作成
     - ステータスに応じたアイコン: initializing（スピナー）、running（再生）、waiting_input（一時停止）、completed（チェック）、error（エラー）
     - 色: initializing（青）、running（緑）、waiting_input（黄）、completed（グレー）、error（赤）
   - `src/components/sessions/SessionCard.tsx`作成
     - セッション名、ステータスアイコン、作成日時表示
     - クリックで詳細画面遷移
   - `src/components/sessions/SessionList.tsx`作成
     - `useSessions()`でZustandからセッション一覧取得
     - `SessionCard`をマップして表示
     - 空の場合: "セッションがありません"
   - `src/components/sessions/CreateSessionForm.tsx`作成
     - 名前入力: `<input type="text" placeholder="セッション名" />`
     - プロンプト入力: `<textarea placeholder="実行するタスクを入力" />`
     - バリデーション: 名前必須、プロンプト必須
     - `createSession()`呼び出し
   - `src/app/projects/[id]/page.tsx`作成
     - `AuthGuard`で保護
     - `useParams()`でprojectId取得
     - `useEffect()`で`fetchSessions(projectId)`呼び出し
     - `CreateSessionForm`と`SessionList`表示
   - テスト実行: `npm test` → すべて通過することを確認
   - コミット: "Implement session management UI"

**UI仕様**:

**SessionCard**:
- カード形式: `border rounded-lg p-4 hover:shadow-md cursor-pointer`
- ヘッダー: セッション名 + ステータスアイコン（右側）
- サブ情報: 作成日時、モデル（小さいテキスト）
- ホバー: `bg-gray-50`

**CreateSessionForm**:
- レイアウト: 縦並び
- 名前入力: `<input>`、幅100%
- プロンプト入力: `<textarea>`、高さ120px
- ボタン: 「セッション作成」（プライマリ）
- エラー表示: 赤色テキスト

**SessionStatusIcon**:
- initializing: スピナーアイコン、`text-blue-500`
- running: 再生アイコン、`text-green-500`
- waiting_input: 一時停止アイコン、`text-yellow-500`
- completed: チェックアイコン、`text-gray-500`
- error: エラーアイコン、`text-red-500`

**Zustandストア仕様**:
```typescript
interface SessionState {
  sessions: Session[];
  selectedSessionId: string | null;
  isLoading: boolean;
  error: string | null;
  fetchSessions: (projectId: string) => Promise<void>; // GET /api/projects/{id}/sessions
  createSession: (projectId: string, data: CreateSessionData) => Promise<void>; // POST /api/projects/{id}/sessions
  selectSession: (id: string) => void;
}

interface CreateSessionData {
  name: string;
  prompt: string;
  model?: string; // デフォルト: 'auto'
}
```

**エラーハンドリング**:
- 名前未入力: "セッション名を入力してください"
- プロンプト未入力: "プロンプトを入力してください"
- セッション作成失敗: "セッションの作成に失敗しました"
- ネットワークエラー: "ネットワークエラーが発生しました"

**受入基準**:
- [ ] `src/app/projects/[id]/page.tsx`が存在する
- [ ] `src/components/sessions/SessionList.tsx`が存在する
- [ ] `src/components/sessions/SessionCard.tsx`が存在する
- [ ] `src/components/sessions/CreateSessionForm.tsx`が存在する
- [ ] `src/components/sessions/SessionStatusIcon.tsx`が存在する
- [ ] `src/store/sessions.ts`に`fetchSessions`、`createSession`が実装されている
- [ ] セッション一覧が表示される
- [ ] 各セッションにステータスアイコンが表示される
- [ ] 5種類のステータスアイコンが正しく表示される
- [ ] セッション作成フォームが表示される
- [ ] 名前・プロンプト入力でセッション作成が成功する
- [ ] バリデーションエラーが表示される
- [ ] セッション選択で詳細画面に遷移する
- [ ] テストファイル3つが存在する
- [ ] 全テストが通過する（`npm test`）
- [ ] ESLintエラーがゼロである（`npm run lint`）
- [ ] テストのみのコミットと実装のコミットが分かれている

**依存関係**:
- タスク1.2（フロントエンド基本設定）完了
- タスク2.5（セッションAPI実装）完了
- タスク3.3（プロジェクト管理画面実装）完了
- `src/store/index.ts`が存在すること

**推定工数**: 45分（AIエージェント作業時間）
- テスト作成・コミット: 15分
- 実装・テスト通過・コミット: 30分

**ステータス**: `TODO`

---

---

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

---

