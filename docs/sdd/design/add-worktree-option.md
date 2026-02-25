# 設計書: Claude Code `--worktree` オプション対応

## 1. 概要

Claude Code CLIの`--worktree` (`-w`) フラグをClaudeWorkのセッション管理に統合する。このオプションが有効な場合、Claude Codeが自動的にGit worktreeを作成・管理するため、ClaudeWorkのworktree作成処理をスキップする。

## 2. アーキテクチャ

### 2.1 変更方針

**現在の処理フロー（`--worktree`なし）:**
```
セッション作成API → GitService.createWorktree() → worktreeパスをDB保存
→ WebSocket接続 → claude (cwd=worktreePath) として起動
→ セッション削除 → GitService.deleteWorktree()
```

**新しい処理フロー（`--worktree`有効時）:**
```
セッション作成API → worktree作成をスキップ → プロジェクトパスをDB保存
→ WebSocket接続 → claude --worktree <name> (cwd=projectPath) として起動
→ セッション削除 → worktree削除をスキップ（Claude Codeが管理）
```

### 2.2 影響の全体像

```
┌─────────────────────────────────────────────────────────────┐
│ ClaudeCodeOptions                                           │
│                                                             │
│  model?: string                                             │
│  allowedTools?: string                                      │
│  permissionMode?: string                                    │
│  additionalFlags?: string                                   │
│  dangerouslySkipPermissions?: boolean                       │
│  worktree?: boolean | string  ← 新規追加                   │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ ClaudeOptionsService                                        │
│                                                             │
│  buildCliArgs()   → --worktree / --worktree <name> 生成     │
│  mergeOptions()   → worktreeフィールドのマージ対応          │
│  validateClaudeCodeOptions()  → worktreeバリデーション追加  │
│  parseOptions()   → worktreeフィールドのパース対応          │
│  hasWorktreeOption()  ← 新規: worktree有効判定ヘルパー      │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────┐    ┌───────────────────┐    ┌──────────────┐
│ セッション作成API │    │ セッション削除API │    │ UIフォーム    │
│                   │    │                   │    │              │
│ worktree有効時:   │    │ worktree有効時:   │    │ チェック      │
│  createWorktree   │    │  deleteWorktree   │    │ ボックス +   │
│  をスキップ       │    │  をスキップ       │    │ 名前入力     │
└─────────────────┘    └───────────────────┘    └──────────────┘
```

### 2.3 worktree有効判定の基準

`worktree`オプションの有効判定はDBに保存された`claude_code_options`のJSON内の`worktree`フィールドを参照する。

**判定ロジック（ClaudeOptionsService.hasWorktreeOption()）:**
```typescript
static hasWorktreeOption(options: ClaudeCodeOptions): boolean {
  if (typeof options.worktree === 'string') return options.worktree.length > 0;
  return options.worktree === true;
}
```

## 3. コンポーネント設計

### 3.1 ClaudeCodeOptionsインターフェース拡張

**変更前:**
```typescript
export interface ClaudeCodeOptions {
  model?: string;
  allowedTools?: string;
  permissionMode?: string;
  additionalFlags?: string;
  dangerouslySkipPermissions?: boolean;
}
```

**変更後:**
```typescript
export interface ClaudeCodeOptions {
  model?: string;
  allowedTools?: string;
  permissionMode?: string;
  additionalFlags?: string;
  dangerouslySkipPermissions?: boolean;
  worktree?: boolean | string;  // --worktree [name]
}
```

### 3.2 ClaudeOptionsService変更

#### 3.2.1 buildCliArgs()

**追加ロジック:**
```typescript
if (options.worktree === true) {
  args.push('--worktree');
} else if (typeof options.worktree === 'string' && options.worktree.length > 0) {
  args.push('--worktree', options.worktree);
}
```

- `worktree: true` → `--worktree`（Claude Codeが自動命名）
- `worktree: "feature-auth"` → `--worktree feature-auth`
- `worktree: false` / `undefined` → 引数なし（従来動作）

#### 3.2.2 mergeOptions()

worktreeフィールドのマージはbooleanフィールドと同様に扱うが、string型も許容する:

```typescript
// worktreeフィールドのマージ（boolean | string）
if (sessionOptions.worktree !== undefined) {
  merged.worktree = sessionOptions.worktree;
} else if (projectOptions.worktree !== undefined) {
  merged.worktree = projectOptions.worktree;
}
```

#### 3.2.3 validateClaudeCodeOptions()

- `allowedKeys`に`'worktree'`を追加
- worktreeフィールドの型チェック: `boolean`または`string`を許容

```typescript
if ('worktree' in obj) {
  const fieldValue = obj.worktree;
  if (typeof fieldValue !== 'boolean' && typeof fieldValue !== 'string' && fieldValue !== undefined) {
    return null;
  }
  if (typeof fieldValue === 'boolean') {
    result.worktree = fieldValue;
  } else if (typeof fieldValue === 'string') {
    result.worktree = fieldValue;
  }
}
```

#### 3.2.4 parseOptions()

worktreeフィールドのパースを追加:

```typescript
// boolean | stringフィールド
if ('worktree' in parsed) {
  if (typeof parsed.worktree === 'boolean' || typeof parsed.worktree === 'string') {
    result.worktree = parsed.worktree;
  }
}
```

#### 3.2.5 hasWorktreeOption() - 新規メソッド

worktreeオプションが有効かどうかを判定するヘルパーメソッド:

```typescript
static hasWorktreeOption(options: ClaudeCodeOptions): boolean {
  if (typeof options.worktree === 'string') return options.worktree.length > 0;
  return options.worktree === true;
}
```

セッション作成API・削除APIの両方で使用する。

### 3.3 セッション作成API変更

**ファイル:** `src/app/api/projects/[project_id]/sessions/route.ts`

worktree作成ロジック（行383-433）を条件付きに変更:

**注意:** 現在の実装では、CLIオプションの本マージはWebSocketハンドラー（claude-ws.ts）で行われている。
ここでのマージはworktree判定のためだけに行う簡易マージであり、CLIオプションの最終的なマージとは別の処理。

```typescript
// マージ済みオプションでworktree有効判定（worktreeスキップ判定のための簡易マージ）
const projectOptions = ClaudeOptionsService.parseOptions(project.claude_code_options);
const sessionWorktreeOptions = claude_code_options || {};
const mergedForWorktreeCheck = ClaudeOptionsService.mergeOptions(projectOptions, sessionWorktreeOptions);
const useClaudeWorktree = ClaudeOptionsService.hasWorktreeOption(mergedForWorktreeCheck);

let worktreePath: string;
let branchName: string;

if (useClaudeWorktree) {
  // Claude Codeがworktreeを管理するため、プロジェクトパスをそのまま使用
  if (project.clone_location === 'docker') {
    worktreePath = '/repo';
  } else {
    worktreePath = project.path;
  }
  branchName = '';  // Claude Codeが自動でブランチを作成
  logger.info('Using Claude Code --worktree mode, skipping manual worktree creation', {
    project_id,
    sessionName,
  });
} else {
  // 従来通りClaudeWorkがworktreeを作成
  // ... 既存のworktree作成ロジック
}
```

### 3.4 セッション削除API変更

**ファイル:** `src/app/api/sessions/[id]/route.ts`

worktree削除ロジック（行133-154）を条件付きに変更:

```typescript
// セッションのclaude_code_optionsからworktree設定を確認
const sessionOptions = ClaudeOptionsService.parseOptions(targetSession.claude_code_options);
const projectOptions = ClaudeOptionsService.parseOptions(targetSession.project?.claude_code_options);
const mergedOptions = ClaudeOptionsService.mergeOptions(projectOptions, sessionOptions);
const useClaudeWorktree = ClaudeOptionsService.hasWorktreeOption(mergedOptions);

if (!useClaudeWorktree) {
  // 従来モード: ClaudeWorkがworktreeを削除
  try {
    const sessionName = targetSession.worktree_path.split('/').pop() || '';
    // ... 既存のworktree削除ロジック
  } catch (error) {
    // ... 既存のエラーハンドリング
  }
} else {
  logger.info('Skipping worktree deletion (managed by Claude Code --worktree)', {
    session_id: targetSession.id,
  });
}
```

### 3.5 UIフォーム変更

**ファイル:** `src/components/claude-options/ClaudeOptionsForm.tsx`

「追加フラグ」フィールドの前に「Worktreeモード」セクションを追加:

```
┌─────────────────────────────────────────────────────┐
│ Claude Code オプション（詳細設定）          [▼]     │
│                                                     │
│ モデル                                              │
│ [                                              ]    │
│                                                     │
│ 許可ツール                                          │
│ [                                              ]    │
│                                                     │
│ 権限モード                                          │
│ [指定なし                                    ▼]    │
│                                                     │
│ Worktreeモード                                      │
│ [✓] Claude Codeにworktree管理を委任する            │
│     Worktree名（省略時は自動生成）                  │
│     [feature-auth                              ]    │
│                                                     │
│ 追加フラグ                                          │
│ [                                              ]    │
│                                                     │
│ カスタム環境変数                                    │
│ ...                                                 │
└─────────────────────────────────────────────────────┘
```

**実装:**
```typescript
<div>
  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
    Worktreeモード
  </label>
  <div className="flex items-center gap-2 mb-2">
    <input
      type="checkbox"
      checked={!!options.worktree}
      onChange={(e) => {
        if (e.target.checked) {
          onOptionsChange({ ...options, worktree: true });
        } else {
          const { worktree: _, ...rest } = options;
          onOptionsChange(rest);
        }
      }}
      disabled={disabled}
    />
    <span className="text-sm text-gray-700 dark:text-gray-300">
      Claude Codeにworktree管理を委任する
    </span>
  </div>
  {!!options.worktree && (
    <div className="ml-6">
      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
        Worktree名（省略時は自動生成）
      </label>
      <input
        type="text"
        value={typeof options.worktree === 'string' ? options.worktree : ''}
        onChange={(e) => {
          onOptionsChange({
            ...options,
            worktree: e.target.value || true,
          });
        }}
        placeholder="例: feature-auth"
        className="w-full px-3 py-1.5 text-sm border ..."
        disabled={disabled}
      />
    </div>
  )}
</div>
```

### 3.6 hasAnySettings判定の更新

`ClaudeOptionsForm`の`hasAnySettings`にworktreeを追加:

```typescript
const hasAnySettings = !!(
  options.model ||
  options.allowedTools ||
  options.permissionMode ||
  options.additionalFlags ||
  options.worktree ||          // 追加
  envEntries.length > 0
);
```

## 4. 技術的決定事項

### TD-001: DBスキーマ変更なし
`worktree`オプションは`claude_code_options`のJSON内に格納する。既存の`ClaudeCodeOptions`パターンに従い、新しいカラムの追加は行わない。

### TD-002: worktreeパスの扱い
`--worktree`モードでは、Claude Codeが`.claude/worktrees/<name>/`にworktreeを作成する。ClaudeWork側ではセッションの`worktree_path`としてプロジェクトルートパスを保存する。これはClaude Code起動時の`cwd`として使用される。

### TD-003: branch_nameの扱い
`--worktree`モードでは、Claude Codeがworktree用のブランチを自動作成する。ClaudeWork側の`branch_name`は空文字列を保存する。

**影響を受ける既存機能（空文字列ハンドリングが必要）:**
- `src/app/api/sessions/[id]/pr/route.ts`: PR作成時に`branch_name`を`--head`引数として使用 → 空文字列の場合はPR作成不可としてエラーを返す
- `src/services/git-service.ts`: squashマージ時にブランチ名を参照 → 空文字列の場合はマージ不可としてエラーを返す
- `src/services/pty-session-manager.ts`: メタデータとして保存（参照のみ、動作には影響なし）

### TD-004: Docker環境でのworktreeサポート
Docker環境（`clone_location='docker'`）でも`--worktree`オプションを利用可能とする。Docker環境ではClaude Codeがコンテナ内部でworktreeを作成するため、ClaudeWorkの`worktree_path`は`/repo`（Dockerボリュームのマウントポイント）を保存する。

### TD-005: マージ優先順位
`worktree`フィールドのマージは他のフィールドと同様に、セッション設定がプロジェクト設定をオーバーライドする。プロジェクトレベルで`worktree: true`を設定しておき、全セッションでClaude Code管理のworktreeを使用するユースケースを想定。

### TD-006: 後方互換性の保証
`worktree`が未指定の場合（既存のセッション含む）、従来通りClaudeWorkがworktreeを作成・管理する。既存のセッションデータへの影響はない。

## 5. テスト方針

### 単体テスト

#### ClaudeOptionsService
- `buildCliArgs()`: `worktree: true` → `['--worktree']`
- `buildCliArgs()`: `worktree: "name"` → `['--worktree', 'name']`
- `buildCliArgs()`: `worktree: false` → `[]`（引数なし）
- `mergeOptions()`: セッションのworktreeがプロジェクトをオーバーライド
- `validateClaudeCodeOptions()`: worktreeフィールドのboolean/string許容
- `validateClaudeCodeOptions()`: worktreeフィールドの不正型拒否
- `parseOptions()`: worktreeフィールドのパース
- `hasWorktreeOption()`: 各パターンの判定

#### セッション作成API
- `worktree: true`の場合、GitService.createWorktree()が呼ばれないこと
- `worktree`未指定の場合、従来通りworktreeが作成されること
- `worktree: true`の場合、worktree_pathがプロジェクトルートパスであること

#### セッション削除API
- `worktree: true`の場合、GitService.deleteWorktree()が呼ばれないこと
- `worktree`未指定の場合、従来通りworktreeが削除されること

### 手動テスト
- `worktree`オプション有効でセッション作成し、Claude Codeがworktreeを作成すること
- `worktree`オプション無効で従来動作が維持されること
- UIフォームでworktreeモードのON/OFF切り替え
- Worktree名の入力と反映
