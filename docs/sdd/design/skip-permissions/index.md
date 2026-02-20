# 設計書: Docker環境での --dangerously-skip-permissions オプション対応

> このドキュメントはAIエージェント（Claude Code等）が実装を行うことを前提としています。

## アーキテクチャ概要

```
環境設定 (ExecutionEnvironment.config)
  │ skipPermissions: boolean (default: false)
  │
  ▼
セッション作成時
  │ claude_code_options.dangerouslySkipPermissions: boolean | undefined
  │   undefined = 環境デフォルト使用
  │   true = 強制有効
  │   false = 強制無効
  │
  ▼
CLI引数構築 (DockerAdapter.buildDockerArgs)
  │ 有効判定: session値 ?? environment値 ?? false
  │
  ▼
docker run ... --entrypoint claude <image> --dangerously-skip-permissions [他のオプション]
```

## 設計の原則

1. **Docker環境限定**: HOST環境ではskipPermissionsを一切受け付けない
2. **既存フィールド活用**: 新規DBカラム追加なし。既存のJSON（config, claude_code_options）を拡張
3. **後方互換性**: skipPermissionsフィールド未設定は false として扱う
4. **最小変更**: 既存のバリデーション・マージロジックを段階的に拡張

## 主要コンポーネント

| コンポーネント | 責務 | ファイルパス | 変更種別 |
|--------------|------|------------|---------|
| ClaudeOptionsService | boolean フィールド対応、skipPermissions解決 | src/services/claude-options-service.ts | 拡張 |
| DockerAdapter | CLI引数に --dangerously-skip-permissions 追加 | src/services/adapters/docker-adapter.ts | 拡張 |
| EnvironmentAdapter | CreateSessionOptions に skipPermissions 追加 | src/services/environment-adapter.ts | 拡張 |
| 環境API | config.skipPermissions のバリデーション | src/app/api/environments/[id]/route.ts | 拡張 |
| セッション作成API | dangerouslySkipPermissions のバリデーション | src/app/api/projects/[project_id]/sessions/route.ts | 拡張 |
| EnvironmentForm | Docker環境にskipPermissionsトグル追加 | src/components/environments/EnvironmentForm.tsx | 拡張 |
| CreateSessionModal | skipPermissions 3択セレクタ追加 | src/components/sessions/CreateSessionModal.tsx | 拡張 |
| ClaudeOptionsForm | dangerouslySkipPermissions 表示（Docker時のみ） | src/components/claude-options/ClaudeOptionsForm.tsx | 拡張 |
| PTYSessionManager | 環境config読み取り、skipPermissions解決 | src/services/pty-session-manager.ts | 拡張 |

## データモデル

### ExecutionEnvironment.config JSON拡張

```typescript
// Docker環境のconfig JSON（既存フィールド + 追加フィールド）
interface DockerEnvironmentConfig {
  imageName: string;       // 既存
  imageTag: string;        // 既存
  imageSource?: string;    // 既存
  // 追加
  skipPermissions?: boolean; // デフォルト: false
}
```

DBスキーマ変更なし。既存の `config` JSONフィールドにキーを追加するのみ。

### ClaudeCodeOptions インターフェース拡張

```typescript
export interface ClaudeCodeOptions {
  model?: string;                        // 既存
  allowedTools?: string;                 // 既存
  permissionMode?: string;               // 既存
  additionalFlags?: string;              // 既存
  // 追加
  dangerouslySkipPermissions?: boolean;  // セッション単位の上書き
}
```

### CreateSessionOptions 拡張

```typescript
export interface CreateSessionOptions {
  // 既存フィールド...
  // 追加: 環境configから解決済みの値
  skipPermissions?: boolean;
}
```

## データフロー

### シーケンス: セッション作成時のskipPermissions解決

```
1. CreateSessionModal
   │ ユーザーが3択選択:
   │   "環境デフォルト" → dangerouslySkipPermissions = undefined (送信しない)
   │   "有効" → dangerouslySkipPermissions = true
   │   "無効" → dangerouslySkipPermissions = false
   │
   ▼
2. POST /api/projects/:id/sessions
   │ リクエスト: { claude_code_options: { dangerouslySkipPermissions: true|false|undefined } }
   │ バリデーション: booleanまたはundefined
   │ DB保存: Session.claude_code_options に JSON保存
   │
   ▼
3. WebSocket接続 → PTYSessionManager.createSession()
   │ 環境を取得: EnvironmentService.findById(environmentId)
   │ 環境configをパース: JSON.parse(environment.config)
   │ セッションオプションをパース: ClaudeOptionsService.parseOptions(session.claude_code_options)
   │
   │ skipPermissions解決:
   │   effective = sessionOptions.dangerouslySkipPermissions ?? envConfig.skipPermissions ?? false
   │
   │ Docker環境チェック:
   │   environment.type !== 'DOCKER' → effective = false (強制無効)
   │
   ▼
4. DockerAdapter.createSession(sessionId, workingDir, prompt, {
     ...,
     skipPermissions: effective,  // 解決済みの値
   })
   │
   ▼
5. DockerAdapter.buildDockerArgs()
   │ if (options?.skipPermissions && !options?.shellMode) {
   │   args.push('--dangerously-skip-permissions');
   │ }
   │
   ▼
6. docker run -it --rm ... --entrypoint claude <image> --dangerously-skip-permissions [他のオプション]
```

## 技術的決定事項

| ID | 決定事項 | 根拠 |
|----|---------|------|
| DEC-001 | ClaudeCodeOptionsにboolean型フィールドを追加 | 既存のJSON保存基盤を活用。新規カラム不要 |
| DEC-002 | skipPermissionsの解決をPTYSessionManagerで行う | AdapterはCLI引数構築のみ担当。ビジネスロジックはService層 |
| DEC-003 | HOST環境ではService層で強制false | Adapter側でもガードするが、主要な防御はService層 |
| DEC-004 | CreateSessionOptionsに解決済みskipPermissionsを渡す | Adapterが環境configを読む必要がなくなる。関心の分離 |
| DEC-005 | 環境config JSONにskipPermissionsを追加（新カラムではなく） | 環境タイプ固有の設定は config JSON で管理する既存パターンに従う |

## コンポーネント詳細設計

### 1. ClaudeOptionsService 変更

```typescript
// --- インターフェース変更 ---
export interface ClaudeCodeOptions {
  model?: string;
  allowedTools?: string;
  permissionMode?: string;
  additionalFlags?: string;
  dangerouslySkipPermissions?: boolean; // 追加
}

// --- buildCliArgs() 変更 ---
static buildCliArgs(options: ClaudeCodeOptions): string[] {
  const args: string[] = [];
  // ... 既存ロジック ...

  // 追加: dangerouslySkipPermissions
  if (options.dangerouslySkipPermissions === true) {
    args.push('--dangerously-skip-permissions');
  }

  return args;
}

// --- validateClaudeCodeOptions() 変更 ---
// allowedKeys に 'dangerouslySkipPermissions' を追加
// 型チェック: boolean または undefined を許可

// --- parseOptions() 変更 ---
// boolean フィールドのパース対応追加

// --- mergeOptions() 変更 ---
// boolean フィールドのマージ対応追加
// undefined = 上書きなし、true/false = 明示的上書き
```

### 2. DockerAdapter.buildDockerArgs() 変更

```typescript
private buildDockerArgs(workingDir: string, options?: CreateSessionOptions) {
  // ... 既存ロジック ...

  // イメージ指定後、claudeコマンド引数の先頭に追加
  args.push(`${this.config.imageName}:${this.config.imageTag}`);

  // 追加: --dangerously-skip-permissions（shellModeではスキップ）
  if (!options?.shellMode && options?.skipPermissions) {
    args.push('--dangerously-skip-permissions');
  }

  // 既存: --resume
  if (!options?.shellMode && options?.resumeSessionId) {
    args.push('--resume', options.resumeSessionId);
  }

  // 既存: カスタムCLIオプション
  // ...
}
```

### 3. PTYSessionManager skipPermissions解決

```typescript
// createSession内でskipPermissionsを解決
const envConfig = JSON.parse(environment.config || '{}');
const sessionOptions = ClaudeOptionsService.parseOptions(session.claude_code_options);

let skipPermissions = false;
if (environment.type === 'DOCKER') {
  // セッション上書き優先、なければ環境デフォルト
  skipPermissions = sessionOptions.dangerouslySkipPermissions
    ?? envConfig.skipPermissions
    ?? false;
}

await adapter.createSession(sessionId, workingDir, initialPrompt, {
  ...otherOptions,
  skipPermissions,
});
```

### 4. EnvironmentForm UI変更

Docker環境編集時のみ表示するトグル:

```tsx
{type === 'DOCKER' && (
  <div>
    <label>パーミッション確認スキップ</label>
    <p className="text-sm text-gray-500">
      Docker環境はサンドボックスとして動作するため、
      Claude Codeのパーミッション確認をスキップできます。
    </p>
    <Toggle
      checked={skipPermissions}
      onChange={setSkipPermissions}
    />
  </div>
)}
```

config JSON への保存:
```typescript
const config = buildDockerConfig();
config.skipPermissions = skipPermissions;
```

### 5. CreateSessionModal UI変更

Docker環境選択時のみ表示する3択セレクタ:

```tsx
{selectedEnvironmentType === 'DOCKER' && (
  <div>
    <label>パーミッション確認スキップ</label>
    <select value={skipPermissionsOverride} onChange={...}>
      <option value="default">環境デフォルトを使用 ({envSkipPermissions ? '有効' : '無効'})</option>
      <option value="true">有効</option>
      <option value="false">無効</option>
    </select>
  </div>
)}
```

claude_code_options への変換:
```typescript
const claudeOptions = { ...otherOptions };
if (skipPermissionsOverride === 'true') {
  claudeOptions.dangerouslySkipPermissions = true;
} else if (skipPermissionsOverride === 'false') {
  claudeOptions.dangerouslySkipPermissions = false;
}
// 'default' の場合は undefined のまま（送信しない）
```

## セキュリティ設計

### 防御層

1. **UI層**: HOST環境選択時はskipPermissions設定を非表示
2. **API層**: HOST環境のconfigにskipPermissionsが含まれていても無視
3. **Service層（PTYSessionManager）**: `environment.type !== 'DOCKER'` の場合は強制false
4. **Adapter層**: DockerAdapterのみフラグを追加（HostAdapterは対応しない）

### Docker環境のセキュリティ維持

skipPermissionsが有効でも、以下のDockerセキュリティ設定は維持:
- `--cap-drop ALL`
- `--security-opt no-new-privileges`
- ボリュームマウントの制限

## テスト戦略

| テストレベル | 対象 | ツール |
|------------|------|-------|
| ユニットテスト | ClaudeOptionsService（boolean対応） | Vitest |
| ユニットテスト | DockerAdapter.buildDockerArgs（フラグ追加） | Vitest |
| ユニットテスト | PTYSessionManager（skipPermissions解決） | Vitest |
| ユニットテスト | API バリデーション | Vitest |
| E2Eテスト | 環境設定 → セッション作成フロー | Playwright |

## 実装の優先順位

### Phase 1: バックエンド基盤
1. ClaudeOptionsService: boolean フィールド対応
2. CreateSessionOptions: skipPermissions追加
3. DockerAdapter: --dangerously-skip-permissions フラグ追加
4. PTYSessionManager: skipPermissions解決ロジック

### Phase 2: API
5. 環境API: config.skipPermissions バリデーション
6. セッション作成API: dangerouslySkipPermissions バリデーション

### Phase 3: UI
7. EnvironmentForm: トグル追加
8. CreateSessionModal: 3択セレクタ追加

### Phase 4: テスト
9. ユニットテスト
10. E2Eテスト

## 関連ドキュメント

- 要件定義: [要件](../requirements/skip-permissions/index.md)
- タスク: [タスク](../tasks/skip-permissions/index.md)

## 変更履歴

| 日付 | 変更内容 | 担当者 |
|------|---------|--------|
| 2026-02-20 | 初版作成 | Claude Code |
