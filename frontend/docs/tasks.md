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

## Diff表示画面の実装

### タスク4.1: Diff型定義とAPIクライアントの拡張

**説明**: バックエンドのDiff APIと連携するための型定義とAPIクライアント関数を追加します。

**実装内容**:
- `lib/api.ts`にFileChangeStatus型、FileChange型、DiffResult型を定義
- getDiff(sessionId: string)関数を追加
- エラーハンドリングを実装

**受入基準**:
- [x] FileChangeStatus型が定義されている（'added' | 'modified' | 'deleted'）
- [x] FileChange型が定義されている（path, status, additions, deletions）
- [x] DiffResult型が定義されている（files, diff_content, has_changes）
- [x] getDiff関数が実装されている
- [x] エラー時にApiErrorをthrowする
- [x] TypeScriptのstrict modeでエラーが出ない

**依存関係**: なし

**ステータス**: `DONE`

**完了サマリー**: lib/api.tsにFileChangeStatus、FileChange、DiffResult型を定義し、getDiff関数を実装

**推定工数**: 20分

---

### タスク4.2: Diffストアの実装

**説明**: Zustandを使用してDiff状態管理ストアを実装します。

**実装内容**:
- `store/diff.ts`を作成
- diffResult、isLoading、error、selectedFile状態を管理
- fetchDiff(sessionId: string)関数を実装
- selectFile(path: string | null)関数を実装
- clearDiff()関数を実装

**受入基準**:
- [x] `store/diff.ts`が存在する
- [x] useDiffStoreフックが正しく動作する
- [x] すべての状態管理関数が実装されている
- [x] TypeScriptのstrict modeでエラーが出ない

**依存関係**: Task 4.1

**ステータス**: `DONE`

**完了サマリー**: Zustandでstore/diff.tsを実装し、fetchDiff、selectFile、clearDiff、clearError関数を追加

**推定工数**: 30分

---

### タスク4.3: FileListコンポーネントの実装

**説明**: 変更ファイル一覧を表示し、ファイル選択ができるコンポーネントを実装します。

**実装内容**:
- `components/git/FileList.tsx`を作成
- ファイル一覧表示（ファイルパス、ステータス、additions/deletions）
- ファイルステータスに応じた色分け（added: 緑、modified: 黄色、deleted: 赤）
- additions/deletionsの表示（+5 -3形式）
- ファイルクリックで選択状態を変更
- 選択中のファイルをハイライト表示

**受入基準**:
- [x] `components/git/FileList.tsx`が存在する
- [x] 'use client'ディレクティブが設定されている
- [x] ファイルステータスに応じた色分けが実装されている
- [x] additions/deletionsが表示される
- [x] ファイルクリックで選択状態が変更される
- [x] TypeScriptのstrict modeでエラーが出ない

**依存関係**: Task 4.2

**ステータス**: `DONE`

**完了サマリー**: components/git/FileList.tsxに変更ファイル一覧コンポーネントを実装し、色分け、additions/deletions表示、ファイル選択機能を追加

**推定工数**: 40分

---

### タスク4.4: DiffViewerコンポーネントの実装

**説明**: react-diff-viewer-continuedを使用してdiff表示を行うコンポーネントを実装します。

**実装内容**:
- `components/git/DiffViewer.tsx`を作成
- react-diff-viewer-continuedを使用
- unified diff形式のパース処理を実装
- 選択されたファイルのdiffのみ表示
- ファイル未選択時は全ファイルのdiffを表示
- ローディング状態とエラー表示

**受入基準**:
- [x] `components/git/DiffViewer.tsx`が存在する
- [x] 'use client'ディレクティブが設定されている
- [x] react-diff-viewer-continuedが使用されている
- [x] unified diff形式が正しくパースされる
- [x] ファイル選択状態に応じて表示が変わる
- [x] ローディング状態とエラー状態を適切に表示
- [x] TypeScriptのstrict modeでエラーが出ない

**依存関係**: Task 4.2

**ステータス**: `DONE`

**完了サマリー**: components/git/DiffViewer.tsxにreact-diff-viewer-continuedを使用したdiff表示コンポーネントを実装し、unified diff形式のパース処理、ファイル選択機能を追加

**推定工数**: 50分

---

### タスク4.5: セッション詳細ページへのタブ統合

**説明**: セッション詳細ページにタブ機能を追加し、「チャット」タブと「変更」タブを切り替えられるようにします。

**実装内容**:
- `app/(authenticated)/sessions/[id]/page.tsx`を更新
- タブUIを実装（チャット / 変更）
- 「チャット」タブでは既存のMessageListとInputFormを表示
- 「変更」タブではFileListとDiffViewerを表示
- タブ切り替え時にDiffデータを自動取得

**受入基準**:
- [x] タブUIが実装されている
- [x] タブ切り替えが正しく動作する
- [x] 「チャット」タブで既存機能が動作する
- [x] 「変更」タブでFileListとDiffViewerが表示される
- [x] タブ切り替え時にDiffデータが取得される
- [x] TypeScriptのstrict modeでエラーが出ない

**依存関係**: Task 4.3, Task 4.4

**ステータス**: `DONE`

**完了サマリー**: セッション詳細ページにチャットと変更のタブUIを実装し、タブ切り替え時にDiffデータを自動取得する機能を追加

**推定工数**: 40分

---

### タスク4.6: ビルドテストと動作確認

**説明**: すべての実装が完了した後、ビルドテストを実行し、エラーがないことを確認します。

**実装内容**:
- `npm run build`を実行
- ビルドエラーがあれば修正
- TypeScriptエラーがあれば修正

**受入基準**:
- [x] `npm run build`が成功する
- [x] TypeScriptエラーがゼロ
- [x] ESLintエラーがゼロ

**依存関係**: Task 4.5

**ステータス**: `DONE`

**完了サマリー**: npm run buildを実行し、TypeScriptとESLintのエラーがゼロであることを確認、ビルドが正常に完了

**推定工数**: 20分

---

## Git操作UIの実装

### タスク5.1: Git操作API型定義とAPIクライアントの拡張

**説明**: バックエンドのGit操作API（rebase, merge）と連携するための型定義とAPIクライアント関数を追加します。

**実装内容**:
- `lib/api.ts`にRebaseResult型、MergeResult型を定義
- rebaseFromMain(sessionId: string)関数を追加
- squashMerge(sessionId: string, message: string)関数を追加
- エラーハンドリングを実装

**受入基準**:
- [x] RebaseResult型が定義されている（success, message, conflict_files?）
- [x] MergeResult型が定義されている（success, message）
- [x] rebaseFromMain関数が実装されている
- [x] squashMerge関数が実装されている
- [x] エラー時にApiErrorをthrowする
- [x] TypeScriptのstrict modeでエラーが出ない

**依存関係**: なし

**ステータス**: `DONE`

**完了サマリー**: lib/api.tsにRebaseResult型とMergeResult型を定義し、rebaseFromMain関数とsquashMerge関数を実装

**推定工数**: 20分

---

### タスク5.2: Git操作ストアの実装

**説明**: Zustandを使用してGit操作の状態管理ストアを実装します。

**実装内容**:
- `store/gitOps.ts`を作成
- isLoading、error、conflictFiles状態を管理
- rebaseFromMain(sessionId: string)関数を実装
- squashMerge(sessionId: string, message: string)関数を実装
- clearConflict()関数を実装
- clearError()関数を実装

**受入基準**:
- [x] `store/gitOps.ts`が存在する
- [x] useGitOpsStoreフックが正しく動作する
- [x] すべての状態管理関数が実装されている
- [x] TypeScriptのstrict modeでエラーが出ない

**依存関係**: Task 5.1

**ステータス**: `DONE`

**完了サマリー**: Zustandでstore/gitOps.tsを実装し、rebaseFromMain、squashMerge、clearConflict、clearError関数を追加

**推定工数**: 30分

---

### タスク5.3: RebaseButtonコンポーネントの実装

**説明**: 「mainから取り込み」ボタンコンポーネントを実装します。

**実装内容**:
- `components/git/RebaseButton.tsx`を作成
- ローディング中はスピナー表示
- 成功時はトーストまたは成功メッセージ表示
- エラー時はエラーメッセージ表示
- コンフリクト発生時はConflictDialogを表示

**受入基準**:
- [x] `components/git/RebaseButton.tsx`が存在する
- [x] 'use client'ディレクティブが設定されている
- [x] ローディング状態が適切に表示される
- [x] 成功時とエラー時の表示が実装されている
- [x] TypeScriptのstrict modeでエラーが出ない

**依存関係**: Task 5.2

**ステータス**: `DONE`

**完了サマリー**: components/git/RebaseButton.tsxにrebaseボタンコンポーネントを実装し、ローディング状態とスピナー表示、成功メッセージを追加

**推定工数**: 30分

---

### タスク5.4: MergeModalコンポーネントの実装

**説明**: スカッシュマージのためのコミットメッセージ入力モーダルを実装します。

**実装内容**:
- `components/git/MergeModal.tsx`を作成
- @headlessui/reactのDialogを使用
- react-hook-formでコミットメッセージフォーム管理
- キャンセルとマージボタン
- ローディング状態とエラー表示

**受入基準**:
- [x] `components/git/MergeModal.tsx`が存在する
- [x] 'use client'ディレクティブが設定されている
- [x] DialogとTransitionを使用している
- [x] react-hook-formでバリデーションが動作する
- [x] ローディング状態とエラー状態を適切に表示
- [x] TypeScriptのstrict modeでエラーが出ない

**依存関係**: Task 5.2

**ステータス**: `DONE`

**完了サマリー**: components/git/MergeModal.tsxにスカッシュマージモーダルを実装し、react-hook-formでコミットメッセージフォーム管理を追加

**推定工数**: 40分

---

### タスク5.5: ConflictDialogコンポーネントの実装

**説明**: コンフリクト発生時にファイル一覧を表示するダイアログを実装します。

**実装内容**:
- `components/git/ConflictDialog.tsx`を作成
- @headlessui/reactのDialogを使用
- コンフリクトファイル一覧を表示
- 「手動で解決してください」メッセージを表示
- OKボタンで閉じる

**受入基準**:
- [x] `components/git/ConflictDialog.tsx`が存在する
- [x] 'use client'ディレクティブが設定されている
- [x] DialogとTransitionを使用している
- [x] コンフリクトファイル一覧が表示される
- [x] TypeScriptのstrict modeでエラーが出ない

**依存関係**: Task 5.2

**ステータス**: `DONE`

**完了サマリー**: components/git/ConflictDialog.tsxにコンフリクト通知ダイアログを実装し、コンフリクトファイル一覧表示を追加

**推定工数**: 30分

---

### タスク5.6: セッション詳細ページへのGit操作UI統合

**説明**: セッション詳細ページの「変更」タブにGit操作ボタンを追加します。

**実装内容**:
- `app/(authenticated)/sessions/[id]/page.tsx`を更新
- 「変更」タブにRebaseButton、MergeModalを追加
- ConflictDialogを配置
- マージ成功後にプロジェクトページへリダイレクト

**受入基準**:
- [x] 「変更」タブにGit操作ボタンが表示される
- [x] RebaseButtonが正しく動作する
- [x] MergeModalが正しく動作する
- [x] ConflictDialogが正しく動作する
- [x] マージ成功後にリダイレクトされる
- [x] TypeScriptのstrict modeでエラーが出ない

**依存関係**: Task 5.3, Task 5.4, Task 5.5

**ステータス**: `DONE`

**完了サマリー**: セッション詳細ページの変更タブにRebaseButton、MergeModal、ConflictDialogを統合し、マージ成功時のリダイレクト処理を追加

**推定工数**: 40分

---

### タスク5.7: ビルドテストと動作確認

**説明**: すべての実装が完了した後、ビルドテストを実行し、エラーがないことを確認します。

**実装内容**:
- `npm run build`を実行
- ビルドエラーがあれば修正
- TypeScriptエラーがあれば修正

**受入基準**:
- [x] `npm run build`が成功する
- [x] TypeScriptエラーがゼロ
- [x] ESLintエラーがゼロ

**依存関係**: Task 5.6

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
- **Diff表示**: react-diff-viewer-continued
- **バックエンドAPI**: http://localhost:8000

## バックエンドAPI仕様（Diff表示関連）

### GET /api/sessions/{id}/diff

Diff情報を取得するエンドポイント

**レスポンス型**:
```typescript
type FileChangeStatus = 'added' | 'modified' | 'deleted';

interface FileChange {
  path: string;
  status: FileChangeStatus;
  additions: number;
  deletions: number;
}

interface DiffResult {
  files: FileChange[];
  diff_content: string;  // unified diff形式のテキスト
  has_changes: boolean;
}
```

## バックエンドAPI仕様（Git操作関連）

### POST /api/sessions/{id}/rebase

mainブランチからrebaseを実行するエンドポイント

**レスポンス型**:
```typescript
interface RebaseResult {
  success: boolean;
  message: string;
  conflict_files?: string[];  // コンフリクトが発生した場合のみ
}
```

### POST /api/sessions/{id}/merge

スカッシュマージを実行するエンドポイント

**リクエストボディ**:
```typescript
{
  message: string;  // コミットメッセージ
}
```

**レスポンス型**:
```typescript
interface MergeResult {
  success: boolean;
  message: string;
}
```

## 既存ファイルの参考

- **APIクライアント**: `/home/tsk/sync/git/claude-work/frontend/lib/api.ts`
- **認証ストア**: `/home/tsk/sync/git/claude-work/frontend/store/auth.ts`
- **セッションストア**: `/home/tsk/sync/git/claude-work/frontend/store/sessions.ts`
- **メッセージストア**: `/home/tsk/sync/git/claude-work/frontend/store/messages.ts`
- **既存Sidebar**: `/home/tsk/sync/git/claude-work/frontend/components/layout/Sidebar.tsx`
- **セッション詳細ページ**: `/home/tsk/sync/git/claude-work/frontend/app/(authenticated)/sessions/[id]/page.tsx`
