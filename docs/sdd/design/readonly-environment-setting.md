# 設計書: プロジェクト実行環境の変更禁止

## 1. 概要

プロジェクト作成後のenvironment_id変更を禁止し、clone_locationに基づく自動判定結果を読み取り専用で表示する。

## 2. アーキテクチャ

### 2.1 変更方針

**UIコンポーネント:**
- セレクトボックス + 保存ボタン → 読み取り専用テキスト表示 + 説明メッセージ
- ProjectEnvironmentSettings: 大幅簡素化（状態管理・保存ロジック削除）
- ProjectSettingsModal: 環境セレクトボックスセクション削除、保存処理からenvironment_id送信削除

**API:**
- PATCH handler: environment_id更新ロジック削除（claude_code_options, custom_env_varsの更新に機能を限定）

### 2.2 GET APIレスポンスの活用

現在のGET `/api/projects/[project_id]` レスポンスには以下の情報が含まれる:

```typescript
{
  project: {
    id: string;
    clone_location: string; // 'host' | 'docker'
    environment_id: string | null;
    environment: {           // リレーション（environment_idが設定されている場合）
      id: string;
      name: string;
      type: string;          // 'HOST' | 'DOCKER' | 'SSH'
    } | null;
    // ... 他フィールド
  }
}
```

UIはこの情報を使って表示を構成する。追加のAPIは不要。

## 3. コンポーネント設計

### 3.1 ProjectEnvironmentSettings（設定ページ用）

**変更前:** セレクトボックス + 保存ボタン（environment_id更新可能）
**変更後:** 読み取り専用テキスト表示

```
┌─────────────────────────────────────────┐
│ 実行環境                                │
│                                         │
│ [Docker] Default Docker Environment     │  ← 環境タイプバッジ + 環境名
│                                         │
│ クローン場所（docker）の設定に基づいて  │  ← 説明メッセージ
│ 自動的に決定されます。プロジェクト作成  │
│ 後に変更することはできません。          │
└─────────────────────────────────────────┘
```

**表示ロジック:**
1. `environment_id` が設定されている場合 → `environment.name (environment.type)` を表示
2. `environment_id` が未設定の場合 → `clone_location` に基づいて自動判定結果を表示:
   - `clone_location='docker'` → 「Docker（自動選択）」
   - `clone_location='host'` → 「Host（自動選択）」

**削除する要素:**
- `useState` (environmentId, isSaving, saveMessage)
- `useEnvironments` hook
- `handleSave` 関数
- セレクトボックスUI
- 保存ボタン

**追加する要素:**
- プロジェクト情報からclone_location, environment, environment_idを取得
- 読み取り専用の環境表示テキスト
- 説明メッセージ

### 3.2 ProjectSettingsModal（モーダル用）

**変更:**
- 「デフォルト実行環境」セレクトボックスセクション（行297-324） → 読み取り専用表示に置換
- `environmentId` state変数を残す（表示用にfetchProjectSettingsで取得）
- `useEnvironments` hook削除
- `handleSaveAll` からenvironment_id送信を削除（行184）
- `handleClose` からsetEnvironmentId('')を削除
- プロジェクト情報からclone_location, environmentも取得してstateに保持

### 3.3 PATCH API

**変更前:**
```typescript
const { environment_id } = body;
// ...
.set({
  environment_id: environment_id === null ? null : environment_id,
  updated_at: new Date(),
})
```

**変更後:**
```typescript
const { claude_code_options, custom_env_vars } = body;
// ...
const updateData: Record<string, unknown> = { updated_at: new Date() };
if (claude_code_options !== undefined) updateData.claude_code_options = JSON.stringify(claude_code_options);
if (custom_env_vars !== undefined) updateData.custom_env_vars = JSON.stringify(custom_env_vars);

const updated = db.update(schema.projects).set(updateData)...
```

PATCH APIはPUT APIと同様にclaude_code_optionsとcustom_env_varsのみ更新可能にする。environment_idは無視する。

## 4. 技術的決定事項

### TD-001: environment_idカラムの維持
DBスキーマからenvironment_idカラムは削除しない。既存データの整合性を保ち、セッション作成時の自動選択ロジックで引き続き参照されるため。

### TD-002: PATCH APIの役割変更
PATCH APIはenvironment_id専用だったが、claude_code_optionsとcustom_env_varsの更新に役割を変更する。ProjectSettingsModalはこれらのフィールドをPATCHで送信しているが、現在のサーバー側では無視されている問題も解消される。

### TD-003: セッション作成ロジックは変更しない
`/api/projects/[project_id]/sessions/route.ts` の環境自動選択ロジックはそのまま維持する。既存のenvironment_idが設定されているプロジェクトは引き続きその値を使用する。

## 5. テスト方針

### 単体テスト
- PATCH API: environment_idが送信されても無視されることを確認
- PATCH API: claude_code_options, custom_env_varsが正しく更新されることを確認

### 手動テスト
- プロジェクト設定ページで実行環境が読み取り専用表示されること
- プロジェクト設定モーダルで実行環境が読み取り専用表示されること
- clone_location=dockerのプロジェクトで「Docker」と表示されること
- clone_location=hostのプロジェクトで「Host」と表示されること
