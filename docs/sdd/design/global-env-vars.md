# 設計書: アプリケーション共通環境変数

## 概要

Application < Project < Session の3階層マージで環境変数を管理する機能。
ConfigService(`data/settings.json`)にアプリケーション共通の環境変数を保存し、
Claude Codeセッション起動時にProject/Sessionの環境変数とマージする。

## アーキテクチャ

### データフロー

```
settings.json (Application) ─┐
projects.custom_env_vars (Project) ─┤→ mergeEnvVarsAll() → PTY環境変数
sessions.custom_env_vars (Session) ─┘
```

### マージ優先順位

```
Application (最低) < Project < Session (最高)
```

同一キーの場合、上位レイヤーが下位レイヤーを上書きする。

---

## 変更箇所

### 1. ConfigService (`src/services/config-service.ts`)

`AppConfig` に `custom_env_vars` を追加:

```typescript
export interface AppConfig {
  git_clone_timeout_minutes?: number;
  debug_mode_keep_volumes?: boolean;
  registry_firewall_enabled?: boolean;
  custom_env_vars?: Record<string, string>;  // 追加
}
```

`DEFAULT_CONFIG` に空オブジェクトを追加:

```typescript
const DEFAULT_CONFIG: Required<AppConfig> = {
  // ...既存...
  custom_env_vars: {},
};
```

`load()` と `save()` メソッドで `custom_env_vars` を処理。
getter `getCustomEnvVars(): Record<string, string>` を追加。

### 2. Settings API (`src/app/api/settings/config/route.ts`)

PUT ハンドラに `custom_env_vars` のバリデーションを追加:

```typescript
if (custom_env_vars !== undefined) {
  const validated = ClaudeOptionsService.validateCustomEnvVars(custom_env_vars);
  if (validated === null) {
    return NextResponse.json(
      { error: 'custom_env_vars must be a plain object with keys matching ^[A-Z_][A-Z0-9_]*$ and string values' },
      { status: 400 }
    );
  }
}
```

### 3. ClaudeOptionsService (`src/services/claude-options-service.ts`)

3階層マージメソッドを追加:

```typescript
static mergeEnvVarsAll(
  appEnvVars: CustomEnvVars,
  projectEnvVars: CustomEnvVars,
  sessionEnvVars: CustomEnvVars | null
): CustomEnvVars {
  return {
    ...appEnvVars,
    ...projectEnvVars,
    ...(sessionEnvVars ?? {}),
  };
}
```

### 4. WebSocket接続時のマージ (`src/lib/websocket/claude-ws.ts`)

既存の2階層マージを3階層に変更:

```typescript
// Before:
const mergedEnvVars = ClaudeOptionsService.mergeEnvVars(projectEnvVars, sessionEnvVars);

// After:
const configService = await ensureConfigLoaded();
const appEnvVars = configService.getCustomEnvVars();
const mergedEnvVars = ClaudeOptionsService.mergeEnvVarsAll(
  appEnvVars, projectEnvVars, sessionEnvVars
);
```

### 5. Settings UI (`src/app/settings/app/page.tsx`)

環境変数エディタセクションを追加。既存の `EnvVarEntry` パターンを再利用:
- KEY/VALUE入力行の追加・削除
- `^[A-Z_][A-Z0-9_]*$` パターンのクライアントサイドバリデーション
- 他の設定と同じフォームで一括保存

UIの配置:
- デバッグモード設定セクションの後(最後のセクション)
- 保存ボタンは共有(フォーム全体で1つ)

### 6. UI実装の詳細

`EnvVarEditor` コンポーネントを新規作成せず、`page.tsx` にインラインで実装する。
理由: 既存の `ClaudeOptionsForm.tsx` 内の環境変数エディタは `ClaudeCodeOptions` と結合しており、
単独で再利用できない。新規コンポーネントを切り出すと過剰な抽象化になる。

状態管理:
```typescript
const [envEntries, setEnvEntries] = useState<{ id: string; key: string; value: string }[]>([]);
```

---

## テスト計画

### ユニットテスト

1. **ConfigService**: `custom_env_vars` の読み書き、デフォルト値
2. **ClaudeOptionsService.mergeEnvVarsAll()**: 3階層マージの正確性
3. **Settings API**: `custom_env_vars` のバリデーション(正常系・異常系)
4. **claude-ws.ts**: Application環境変数がマージに含まれること

### テストファイル

| テスト | ファイル |
|--------|--------|
| ConfigService | `src/services/__tests__/config-service.test.ts` |
| ClaudeOptionsService | `src/services/__tests__/claude-options-service.test.ts` |
| Settings API | `src/app/api/settings/config/__tests__/route.test.ts` |

---

## 影響範囲の確認

- `data/settings.json` のスキーマ変更(後方互換: 未設定時は `{}`)
- 既存の Project/Session 環境変数には変更なし
- DB変更なし
