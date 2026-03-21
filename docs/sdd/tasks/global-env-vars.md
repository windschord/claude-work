# タスク計画: アプリケーション共通環境変数

## タスク一覧

### TASK-A: ConfigService拡張 + テスト

**対象ファイル:**
- `src/services/config-service.ts`
- `src/services/__tests__/config-service.test.ts`

**手順(TDD):**
1. テスト作成: `custom_env_vars` の読み書き、デフォルト値、バリデーション
2. `AppConfig` に `custom_env_vars: Record<string, string>` を追加
3. `DEFAULT_CONFIG` に `custom_env_vars: {}` を追加
4. `load()` / `save()` で `custom_env_vars` を処理
5. `getCustomEnvVars()` メソッドを追加
6. テスト通過を確認

### TASK-B: ClaudeOptionsService拡張 + テスト

**対象ファイル:**
- `src/services/claude-options-service.ts`
- `src/services/__tests__/claude-options-service.test.ts`

**依存:** なし(TASK-Aと並列可能)

**手順(TDD):**
1. テスト作成: `mergeEnvVarsAll()` の3階層マージ
2. `mergeEnvVarsAll()` メソッドを実装
3. テスト通過を確認

### TASK-C: Settings API拡張 + テスト

**対象ファイル:**
- `src/app/api/settings/config/route.ts`
- `src/app/api/settings/config/__tests__/route.test.ts`

**依存:** TASK-A(ConfigServiceの型変更)

**手順(TDD):**
1. テスト作成: PUT に `custom_env_vars` を含むリクエスト(正常系・バリデーションエラー)
2. PUT ハンドラに `custom_env_vars` のバリデーション・保存を追加
3. テスト通過を確認

### TASK-D: WebSocket マージ統合

**対象ファイル:**
- `src/lib/websocket/claude-ws.ts`

**依存:** TASK-A, TASK-B

**手順:**
1. `ensureConfigLoaded()` でアプリケーション環境変数を取得
2. `mergeEnvVars()` を `mergeEnvVarsAll()` に変更
3. 既存テストの修正(必要な場合)

### TASK-E: Settings UI

**対象ファイル:**
- `src/app/settings/app/page.tsx`

**依存:** TASK-C(APIが動作すること)

**手順:**
1. 環境変数エントリの状態管理を追加
2. KEY/VALUE入力UIを実装(追加・削除ボタン付き)
3. 保存時にAPI呼び出しに `custom_env_vars` を含める
4. 読み込み時に `custom_env_vars` を復元

### TASK-F: SDDドキュメントコミット

**手順:**
1. 要件定義・設計・タスク計画ドキュメントをコミット

## 実行順序

```
TASK-F (ドキュメント)
→ TASK-A + TASK-B (並列)
→ TASK-C (API)
→ TASK-D (WebSocket統合)
→ TASK-E (UI)
```
