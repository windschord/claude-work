# 設計書: パーミッションスキップ有効時のオプション矛盾解消

> このドキュメントはAIエージェント（Claude Code等）が実装を行うことを前提としています。

## アーキテクチャ概要

```text
セッション作成モーダル (CreateSessionModal)
  │ skipPermissionsOverride + envSkipPermissionsDefault
  │ → effectiveSkipPermissions を計算
  │
  ▼
ClaudeOptionsForm
  │ disabledBySkipPermissions: boolean (props)
  │ → permissionMode, allowedTools を disabled 化
  │ → additionalFlags に警告メッセージ表示
  │
  ▼
PTYSessionManager
  │ ClaudeOptionsService.stripConflictingOptions() を呼び出し
  │ → claudeCodeOptions から permissionMode, allowedTools を除去
  │
  ▼
DockerAdapter.buildDockerArgs()
  │ ClaudeOptionsService.buildCliArgs(sanitizedOptions)
  │ → --permission-mode, --allowedTools が含まれない
```

## 設計の原則

1. **UI層で防止、バックエンド層で保証**: UIはdisabledにし、バックエンドも安全弁として除去
2. **値の保持**: disabledフィールドの値はstateで保持し、skipPermissions解除時に復元
3. **最小変更**: 既存コンポーネントのpropsを拡張するのみ。新規コンポーネント不要

## 主要コンポーネント

| コンポーネント | 責務 | ファイルパス | 変更種別 |
|--------------|------|------------|---------:|
| CreateSessionModal | effectiveSkipPermissions計算、props伝播 | src/components/sessions/CreateSessionModal.tsx | 拡張 |
| ClaudeOptionsForm | disabled化、警告表示 | src/components/claude-options/ClaudeOptionsForm.tsx | 拡張 |
| ClaudeOptionsService | 矛盾オプション除去（stripConflictingOptions） | src/services/claude-options-service.ts | 追加 |
| PTYSessionManager | 競合除去の呼び出し、警告ログ出力 | src/services/pty-session-manager.ts | 拡張 |

## データフロー

### 1. CreateSessionModal: effectiveSkipPermissions の計算

```typescript
// 既存state
const [skipPermissionsOverride, setSkipPermissionsOverride] = useState<'default' | 'enable' | 'disable'>('default');
const envSkipPermissionsDefault = useMemo(() => { /* ... */ }, [selectedEnvironment]);

// 追加: 実効的なskipPermissions状態を計算
const effectiveSkipPermissions = useMemo(() => {
  if (!isDockerEnvironment) return false;
  if (skipPermissionsOverride === 'enable') return true;
  if (skipPermissionsOverride === 'disable') return false;
  // 'default' → 環境デフォルトを使用
  return envSkipPermissionsDefault;
}, [isDockerEnvironment, skipPermissionsOverride, envSkipPermissionsDefault]);
```

### 2. ClaudeOptionsForm: props拡張

```typescript
// 既存のprops
interface ClaudeOptionsFormProps {
  options: ClaudeCodeOptions;
  onChange: (options: ClaudeCodeOptions) => void;
  envVars?: CustomEnvVars;
  onEnvVarsChange?: (envVars: CustomEnvVars) => void;
  // 追加
  disabledBySkipPermissions?: boolean;
}
```

### 3. ClaudeOptionsForm: フィールドdisabled化

```tsx
// permissionMode フィールド
<select
  disabled={disabledBySkipPermissions}
  value={options.permissionMode || ''}
  onChange={...}
>
  {/* options */}
</select>
{disabledBySkipPermissions && (
  <p className="text-sm text-amber-600">
    パーミッション確認スキップが有効なため、この設定は無視されます
  </p>
)}

// allowedTools フィールド
<input
  disabled={disabledBySkipPermissions}
  value={options.allowedTools || ''}
  onChange={...}
/>
{disabledBySkipPermissions && (
  <p className="text-sm text-amber-600">
    パーミッション確認スキップが有効なため、この設定は無視されます
  </p>
)}

// additionalFlags フィールド（disabledにはしない）
<input
  value={options.additionalFlags || ''}
  onChange={...}
/>
{disabledBySkipPermissions && (
  <p className="text-sm text-amber-600">
    権限関連フラグ（--permission-mode, --allowedTools）は無視されます
  </p>
)}
```

### 4. PTYSessionManager: 矛盾オプション除去（ClaudeOptionsService経由）

```typescript
// ClaudeOptionsService.stripConflictingOptions() に集約
// dangerouslySkipPermissionsの除去 + skipPermissions有効時のpermissionMode/allowedTools除去
const { result: adapterClaudeOptions, warnings } =
  ClaudeOptionsService.stripConflictingOptions(claudeCodeOptions, skipPermissions)
for (const warning of warnings) {
  logger.warn(warning)
}
```

## 技術的決定事項

| ID | 決定事項 | 根拠 |
|----|---------|------|
| DEC-001 | UIのdisabled化はClaudeOptionsFormのpropsで制御 | CreateSessionModalからの単方向データフロー。ClaudeOptionsFormの再利用性を維持 |
| DEC-002 | additionalFlagsはdisabledにせず警告のみ | 他の有効なフラグ（--model等以外のカスタムフラグ）も入力できなくなるため |
| DEC-003 | バックエンドでの除去はClaudeOptionsServiceに集約 | PTYSessionManagerから呼び出し、テスト容易性と一貫した警告・除去処理を提供 |
| DEC-004 | additionalFlags内の権限フラグは除去しない | フリーテキストのパースは複雑でエラーが起きやすい。UIの警告で十分 |
| DEC-005 | disabledフィールドの値はReact stateで保持 | onChangeを呼ばない（値を変更しない）ことで自然に保持される |

## セキュリティ設計

### 防御層

1. **UI層**: permissionMode/allowedToolsフィールドをdisabled化（入力防止）
2. **バックエンド層（ClaudeOptionsService）**: skipPermissions有効時にCLI引数から除去（安全弁）

UI層をバイパスしてAPIを直接呼んだ場合でも、バックエンド層で除去されるため安全。

## テスト戦略

| テストレベル | 対象 | ツール |
|------------|------|-------|
| ユニットテスト | ClaudeOptionsService.stripConflictingOptionsの矛盾オプション除去 | Vitest |
| ユニットテスト | ClaudeOptionsFormのdisabled状態 | Vitest + React Testing Library |

## 実装の優先順位

### Phase 1: バックエンド
1. ClaudeOptionsService.stripConflictingOptions: skipPermissions有効時にpermissionMode/allowedToolsを除去
2. PTYSessionManager: stripConflictingOptionsの呼び出しと警告ログ出力

### Phase 2: UI
2. ClaudeOptionsForm: disabledBySkipPermissions prop追加
3. CreateSessionModal: effectiveSkipPermissions計算、props伝播

### Phase 3: テスト
4. ユニットテスト

## 関連ドキュメント

- 要件定義: [要件](../../requirements/skip-permissions-conflict/index.md)
- タスク: [タスク](../../tasks/skip-permissions-conflict/index.md)
- 前提機能設計: [skip-permissions設計](../skip-permissions/index.md)

## 変更履歴

| 日付 | 変更内容 | 担当者 |
|------|---------|--------|
| 2026-02-21 | 初版作成 | Claude Code |
| 2026-02-21 | リファクタリング反映: ロジックをClaudeOptionsServiceに集約 | Claude Code |
