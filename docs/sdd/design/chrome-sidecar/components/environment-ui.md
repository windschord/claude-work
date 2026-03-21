# コンポーネント設計: 環境設定UI拡張

## 概要

環境設定画面 (`/settings/environments`) にChrome Sidecar設定セクションを追加する。Docker環境の編集フォームにトグルとイメージ設定フィールドを追加し、サイドカーの有効/無効やイメージのカスタマイズを可能にする。

## 対応要件

REQ-003-001, REQ-003-002, REQ-003-003, REQ-004-002

## 変更ファイル

### 環境設定関連

- `src/app/settings/environments/` - 環境設定ページ
- `src/components/environments/` - 環境UIコンポーネント

### セッション情報表示関連

- `src/components/` - セッション詳細・リスト関連コンポーネント

## 環境設定フォーム拡張

### Chrome Sidecarセクション

環境編集フォームに以下のセクションを追加する。Docker環境 (`type === 'DOCKER'`) の場合のみ表示する。

```
+--------------------------------------------------+
| Chrome Sidecar                                    |
+--------------------------------------------------+
| Enable Chrome Sidecar   [  OFF  ]                |
|                                                   |
| Chrome Image            [chromium/headless-shell] |  <- disabled when OFF
| Chrome Tag              [131.0.6778.204        ]  |  <- disabled when OFF
|                                                   |
| Note: Chrome Sidecar provides an isolated         |
| browser for each session via Chrome DevTools MCP. |
+--------------------------------------------------+
```

### フィールド仕様

| フィールド | UI要素 | デフォルト | バリデーション | 非活性条件 |
|-----------|--------|-----------|--------------|-----------|
| Enable Chrome Sidecar | トグルスイッチ | OFF | - | HOST環境 |
| Chrome Image | テキスト入力 | `chromium/headless-shell` | `[-a-z0-9._/]+` | トグルOFF |
| Chrome Tag | テキスト入力 | `131.0.6778.204` | 空文字禁止、`latest`禁止 | トグルOFF |

### フロントエンドバリデーション

- Chrome Tagに`latest`が入力された場合、即座にバリデーションエラーを表示
  - エラーメッセージ: "再現性のためバージョンを固定してください（latestは使用できません）"
- Chrome Imageが空の場合、デフォルト値を使用
- トグルOFF時はchromeSidecarキーをconfig JSONから除外する（後方互換性のため）

## セッション情報へのデバッグポート表示

### セッション詳細画面

セッション詳細画面にChromeサイドカーの情報を表示する。`chrome_container_id` がNULLでないセッションにのみ表示する。

```
+--------------------------------------------------+
| Session Info                                      |
+--------------------------------------------------+
| ...既存情報...                                    |
|                                                   |
| Chrome DevTools Debug                             |
|   Status:  Running                                |
|   Debug URL: localhost:32789                      |
+--------------------------------------------------+
```

### 表示ロジック

| 条件 | 表示 |
|------|------|
| chrome_container_id がNULL | セクション非表示 |
| chrome_container_id が存在、chrome_debug_port がNULL | "Running (debug port unavailable)" |
| chrome_container_id が存在、chrome_debug_port が存在 | "Running - localhost:<port>" |

### セッションリスト

セッションリストのバッジ表示にChromeサイドカーの状態を追加する。

| 条件 | バッジ |
|------|--------|
| chrome_container_id がNULL | バッジなし |
| chrome_container_id が存在 | "Chrome" バッジ (色: オレンジ) |

## REQ-004-003（アクセス制御）について

現時点でclaude-workには認証/認可機能が実装されていないため、Chrome Debugポートとステータスの表示は全ユーザーに対して行う。将来の認証機能実装時に、セッション所有者/管理者のみに表示を制限する機能を追加する。

設計上は、セッションAPIのレスポンスにchrome_debug_portを含めるだけとし、将来の認証機能追加時にAPI層でフィルタリング可能な構造にしておく。
