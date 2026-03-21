# TASK-004: PTYSessionManager: 設定解決ロジック置き換え

## 概要

PTYSessionManagerのskipPermissions解決ロジックをClaudeDefaultsResolverに置き換える。

## 依存: TASK-003

## 対象ファイル

- `src/services/pty-session-manager.ts` - 変更
- `src/services/__tests__/pty-session-manager.test.ts` - 変更（該当テストの更新）

## 変更内容

### 現在のコード (L166-197)

```typescript
// 環境情報を取得
const environment = await db.query.executionEnvironments.findFirst(...)

// skipPermissions の解決（Docker環境のみ）
let skipPermissions = false
if (environment.type === 'DOCKER') {
  let envConfig = JSON.parse(environment.config || '{}')
  skipPermissions = claudeCodeOptions?.dangerouslySkipPermissions
    ?? (envConfig.skipPermissions === true)
}
```

### 変更後

```typescript
// 環境情報を取得
const environment = await db.query.executionEnvironments.findFirst(...)

// プロジェクト情報を取得（claude_code_optionsの解決に必要）
const project = await db.query.projects.findFirst({
  where: (projects, { eq }) => eq(projects.id, projectId)
})

// 4層カスケードで設定を解決
const configService = await ensureConfigLoaded()
const appDefaults = configService.getClaudeDefaults()
const envConfig = JSON.parse(environment.config || '{}')
const projectOptions = ClaudeOptionsService.parseOptions(project?.claude_code_options)

const resolved = ClaudeDefaultsResolver.resolve(
  appDefaults,
  envConfig,
  environment.type as 'HOST' | 'DOCKER' | 'SSH',
  projectOptions,
  claudeCodeOptions || null
)

const skipPermissions = resolved.dangerouslySkipPermissions
```

## TDD手順

### 1. テスト更新

既存のskipPermissions解決テストを更新し、4層カスケードの動作を確認。

### 2. 実装

- `ClaudeDefaultsResolver`のインポート追加
- プロジェクト情報の取得を追加
- skipPermissions解決をClaudeDefaultsResolver.resolve()に置き換え

## 受入条件

- [ ] skipPermissionsがClaudeDefaultsResolverで解決される
- [ ] 既存のDocker環境でのskipPermissions動作が維持される
- [ ] HOST環境でskipPermissionsが常にfalse
- [ ] テストが全て通過する
