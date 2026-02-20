# タスク: パーミッションスキップ有効時のオプション矛盾解消

## 進捗サマリー

| フェーズ | タスク数 | 完了 | 進捗率 |
|---------|---------|------|--------|
| Phase 1: バックエンド | 1 | 0 | 0% |
| Phase 2: UI | 2 | 0 | 0% |
| Phase 3: テスト | 1 | 0 | 0% |
| **合計** | **4** | **0** | **0%** |

---

## Phase 1: バックエンド

### TASK-001: PTYSessionManagerで矛盾オプション除去

**ステータス**: TODO
**対象ファイル**: `src/services/pty-session-manager.ts`
**関連要件**: REQ-003

#### 概要
skipPermissionsが有効な場合、claudeCodeOptionsからpermissionModeとallowedToolsを除去する。

#### 実装手順

**テスト作成**:

1. `src/services/__tests__/pty-session-manager-skip-conflict.test.ts` を新規作成
2. 以下のテストケースを実装:
   - skipPermissions=true の場合、adapterに渡されるclaudeCodeOptionsからpermissionModeが除去される
   - skipPermissions=true の場合、adapterに渡されるclaudeCodeOptionsからallowedToolsが除去される
   - skipPermissions=true でも model, additionalFlags は除去されない
   - skipPermissions=false の場合、permissionMode/allowedToolsはそのまま渡される
   - 除去時にlogger.infoが呼ばれる
3. テスト実行、全て失敗を確認

**実装**:

4. `src/services/pty-session-manager.ts` を修正
5. 既存の `delete adapterClaudeOptions.dangerouslySkipPermissions` の直後に追加:
   ```typescript
   if (skipPermissions && adapterClaudeOptions) {
     if (adapterClaudeOptions.permissionMode) {
       logger.info('skipPermissions enabled: ignoring permissionMode', {
         permissionMode: adapterClaudeOptions.permissionMode
       });
       delete adapterClaudeOptions.permissionMode;
     }
     if (adapterClaudeOptions.allowedTools) {
       logger.info('skipPermissions enabled: ignoring allowedTools', {
         allowedTools: adapterClaudeOptions.allowedTools
       });
       delete adapterClaudeOptions.allowedTools;
     }
   }
   ```
6. テスト実行、全て通過を確認

#### 受入基準
- [x] skipPermissions=true 時に permissionMode が CLI 引数に含まれない
- [x] skipPermissions=true 時に allowedTools が CLI 引数に含まれない
- [x] skipPermissions=false 時は既存動作と同じ
- [x] model, additionalFlags は影響を受けない
- [x] 除去時にログ出力される

---

## Phase 2: UI

### TASK-002: ClaudeOptionsFormにdisabled制御を追加

**ステータス**: TODO
**対象ファイル**: `src/components/claude-options/ClaudeOptionsForm.tsx`
**関連要件**: REQ-001, REQ-002

#### 概要
ClaudeOptionsFormコンポーネントに `disabledBySkipPermissions` propsを追加し、有効時にpermissionMode/allowedToolsをdisabled化、additionalFlagsに警告メッセージを表示する。

#### 実装手順

**実装**:

1. `ClaudeOptionsFormProps` インターフェースに `disabledBySkipPermissions?: boolean` を追加
2. コンポーネント内でpropsを受け取る
3. permissionModeの`<select>`要素に `disabled={disabledBySkipPermissions}` を追加
4. permissionModeフィールドの下にdisabled時の説明メッセージを追加:
   ```tsx
   {disabledBySkipPermissions && (
     <p className="text-sm text-amber-600 mt-1">
       パーミッション確認スキップが有効なため、この設定は無視されます
     </p>
   )}
   ```
5. allowedToolsの`<input>`要素に `disabled={disabledBySkipPermissions}` を追加
6. allowedToolsフィールドの下に同様の説明メッセージを追加
7. additionalFlagsフィールドの下にskipPermissions有効時の警告メッセージを追加:
   ```tsx
   {disabledBySkipPermissions && (
     <p className="text-sm text-amber-600 mt-1">
       権限関連フラグ（--permission-mode, --allowedTools）は無視されます
     </p>
   )}
   ```
8. disabledフィールドのスタイリング: `opacity-50 cursor-not-allowed` クラスを条件付きで追加

#### 受入基準
- [ ] `disabledBySkipPermissions` propが未指定またはfalseの場合、既存動作と同じ
- [ ] trueの場合、permissionModeとallowedToolsがdisabledになる
- [ ] trueの場合、disabledフィールドに説明メッセージが表示される
- [ ] trueの場合、additionalFlagsに警告メッセージが表示される
- [ ] additionalFlags自体はdisabledにならない
- [ ] disabled中もフィールドの値は保持される

### TASK-003: CreateSessionModalでeffectiveSkipPermissionsを計算してprops伝播

**ステータス**: TODO
**対象ファイル**: `src/components/sessions/CreateSessionModal.tsx`
**関連要件**: REQ-001

#### 概要
skipPermissionsの実効的な有効/無効状態を計算し、ClaudeOptionsFormにpropsとして渡す。

#### 実装手順

**実装**:

1. `effectiveSkipPermissions` をuseMemoで計算:
   ```typescript
   const effectiveSkipPermissions = useMemo(() => {
     if (!isDockerEnvironment) return false;
     if (skipPermissionsOverride === 'enable') return true;
     if (skipPermissionsOverride === 'disable') return false;
     return envSkipPermissionsDefault;
   }, [isDockerEnvironment, skipPermissionsOverride, envSkipPermissionsDefault]);
   ```
2. ClaudeOptionsFormコンポーネントに `disabledBySkipPermissions={effectiveSkipPermissions}` を渡す
3. 既存の `isDockerEnvironment` と `envSkipPermissionsDefault` を活用（新規state不要）

#### 受入基準
- [ ] Docker環境 + スキップ「有効」→ ClaudeOptionsFormのpermissionMode/allowedToolsがdisabled
- [ ] Docker環境 + スキップ「環境デフォルト(有効)」→ disabled
- [ ] Docker環境 + スキップ「環境デフォルト(無効)」→ enabled
- [ ] Docker環境 + スキップ「無効」→ enabled
- [ ] HOST環境 → 常にenabled
- [ ] スキップの切り替え時にpermissionMode/allowedToolsの既存値が保持される

---

## Phase 3: テスト

### TASK-004: ユニットテスト作成

**ステータス**: TODO
**対象ファイル**:
- `src/services/__tests__/pty-session-manager-skip-conflict.test.ts`（TASK-001で作成済み）

#### 概要
TASK-001のTDDで作成したテストが全て通過することを最終確認する。

#### 受入基準
- [ ] PTYSessionManagerのテストが全て通過
- [ ] 既存テストが壊れていない（`npx vitest run` で全テスト通過）
- [ ] lint通過

---

## 関連ドキュメント

- 要件定義: [要件](../../requirements/skip-permissions-conflict/index.md)
- 設計書: [設計](../../design/skip-permissions-conflict/index.md)
- 前提機能タスク: [skip-permissionsタスク](../skip-permissions/index.md)

## 変更履歴

| 日付 | 変更内容 | 担当者 |
|------|---------|--------|
| 2026-02-21 | 初版作成 | Claude Code |
