# 設計書: アプリケーション共通Claude Code設定・環境オーバーライド・Worktree移行

## アーキテクチャ概要

Claude Code起動オプションの設定解決を4層のカスケード方式に変更し、アプリ側のworktree管理を削除してClaude Code本体の`--worktree`フラグに移行する。

```
設定解決フロー:

+------------------+     +----------------------+     +------------------+     +-----------------+
| App Defaults     | --> | Environment Override  | --> | Project Options  | --> | Session Options |
| (settings.json)  |     | (env.config JSON)     |     | (claude_code_    |     | (claude_code_   |
|                  |     |                       |     |  options)        |     |  options)       |
| - skipPermissions|     | - "inherit" or value  |     | - per-project    |     | - per-session   |
| - worktree       |     |   per key             |     |                  |     |                 |
+------------------+     +----------------------+     +------------------+     +-----------------+
                                                                                       |
                                                                                       v
                                                                              +------------------+
                                                                              | Final Resolved   |
                                                                              | Options          |
                                                                              +------------------+
```

### 現在のアーキテクチャとの差分

| 項目 | 現在 | 変更後 |
|------|------|--------|
| skipPermissions解決 | env.config.skipPermissions or claudeCodeOptions.dangerouslySkipPermissions | 4層カスケード解決 |
| worktree作成 | git-service.ts / docker-git-service.ts | Claude Code --worktree |
| worktree削除 | セッション削除API内で実行 | Claude Code管理（アプリ側は不要） |
| 共通デフォルト | なし | ConfigService.claude_defaults |
| 環境オーバーライド | env.config.skipPermissions（ad-hoc） | env.config.claude_defaults_override（構造化） |

## コンポーネント一覧

| コンポーネント | 変更種別 | 説明 |
|---------------|---------|------|
| ConfigService | 拡張 | AppConfigにclaude_defaults追加 |
| ClaudeDefaultsResolver | 新規 | 4層カスケード設定解決ロジック |
| PTYSessionManager | 変更 | 設定解決をClaudeDefaultsResolverに委譲 |
| /api/settings/config | 拡張 | claude_defaults設定のGET/PUT |
| /api/projects/[id]/sessions | 変更 | worktree手動作成を削除 |
| /api/sessions/[id] | 変更 | worktree手動削除を削除 |
| git-service.ts | 縮小 | createWorktree/deleteWorktree削除 |
| docker-git-service.ts | 縮小 | worktree関連メソッド削除 |
| 設定UI | 拡張 | Claude Codeデフォルト設定セクション追加 |
| 環境設定UI | 拡張 | オーバーライドUI追加 |

## 1. ConfigService拡張

### AppConfig型の変更

```typescript
// src/services/config-service.ts

export interface ClaudeDefaults {
  dangerouslySkipPermissions?: boolean;  // デフォルト: false
  worktree?: boolean;                     // デフォルト: true
}

export interface AppConfig {
  git_clone_timeout_minutes?: number;
  debug_mode_keep_volumes?: boolean;
  registry_firewall_enabled?: boolean;
  claude_defaults?: ClaudeDefaults;       // 新規追加
}

const DEFAULT_CONFIG: Required<AppConfig> = {
  git_clone_timeout_minutes: 5,
  debug_mode_keep_volumes: false,
  registry_firewall_enabled: true,
  claude_defaults: {
    dangerouslySkipPermissions: false,
    worktree: true,
  },
};
```

### 追加メソッド

```typescript
getClaudeDefaults(): ClaudeDefaults {
  return { ...this.config.claude_defaults };
}
```

## 2. 環境オーバーライド設計

### ExecutionEnvironment.config JSON構造の拡張

既存の`config` JSONフィールドに`claude_defaults_override`キーを追加する。新しいテーブルは作成しない（既存パターンに合わせる）。

```typescript
// ExecutionEnvironment.config の構造
interface EnvironmentConfig {
  // 既存フィールド（Docker環境用）
  imageName?: string;
  imageTag?: string;
  imageSource?: string;
  buildImageName?: string;
  skipPermissions?: boolean;  // DEPRECATED: claude_defaults_overrideに移行

  // 新規追加
  claude_defaults_override?: {
    dangerouslySkipPermissions?: boolean | 'inherit';  // 'inherit' = アプリ共通設定に従う
    worktree?: boolean | 'inherit';                     // 'inherit' = アプリ共通設定に従う
  };
}
```

**設計判断**: `'inherit'`という文字列値は「アプリ共通設定を継承する」ことを明示的に表す。フィールドがundefined（キーが存在しない）の場合も継承として扱う。これにより、既存の環境設定がそのまま継承として機能する（後方互換）。

### 旧skipPermissionsからの移行

既存の`env.config.skipPermissions`は後方互換のために読み取りをサポートするが、新しい`claude_defaults_override.dangerouslySkipPermissions`が存在する場合はそちらを優先する。

```typescript
// 後方互換の解決ロジック
function resolveEnvSkipPermissions(envConfig: EnvironmentConfig): boolean | 'inherit' {
  if (envConfig.claude_defaults_override?.dangerouslySkipPermissions !== undefined) {
    return envConfig.claude_defaults_override.dangerouslySkipPermissions;
  }
  if (envConfig.skipPermissions !== undefined) {
    return envConfig.skipPermissions;
  }
  return 'inherit';
}
```

## 3. 設定解決サービス（ClaudeDefaultsResolver）

### 新規サービス: `src/services/claude-defaults-resolver.ts`

```typescript
export interface ResolvedClaudeOptions {
  dangerouslySkipPermissions: boolean;
  worktree: boolean | string;
  // 他のClaudeCodeOptionsフィールドはプロジェクト/セッションから直接マージ
  model?: string;
  allowedTools?: string;
  permissionMode?: string;
  additionalFlags?: string;
}

export class ClaudeDefaultsResolver {
  /**
   * 4層カスケードで設定を解決
   *
   * 1. アプリ共通設定 (ConfigService.claude_defaults)
   * 2. 環境オーバーライド (env.config.claude_defaults_override)
   * 3. プロジェクト設定 (project.claude_code_options)
   * 4. セッション設定 (session.claude_code_options)
   *
   * HOST環境ではdangerouslySkipPermissionsは常にfalse
   */
  static resolve(
    appDefaults: ClaudeDefaults,
    envConfig: EnvironmentConfig,
    envType: 'HOST' | 'DOCKER' | 'SSH',
    projectOptions: ClaudeCodeOptions,
    sessionOptions: ClaudeCodeOptions | null
  ): ResolvedClaudeOptions;
}
```

### 解決ロジックの詳細

```
dangerouslySkipPermissions:
  1. appDefaults.dangerouslySkipPermissions (default: false)
  2. env.claude_defaults_override.dangerouslySkipPermissions (if !== 'inherit' && !== undefined)
  3. project.claude_code_options.dangerouslySkipPermissions (if !== undefined)
  4. session.claude_code_options.dangerouslySkipPermissions (if !== undefined)
  5. HOST環境の場合は常にfalseに強制

worktree:
  1. appDefaults.worktree (default: true)
  2. env.claude_defaults_override.worktree (if !== 'inherit' && !== undefined)
  3. project.claude_code_options.worktree (if !== undefined)
  4. session.claude_code_options.worktree (if !== undefined)

他のフィールド (model, allowedTools, permissionMode, additionalFlags):
  解決順序は変更なし: project -> session (ClaudeOptionsService.mergeOptions)
```

## 4. PTYSessionManager変更

### 現在のskipPermissions解決ロジックの置き換え

**現在** (`pty-session-manager.ts` L179-189):
```typescript
// skipPermissions の解決（Docker環境のみ）
let skipPermissions = false
if (environment.type === 'DOCKER') {
  let envConfig = JSON.parse(environment.config || '{}')
  skipPermissions = claudeCodeOptions?.dangerouslySkipPermissions
    ?? (envConfig.skipPermissions === true)
}
```

**変更後**:
```typescript
// 4層カスケードで設定を解決
const configService = await ensureConfigLoaded()
const appDefaults = configService.getClaudeDefaults()
const envConfig = JSON.parse(environment.config || '{}')
const projectOptions = ClaudeOptionsService.parseOptions(project.claude_code_options)

const resolved = ClaudeDefaultsResolver.resolve(
  appDefaults,
  envConfig,
  environment.type,
  projectOptions,
  claudeCodeOptions || null
)

const skipPermissions = resolved.dangerouslySkipPermissions
// worktreeはセッション作成API側で処理済み（worktree_pathの決定に使用）
```

## 5. セッション作成APIの変更

### worktree手動作成の削除

**現在** (`src/app/api/projects/[project_id]/sessions/route.ts` L269-343):
- `useClaudeWorktree`フラグでClaude Code管理かアプリ管理かを分岐
- アプリ管理の場合、GitService.createWorktree()またはDockerGitService.createWorktree()を呼び出し

**変更後**:
- 常にClaude Code --worktreeモードを使用
- worktree_pathはプロジェクトパスを設定（Docker: `/repo`、Host: `project.path`）
- branch_nameは空文字列
- git-service.ts / docker-git-service.tsのworktree作成ロジックは不要

```typescript
// 変更後のセッション作成ロジック
// worktreeは常にClaude Code管理
let worktreePath: string;
if (project.clone_location === 'docker') {
  worktreePath = '/repo';
} else {
  worktreePath = project.path;
}
const branchName = '';

// worktree作成のtry-catch ブロックは完全に削除
```

## 6. セッション削除APIの変更

### worktree手動削除の削除

**現在** (`src/app/api/sessions/[id]/route.ts` L133-163):
- `useClaudeWorktree`フラグで分岐
- アプリ管理の場合、GitService.deleteWorktree()またはDockerGitService.deleteWorktree()を呼び出し

**変更後**:
- worktree削除ロジックを完全に削除
- Claude Codeが`--worktree`で作成したworktreeはClaude Codeが管理するため、アプリ側での削除は不要

```typescript
// 変更後のセッション削除ロジック
// worktree削除は不要（Claude Codeが管理）
// 直接DBレコードを削除
await db.delete(schema.sessions).where(eq(schema.sessions.id, id)).run();
```

## 7. git-service.tsの変更

### 削除するメソッド

| メソッド | 理由 |
|---------|------|
| `createWorktree()` | Claude Code --worktreeに移行 |
| `deleteWorktree()` | Claude Code管理のためアプリ側不要 |
| `ensureWorktreeDirectoryWritable()` | createWorktreeの依存メソッド |
| `validateWorktreePath()` | worktree関連で使用（diff/commits等で引き続き使うか要確認） |

### 残存メソッド

| メソッド | 理由 |
|---------|------|
| `getDiff()` | worktreeパスを引数として受け取るため引き続き使用可能 |
| `getDiffDetails()` | 同上 |
| `rebaseFromMain()` | 同上 |
| `getCommits()` | 同上 |
| `reset()` | 同上 |
| `squashMerge()` | 同上 |
| `validateName()` | 残存メソッドで使用 |

**注意**: getDiff等のメソッドは`sessionName`を受け取り内部で`.worktrees/sessionName`パスを構築している。Claude Code管理のworktreeでは、ワークトリーの場所がClaude Code依存になるため、これらのメソッドは`sessionName`ではなく`worktreePath`を直接受け取るように変更が必要。ただし、これは本変更のスコープ外であり、今後のリファクタリングで対応する。

**暫定対応**: Claude Code --worktreeモードでは、worktreeパスが不定のため、diff/commits/rebase APIは`Session.worktree_path`（プロジェクトパス）をcwdとして使用する。mainブランチとの差分取得はgit操作のcwdを変更するだけで動作する。

## 8. docker-git-service.tsの変更

### 削除するメソッド

| メソッド | 理由 |
|---------|------|
| `createWorktree()` | Claude Code --worktreeに移行 |
| `deleteWorktree()` | Claude Code管理のためアプリ側不要 |

### 残存メソッド

`createVolume()`、`deleteVolume()`、`cloneRepository()`等のボリューム/クローン関連は変更なし。

## 9. API設計

### GET/PUT /api/settings/config 拡張

**リクエスト/レスポンスの変更**:

```typescript
// GETレスポンス
{
  "config": {
    "git_clone_timeout_minutes": 5,
    "debug_mode_keep_volumes": false,
    "registry_firewall_enabled": true,
    "claude_defaults": {                    // 新規追加
      "dangerouslySkipPermissions": false,
      "worktree": true
    }
  }
}

// PUTリクエスト
{
  "claude_defaults": {
    "dangerouslySkipPermissions": true,
    "worktree": true
  }
}
```

**バリデーション**:
- `claude_defaults`がオブジェクトであること
- `dangerouslySkipPermissions`がboolean型であること
- `worktree`がboolean型であること
- 未知のキーが含まれていないこと

### PUT /api/environments/:id 拡張

既存のconfig JSONを拡張。APIインターフェース自体の変更は不要（configフィールドのJSON構造のみ変更）。

## 10. UI設計

### 設定ページ（/settings/app）追加セクション

```
[Claude Code デフォルト設定]
--------------------------------------------
パーミッション自動スキップ (Docker環境のみ)
  [x] 有効 (--dangerously-skip-permissions)
  ※ HOST環境では常に無効

Worktreeモード
  [x] 有効 (--worktree)
  ※ 有効時、各セッションがClaude Codeの--worktreeで分離されます
--------------------------------------------
```

### 環境設定モーダル追加セクション

```
[Claude Code設定オーバーライド]
--------------------------------------------
パーミッション自動スキップ
  ( ) アプリ設定に従う [現在: 無効]
  ( ) 有効
  (x) 無効

Worktreeモード
  (x) アプリ設定に従う [現在: 有効]
  ( ) 有効
  ( ) 無効
--------------------------------------------
```

## 影響を受けるファイルの全リスト

### バックエンド（変更）

| ファイル | 変更内容 |
|---------|---------|
| `src/services/config-service.ts` | AppConfigにclaude_defaults追加、ゲッター追加 |
| `src/services/claude-defaults-resolver.ts` | **新規作成**: 4層カスケード解決サービス |
| `src/services/pty-session-manager.ts` | skipPermissions解決をClaudeDefaultsResolverに置き換え |
| `src/services/git-service.ts` | createWorktree/deleteWorktree/ensureWorktreeDirectoryWritable削除 |
| `src/services/docker-git-service.ts` | createWorktree/deleteWorktree削除 |
| `src/services/claude-options-service.ts` | (変更なし、既存のmergeOptionsは引き続き使用) |
| `src/app/api/settings/config/route.ts` | claude_defaults設定のバリデーション・保存 |
| `src/app/api/projects/[project_id]/sessions/route.ts` | worktree手動作成ロジック削除、常にClaude Code管理 |
| `src/app/api/sessions/[id]/route.ts` | worktree手動削除ロジック削除 |
| `src/app/api/environments/route.ts` | (変更なし、config JSON構造の拡張は透過的) |
| `src/app/api/environments/[id]/route.ts` | (変更なし) |

### フロントエンド（変更）

| ファイル | 変更内容 |
|---------|---------|
| `src/app/settings/app/page.tsx` | Claude Codeデフォルトセクション追加 |
| `src/components/environments/` | オーバーライドUIセクション追加（環境設定モーダル内） |

### テスト（変更・新規）

| ファイル | 変更内容 |
|---------|---------|
| `src/services/__tests__/config-service.test.ts` | claude_defaults設定テスト追加 |
| `src/services/__tests__/claude-defaults-resolver.test.ts` | **新規**: 4層解決ロジックテスト |
| `src/services/__tests__/pty-session-manager.test.ts` | skipPermissions解決テスト更新 |
| `src/services/__tests__/git-service.test.ts` | createWorktree/deleteWorktreeテスト削除 |
| `src/services/__tests__/docker-git-service.test.ts` | worktree関連テスト削除 |
| `src/app/api/settings/config/__tests__/route.test.ts` | claude_defaults APIテスト追加 |
| `src/app/api/projects/[project_id]/sessions/__tests__/route.test.ts` | worktree作成テスト削除・更新 |
| `src/app/api/sessions/[id]/__tests__/route.test.ts` | worktree削除テスト更新 |

### 削除対象

| ファイル/コード | 詳細 |
|---------------|------|
| `git-service.ts: createWorktree()` | 約50行 |
| `git-service.ts: deleteWorktree()` | 約40行 |
| `git-service.ts: ensureWorktreeDirectoryWritable()` | 約90行 |
| `docker-git-service.ts: createWorktree()` | 関連メソッド |
| `docker-git-service.ts: deleteWorktree()` | 関連メソッド |
| セッション作成APIのworktreeブランチ | 約50行 |
| セッション削除APIのworktreeブランチ | 約30行 |

## 要件トレーサビリティ

| 要件ID | 設計要素 | 対応方法 |
|--------|---------|---------|
| REQ-001 | ConfigService拡張 | AppConfig.claude_defaults追加 |
| REQ-002 | ConfigService拡張 | getClaudeDefaults()メソッド追加 |
| REQ-003 | /api/settings/config拡張 | claude_defaults設定のGET/PUT |
| REQ-004 | 設定UI | /settings/appにClaude Codeデフォルトセクション追加 |
| REQ-005 | 環境config JSON拡張 | claude_defaults_override構造追加 |
| REQ-006 | 環境設定UI | オーバーライドUIセクション追加 |
| REQ-007 | ClaudeDefaultsResolver | 4層カスケード解決ロジック |
| REQ-008 | git-service.ts変更 | createWorktree削除 |
| REQ-009 | docker-git-service.ts変更 | worktree関連メソッド削除 |
| REQ-010 | セッション作成API変更 | worktree手動作成削除 |
| REQ-011 | セッション削除API変更 | worktree手動削除削除 |
| REQ-012 | ConfigService + セッション作成 | デフォルトworktree=true |
| REQ-013 | セッション作成API変更 | worktree_path=プロジェクトパス、branch_name=空 |
| NFR-001 | セッション削除API | branch_name空チェックの既存ロジック維持 |
| NFR-003 | ClaudeDefaultsResolver | HOST環境でskipPermissions強制false |
| NFR-004 | マイグレーション | Drizzle migrate()自動適用（スキーマ変更なしのためマイグレーション不要） |
| NFR-005 | ClaudeDefaultsResolver | セッション起動時に1回だけ解決 |

## エスカレーション事項

以下の点は実装時にアーキテクチャレベルの判断が必要:

1. **diff/commits/rebase APIへの影響**: 現在これらのAPIはsessionNameからworktreeパスを構築している。Claude Code管理のworktreeでは、worktreeの場所がClaude Code内部で決定されるため、アプリからworktreeパスを特定できない可能性がある。暫定的にはSession.worktree_path（=プロジェクトパス）をcwdとして使用するが、mainブランチとの差分が正しく取れるか検証が必要。

2. **squashMergeの扱い**: squashMergeはメインリポジトリのcwdでgit merge --squashを実行しているが、Claude Code --worktreeで作成されたブランチ名がアプリから取得できない場合、squashMerge機能は利用不可になる可能性がある。
