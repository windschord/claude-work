# 設計書: Claude Code 実行オプション・環境変数設定機能

## 1. アーキテクチャ概要

```
┌──────────────────────────────────────────────────────────────┐
│ Frontend                                                     │
│  ┌────────────────────────┐  ┌─────────────────────────────┐ │
│  │ ProjectSettingsModal   │  │ CreateSessionModal          │ │
│  │ ・デフォルトCLIオプション │  │ ・セッション固有CLIオプション │ │
│  │ ・デフォルト環境変数     │  │ ・セッション固有環境変数     │ │
│  └───────┬────────────────┘  └───────┬─────────────────────┘ │
│          │ PUT /api/projects/:id      │ POST /api/projects/:id/sessions │
└──────────┼───────────────────────────┼──────────────────────┘
           ▼                           ▼
┌──────────────────────────────────────────────────────────────┐
│ API Layer                                                    │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ sessions/route.ts POST                                   ││
│  │ 1. body.claude_code_options, body.custom_env_vars受信     ││
│  │ 2. プロジェクトデフォルト取得                              ││
│  │ 3. マージしてDB保存                                       ││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────┬───────────────────────────┘
                                   │
┌──────────────────────────────────▼───────────────────────────┐
│ WebSocket Layer (claude-ws.ts)                               │
│  1. DBからセッション取得（claude_code_options, custom_env_vars)│
│  2. adapter.createSession()にオプションを渡す                 │
└──────────────────────────────────┬───────────────────────────┘
                                   │
┌──────────────────────────────────▼───────────────────────────┐
│ Adapter Layer                                                │
│  HostAdapter.createSession() → ClaudePTYManager.createSession│
│  ・CLIオプション → cliArgs に追加                             │
│  ・環境変数 → buildClaudePtyEnv() に追加                     │
└──────────────────────────────────────────────────────────────┘
```

## 2. データベース変更

### 2.1 projectsテーブルへのカラム追加

| カラム名 | 型 | デフォルト | 説明 |
|---------|------|----------|------|
| `claude_code_options` | TEXT | `'{}'` | JSON文字列: デフォルトCLIオプション |
| `custom_env_vars` | TEXT | `'{}'` | JSON文字列: デフォルトカスタム環境変数 |

### 2.2 sessionsテーブルへのカラム追加

| カラム名 | 型 | デフォルト | 説明 |
|---------|------|----------|------|
| `claude_code_options` | TEXT | null | JSON文字列: セッション固有CLIオプション（nullの場合プロジェクトデフォルト使用） |
| `custom_env_vars` | TEXT | null | JSON文字列: セッション固有カスタム環境変数（nullの場合プロジェクトデフォルト使用） |

### 2.3 JSON構造

```typescript
// CLIオプション
interface ClaudeCodeOptions {
  model?: string;           // --model <value>
  allowedTools?: string;    // --allowedTools <value>
  permissionMode?: string;  // --permission-mode <value>
  additionalFlags?: string; // その他フラグ（スペース区切り文字列）
}

// カスタム環境変数
interface CustomEnvVars {
  [key: string]: string;    // KEY=VALUE形式
}
```

## 3. コンポーネント設計

### 3.1 バックエンド変更

#### 3.1.1 `src/db/schema.ts` - スキーマ変更

```typescript
// projectsテーブルに追加
claude_code_options: text('claude_code_options').notNull().default('{}'),
custom_env_vars: text('custom_env_vars').notNull().default('{}'),

// sessionsテーブルに追加
claude_code_options: text('claude_code_options'),
custom_env_vars: text('custom_env_vars'),
```

#### 3.1.2 `src/services/claude-options-service.ts` - 新規サービス

マージロジックとバリデーションを担当する新規サービス。

```typescript
export class ClaudeOptionsService {
  /**
   * プロジェクトデフォルトとセッション固有設定をマージ
   * セッション固有設定がプロジェクトデフォルトをオーバーライド
   */
  static mergeOptions(
    projectOptions: ClaudeCodeOptions,
    sessionOptions: ClaudeCodeOptions | null
  ): ClaudeCodeOptions;

  /**
   * プロジェクトデフォルトとセッション固有環境変数をマージ
   * セッション固有環境変数がプロジェクトデフォルトをオーバーライド
   */
  static mergeEnvVars(
    projectEnvVars: CustomEnvVars,
    sessionEnvVars: CustomEnvVars | null
  ): CustomEnvVars;

  /**
   * CLIオプションを引数配列に変換
   */
  static buildCliArgs(options: ClaudeCodeOptions): string[];

  /**
   * カスタム環境変数をPTY環境変数にマージ
   */
  static buildEnv(
    baseEnv: Record<string, string>,
    customVars: CustomEnvVars
  ): Record<string, string>;

  /**
   * 環境変数キーのバリデーション
   */
  static validateEnvVarKey(key: string): boolean;
}
```

#### 3.1.3 `src/services/claude-pty-manager.ts` - 変更

`CreateClaudePTYSessionOptions`に新しいフィールドを追加：

```typescript
export interface CreateClaudePTYSessionOptions {
  resumeSessionId?: string;
  dockerMode?: boolean;
  claudeCodeOptions?: ClaudeCodeOptions;  // 追加
  customEnvVars?: CustomEnvVars;          // 追加
}
```

`createSession()`メソッドの変更：
- `cliArgs`構築時に`claudeCodeOptions`を使用
- `buildClaudePtyEnv()`に`customEnvVars`を渡す

#### 3.1.4 `src/services/environment-adapter.ts` - 変更

`CreateSessionOptions`に新しいフィールドを追加：

```typescript
export interface CreateSessionOptions {
  resumeSessionId?: string;
  shellMode?: boolean;
  claudeCodeOptions?: ClaudeCodeOptions;  // 追加
  customEnvVars?: CustomEnvVars;          // 追加
}
```

#### 3.1.5 `src/lib/websocket/claude-ws.ts` - 変更

PTY作成時にDBからオプションを取得してマージし、`createSession()`に渡す。

```typescript
// セッション作成時の追加ロジック
const project = await db.query.projects.findFirst({...});
const mergedOptions = ClaudeOptionsService.mergeOptions(
  JSON.parse(project.claude_code_options || '{}'),
  session.claude_code_options ? JSON.parse(session.claude_code_options) : null
);
const mergedEnvVars = ClaudeOptionsService.mergeEnvVars(
  JSON.parse(project.custom_env_vars || '{}'),
  session.custom_env_vars ? JSON.parse(session.custom_env_vars) : null
);

adapter.createSession(sessionId, session.worktree_path, firstMessage?.content, {
  resumeSessionId: session.resume_session_id || undefined,
  claudeCodeOptions: mergedOptions,
  customEnvVars: mergedEnvVars,
});
```

#### 3.1.6 API Routes変更

**`src/app/api/projects/[project_id]/route.ts` PUT**:
- `claude_code_options`と`custom_env_vars`をリクエストボディから受け取り保存

**`src/app/api/projects/[project_id]/sessions/route.ts` POST**:
- `claude_code_options`と`custom_env_vars`をリクエストボディから受け取りセッションに保存

### 3.2 フロントエンド変更

#### 3.2.1 `src/components/sessions/ClaudeOptionsForm.tsx` - 新規コンポーネント

CLIオプションとカスタム環境変数の入力フォーム。折りたたみ式（Disclosure）で初期非表示。

```
┌─ Claude Code オプション（詳細設定） ──────────── ▼ ┐
│                                                    │
│  モデル:        [________________] (任意)           │
│  許可ツール:    [________________] (任意)           │
│  権限モード:    [▼ 選択してください] (任意)          │
│  追加フラグ:    [________________] (任意)           │
│                                                    │
│  ── カスタム環境変数 ──                              │
│  KEY             VALUE                              │
│  [____________]  [__________________] [×]           │
│  [____________]  [__________________] [×]           │
│  [+ 環境変数を追加]                                  │
└────────────────────────────────────────────────────┘
```

**Props**:
```typescript
interface ClaudeOptionsFormProps {
  options: ClaudeCodeOptions;
  envVars: CustomEnvVars;
  onOptionsChange: (options: ClaudeCodeOptions) => void;
  onEnvVarsChange: (envVars: CustomEnvVars) => void;
  disabled?: boolean;
}
```

#### 3.2.2 `CreateSessionModal.tsx` - 変更

`ClaudeOptionsForm`を組み込み、セッション作成時にオプションと環境変数をAPIに送信。

#### 3.2.3 `ProjectSettingsModal.tsx` - 変更

`ClaudeOptionsForm`を組み込み、プロジェクトデフォルト設定を管理。

## 4. マージ戦略の詳細

### 4.1 CLIオプションのマージ

```
最終結果 = {
  model:           session.model           ?? project.model,
  allowedTools:    session.allowedTools    ?? project.allowedTools,
  permissionMode:  session.permissionMode  ?? project.permissionMode,
  additionalFlags: session.additionalFlags ?? project.additionalFlags,
}
```

空文字列 `""` はプロジェクトデフォルトのクリア（未指定に戻す）として扱う。

### 4.2 環境変数のマージ

```
最終結果 = { ...projectEnvVars, ...sessionEnvVars }
```

セッション側で同じキーを指定すればプロジェクトデフォルトをオーバーライド。

## 5. セキュリティ考慮

- 環境変数のvalueはログに出力しない（keyのみ記録）
- `buildClaudePtyEnv()`の安全リストは維持。カスタム環境変数は安全リストに追加するのではなく、別途マージする
- 環境変数キーは `^[A-Z_][A-Z0-9_]*$` パターンのみ許可
- `additionalFlags`のインジェクション対策: 改行・制御文字を禁止

## 6. 後方互換性

- 既存セッション/プロジェクトの`claude_code_options`と`custom_env_vars`はデフォルト値（`'{}'` / `null`）のため、既存動作に影響なし
- UI上でオプション未入力の場合は従来通りの引数なしで起動
