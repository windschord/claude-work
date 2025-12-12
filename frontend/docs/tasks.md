# タスク一覧

## プロジェクト管理画面の実装

### タスク1.1: Project型定義とAPIクライアントの実装

**説明**: バックエンドAPIと連携するための型定義とAPIクライアント関数を実装します。

**実装内容**:
- `lib/api.ts`にProject型を定義
- getProjects(), createProject(path), updateProject(id, name), deleteProject(id)関数を追加
- エラーハンドリングを実装

**受入基準**:
- [x] Project型が定義されている（id, name, path, created_at, updated_at）
- [x] 4つのAPI関数が実装されている
- [x] エラー時にApiErrorをthrowする
- [x] TypeScriptのstrict modeでエラーが出ない

**依存関係**: なし

**ステータス**: `DONE`

**完了サマリー**: Project型とgetProjects/createProject/updateProject/deleteProject関数をlib/api.tsに実装

**推定工数**: 20分

---

### タスク1.2: プロジェクトストアの実装

**説明**: Zustandを使用してプロジェクト状態管理ストアを実装します。

**実装内容**:
- `store/projects.ts`を作成
- projects配列、isLoading、error状態を管理
- fetchProjects, addProject, deleteProject, selectProject関数を実装
- selectedProjectId状態を管理

**受入基準**:
- [x] `store/projects.ts`が存在する
- [x] useProjectsStoreフックが正しく動作する
- [x] すべての状態管理関数が実装されている
- [x] TypeScriptのstrict modeでエラーが出ない

**依存関係**: Task 1.1

**ステータス**: `DONE`

**完了サマリー**: Zustandでプロジェクト状態管理ストアをstore/projects.tsに実装し、fetchProjects/addProject/deleteProject/selectProject関数を追加

**推定工数**: 30分

---

### タスク1.3: ProjectListコンポーネントの実装

**説明**: プロジェクト一覧を表示し、選択と削除ができるコンポーネントを実装します。

**実装内容**:
- `components/projects/ProjectList.tsx`を作成
- プロジェクト一覧表示（ローディング状態、エラー表示含む）
- プロジェクトクリックで選択し、/projects/[id]に遷移
- 各プロジェクトに削除ボタンを配置

**受入基準**:
- [x] `components/projects/ProjectList.tsx`が存在する
- [x] 'use client'ディレクティブが設定されている
- [x] ローディング状態とエラー状態を適切に表示
- [x] プロジェクトクリックで遷移する
- [x] TypeScriptのstrict modeでエラーが出ない

**依存関係**: Task 1.2

**ステータス**: `DONE`

**完了サマリー**: プロジェクト一覧表示コンポーネントをcomponents/projects/ProjectList.tsxに実装し、クリックで遷移・削除ボタンを追加

**推定工数**: 40分

---

### タスク1.4: AddProjectModalコンポーネントの実装

**説明**: プロジェクトを追加するためのモーダルダイアログを実装します。

**実装内容**:
- `components/projects/AddProjectModal.tsx`を作成
- @headlessui/reactのDialogを使用
- react-hook-formでフォーム管理
- パス入力バリデーション（必須チェック）
- エラー表示

**受入基準**:
- [x] `components/projects/AddProjectModal.tsx`が存在する
- [x] 'use client'ディレクティブが設定されている
- [x] DialogとTransitionを使用している
- [x] react-hook-formでバリデーションが動作する
- [x] TypeScriptのstrict modeでエラーが出ない

**依存関係**: Task 1.2

**ステータス**: `DONE`

**完了サマリー**: プロジェクト追加モーダルをcomponents/projects/AddProjectModal.tsxに実装し、Dialogとreact-hook-formでフォーム管理を追加

**推定工数**: 40分

---

### タスク1.5: DeleteProjectDialogコンポーネントの実装

**説明**: プロジェクト削除確認ダイアログを実装します。

**実装内容**:
- `components/projects/DeleteProjectDialog.tsx`を作成
- @headlessui/reactのDialogを使用
- プロジェクト名を表示して削除確認
- キャンセルと削除ボタン

**受入基準**:
- [x] `components/projects/DeleteProjectDialog.tsx`が存在する
- [x] 'use client'ディレクティブが設定されている
- [x] DialogとTransitionを使用している
- [x] プロジェクト名が表示される
- [x] TypeScriptのstrict modeでエラーが出ない

**依存関係**: Task 1.2

**ステータス**: `DONE`

**完了サマリー**: プロジェクト削除確認ダイアログをcomponents/projects/DeleteProjectDialog.tsxに実装し、Dialogで削除確認機能を追加

**推定工数**: 30分

---

### タスク2.1: Sidebarコンポーネントの更新

**説明**: 既存のSidebarコンポーネントにProjectListとAddProjectModalを統合します。

**実装内容**:
- `components/layout/Sidebar.tsx`を更新
- ProjectListコンポーネントを配置
- AddProjectModalコンポーネントを配置
- プロジェクト追加ボタンにモーダル表示機能を実装
- DeleteProjectDialogを配置

**受入基準**:
- [x] ProjectListが表示される
- [x] プロジェクト追加ボタンでモーダルが開く
- [x] 削除ボタンで削除確認ダイアログが開く
- [x] TypeScriptのstrict modeでエラーが出ない

**依存関係**: Task 1.3, Task 1.4, Task 1.5

**ステータス**: `DONE`

**完了サマリー**: Sidebarにプロジェクト一覧・追加モーダル・削除ダイアログを統合し、状態管理とイベントハンドリングを実装

**推定工数**: 30分

---

### タスク2.2: プロジェクト詳細ページの作成

**説明**: プロジェクト選択時の詳細ページ（セッション一覧表示用）を作成します。

**実装内容**:
- `app/(authenticated)/projects/[id]/page.tsx`を作成
- プロジェクトIDをパラメータから取得
- プロジェクト名を表示
- セッション一覧表示エリアを準備（後で実装）

**受入基準**:
- [x] `app/(authenticated)/projects/[id]/page.tsx`が存在する
- [x] プロジェクトIDが正しく取得される
- [x] プロジェクト名が表示される
- [x] TypeScriptのstrict modeでエラーが出ない

**依存関係**: Task 1.2

**ステータス**: `DONE`

**完了サマリー**: プロジェクト詳細ページをapp/(authenticated)/projects/[id]/page.tsxに実装し、プロジェクト情報表示とセッション一覧エリアを追加

**推定工数**: 20分

---

### タスク3.1: ビルドテストと動作確認

**説明**: すべての実装が完了した後、ビルドテストを実行し、エラーがないことを確認します。

**実装内容**:
- `npm run build`を実行
- ビルドエラーがあれば修正
- TypeScriptエラーがあれば修正

**受入基準**:
- [x] `npm run build`が成功する
- [x] TypeScriptエラーがゼロ
- [x] ESLintエラーがゼロ

**依存関係**: Task 2.1, Task 2.2

**ステータス**: `DONE`

**完了サマリー**: npm run buildを実行し、TypeScriptとESLintのエラーがゼロであることを確認、ビルドが正常に完了

**推定工数**: 20分

---

## 技術的文脈

- **フレームワーク**: Next.js 14 App Router
- **言語**: TypeScript (strict mode)
- **状態管理**: Zustand
- **フォーム管理**: react-hook-form
- **UIコンポーネント**: @headlessui/react (Dialog)
- **スタイリング**: Tailwind CSS
- **バックエンドAPI**: http://localhost:8000

## 既存ファイルの参考

- **APIクライアント**: `/home/tsk/sync/git/claude-work/frontend/lib/api.ts`
- **認証ストア**: `/home/tsk/sync/git/claude-work/frontend/store/auth.ts`
- **既存Sidebar**: `/home/tsk/sync/git/claude-work/frontend/components/layout/Sidebar.tsx`
