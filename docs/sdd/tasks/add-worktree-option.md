# タスク管理書: Claude Code `--worktree` オプション対応

## 関連ドキュメント
- 要件定義: `docs/sdd/requirements/add-worktree-option.md`
- 設計書: `docs/sdd/design/add-worktree-option.md`

## タスク一覧

### TASK-001: ClaudeCodeOptionsインターフェースとClaudeOptionsServiceの拡張

**ステータス:** done
**対応要件:** REQ-001, REQ-003, REQ-004
**対象ファイル:** `src/services/claude-options-service.ts`

**実装手順:**
1. テスト作成: `src/services/__tests__/claude-options-service.test.ts`
   - `buildCliArgs()`: `worktree: true` → `['--worktree']` を確認
   - `buildCliArgs()`: `worktree: "name"` → `['--worktree', 'name']` を確認
   - `buildCliArgs()`: `worktree: false` / `undefined` → 引数なし
   - `mergeOptions()`: worktreeフィールドのマージ（セッション優先）
   - `validateClaudeCodeOptions()`: worktreeフィールドのboolean/string許容
   - `validateClaudeCodeOptions()`: worktreeフィールドの不正型（number, object）拒否
   - `parseOptions()`: JSON文字列からのworktreeフィールドパース
   - `hasWorktreeOption()`: 各パターンの判定テスト
2. テスト実行 → 失敗確認
3. `ClaudeCodeOptions`インターフェースに`worktree?: boolean | string`を追加
4. `buildCliArgs()`にworktree引数生成ロジックを追加
5. `mergeOptions()`にworktreeフィールドのマージロジックを追加
6. `validateClaudeCodeOptions()`に以下を追加:
   - `allowedKeys`に`'worktree'`を追加
   - worktreeフィールドの型チェック（boolean | string）
7. `getUnknownKeys()`の`allowedKeys`に`'worktree'`を追加
8. `parseOptions()`にworktreeフィールドのパースを追加
9. `hasWorktreeOption()`静的メソッドを新規追加
10. テスト実行 → 成功確認

**受入基準:**
- 全テストケースがパスする
- 既存テストが壊れていない

---

### TASK-002: セッション作成APIのworktreeスキップ対応

**ステータス:** done
**依存:** TASK-001
**対応要件:** REQ-002, REQ-007
**対象ファイル:** `src/app/api/projects/[project_id]/sessions/route.ts`

**実装手順:**
1. テスト作成: `src/app/api/projects/[project_id]/sessions/__tests__/route.test.ts`（既存テストに追加）
   - `worktree: true`の場合、GitService.createWorktree()が呼ばれない
   - `worktree: true`の場合、worktree_pathがプロジェクトルートパスである
   - `worktree: true`の場合、branch_nameが空文字列である
   - `worktree`未指定の場合、従来通りworktreeが作成される
   - Docker環境（clone_location='docker'）での`worktree: true`でworktree_pathが`/repo`である
2. テスト実行 → 失敗確認
3. POST関数内のworktree作成ロジック前に以下を追加:
   - プロジェクトとセッションのclaude_code_optionsをマージ
   - `ClaudeOptionsService.hasWorktreeOption()`で判定
   - 有効時: worktree作成をスキップ、worktree_pathにプロジェクトパスを設定
   - 有効時: branch_nameに空文字列を設定
4. worktree作成のtry-catchブロックを条件分岐で囲む
5. テスト実行 → 成功確認

**受入基準:**
- worktree有効時にGitService/DockerGitServiceのcreateWorktree()が呼ばれない
- worktree無効時は従来動作が維持される
- worktree_pathとbranch_nameが正しく設定される

---

### TASK-003: セッション削除APIのworktree削除スキップ対応

**ステータス:** done
**依存:** TASK-001
**対応要件:** REQ-006
**対象ファイル:** `src/app/api/sessions/[id]/route.ts`

**実装手順:**
1. テスト作成: `src/app/api/sessions/[id]/__tests__/route.test.ts`（既存テストに追加）
   - `worktree: true`のセッション削除時、GitService.deleteWorktree()が呼ばれない
   - `worktree`未指定のセッション削除時、従来通りworktreeが削除される
2. テスト実行 → 失敗確認
3. DELETE関数内のworktree削除ロジック前に以下を追加:
   - セッションとプロジェクトのclaude_code_optionsをマージ
   - `ClaudeOptionsService.hasWorktreeOption()`で判定
   - 有効時: worktree削除をスキップ（ログ出力のみ）
4. テスト実行 → 成功確認

**受入基準:**
- worktree有効時にGitService/DockerGitServiceのdeleteWorktree()が呼ばれない
- worktree無効時は従来の削除動作が維持される

---

### TASK-004: UIフォームにWorktreeモードUIを追加

**ステータス:** done
**依存:** TASK-001
**対応要件:** REQ-005
**対象ファイル:** `src/components/claude-options/ClaudeOptionsForm.tsx`

**実装手順:**
1. 「権限モード」セクションと「追加フラグ」セクションの間に「Worktreeモード」セクションを追加:
   - チェックボックス: 「Claude Codeにworktree管理を委任する」
   - チェックON時: Worktree名テキストフィールドを表示（省略時は自動生成）
   - チェックOFF時: テキストフィールドを非表示
2. `handleOptionChange`の代わりに専用のハンドラーを実装:
   - チェックボックスON: `onOptionsChange({ ...options, worktree: true })`
   - チェックボックスOFF: `onOptionsChange(worktreeを除いたoptions)`
   - テキスト入力: `onOptionsChange({ ...options, worktree: value || true })`
3. `hasAnySettings`にworktreeフィールドの判定を追加

**受入基準:**
- チェックボックスのON/OFF切り替えが動作する
- チェックON時にWorktree名入力フィールドが表示される
- チェックOFF時にWorktree名入力フィールドが非表示になる
- 入力した値が`onOptionsChange`で正しく伝播される

---

### TASK-005: セッション作成APIのバリデーションエラーメッセージ更新

**ステータス:** done
**依存:** TASK-001
**対応要件:** REQ-004
**対象ファイル:** `src/app/api/projects/[project_id]/sessions/route.ts`

**実装手順:**
1. バリデーションエラーメッセージ（行182）のAllowed keys一覧に`worktree`を追加:
   ```
   Allowed keys: model, allowedTools, permissionMode, additionalFlags, dangerouslySkipPermissions, worktree
   ```
   ※ 既存の不整合: 現在のメッセージには`dangerouslySkipPermissions`も欠落しているため、同時に修正する
2. テスト実行で既存テストへの影響を確認

**受入基準:**
- エラーメッセージにworktreeとdangerouslySkipPermissionsが含まれる
- 既存テストが壊れていない

---

### TASK-006: `--worktree`モード時のbranch_name空文字列ハンドリング

**ステータス:** done
**依存:** TASK-002
**対応要件:** TD-003
**対象ファイル:**
- `src/app/api/sessions/[id]/pr/route.ts`
- `src/services/git-service.ts`（squashMerge関連）

**実装手順:**
1. `src/app/api/sessions/[id]/pr/route.ts`:
   - PR作成前に`dbSession.branch_name`が空文字列でないことを確認
   - 空文字列の場合は400エラー（「--worktreeモードのセッションではPR作成はサポートされていません」）
2. `src/services/git-service.ts`:
   - squashMerge等のブランチ名を使う操作で空文字列チェックを追加
   - 空文字列の場合はエラーをスロー

**受入基準:**
- `--worktree`モードのセッションでPR作成を試みた場合、適切なエラーが返される
- `--worktree`モードのセッションでsquashマージを試みた場合、適切なエラーが返される
- 従来モードのセッションは影響を受けない
