# 要件定義: アプリケーション共通環境変数

## 概要

ClaudeWorkの全プロジェクト・セッションに共通で適用される環境変数設定機能を追加する。
既存のProject/Session単位の環境変数に加え、Application(共通)レイヤーを追加し、
3階層マージ(Application < Project < Session)を実現する。

## 背景

Claude Codeのメトリクス設定(`CLAUDE_CODE_ENABLE_TELEMETRY`等)など、
全環境で共通に設定したい環境変数がある。現状はProject単位でしか設定できず、
各プロジェクトに個別に設定する必要があり非効率。

## 既存実装の状況

- `projects.custom_env_vars`(TEXT, JSON文字列)でProject単位の環境変数を管理
- `sessions.custom_env_vars`(TEXT, JSON文字列)でSession単位の環境変数を管理
- `ClaudeOptionsService.mergeEnvVars()` で Project → Session のマージを実装済み
- `ConfigService` が `data/settings.json` でアプリケーション設定を管理
- Settings画面(`/settings/config`)に設定UI既存

## DB変更

なし(既存の `data/settings.json` に `custom_env_vars` フィールドを追加)

---

## 要件定義

### 1. API要件

#### REQ-API-001: アプリケーション共通環境変数の取得

**WHEN** `GET /api/settings/config` が呼び出されるとき、
**THE SYSTEM SHALL** レスポンスの `config` オブジェクトに `custom_env_vars` フィールドを含める。

受入基準:
- `config.custom_env_vars` が `Record<string, string>` 形式で返される
- 未設定時は空オブジェクト `{}` が返される
- 既存フィールド(`git_clone_timeout_minutes`等)に影響しない

#### REQ-API-002: アプリケーション共通環境変数の更新

**WHEN** `PUT /api/settings/config` が `custom_env_vars` フィールドを含むボディを受け取るとき、
**THE SYSTEM SHALL** 環境変数をバリデーションし、`data/settings.json` に保存する。

**IF** キーが `^[A-Z_][A-Z0-9_]*$` パターンに一致しない、または値が文字列でない場合、
**THE SYSTEM SHALL** 400エラーを返す。

受入基準:
- `custom_env_vars` が `data/settings.json` に永続化される
- バリデーションは既存の `ClaudeOptionsService.validateCustomEnvVars()` を使用
- 不正なキー/値で400エラー、エラーメッセージにバリデーション失敗理由を含む
- `custom_env_vars` 以外のフィールドと独立して更新可能

---

### 2. サービス層要件

#### REQ-SVC-001: 3階層環境変数マージ

**WHEN** Claude Codeセッションの起動時に環境変数をマージするとき、
**THE SYSTEM SHALL** Application → Project → Session の順でマージし、
後のレイヤーが前のレイヤーを上書きする。

受入基準:
- Application共通環境変数がベースとして使用される
- Project環境変数がApplication共通を上書きする
- Session環境変数がProject(マージ済み)を上書きする
- 各レイヤーが空オブジェクトの場合、次のレイヤーにそのまま引き継がれる

#### REQ-SVC-002: ConfigServiceへの環境変数追加

**WHEN** ConfigServiceが設定を読み込み・保存するとき、
**THE SYSTEM SHALL** `custom_env_vars` フィールドをサポートする。

受入基準:
- `AppConfig` インターフェースに `custom_env_vars` が追加される
- デフォルト値は空オブジェクト `{}`
- `settings.json` への読み書きが正常に動作する

---

### 3. フロントエンド要件

#### REQ-UI-001: Settings画面への環境変数セクション追加

**WHEN** ユーザーが `/settings` 画面を表示するとき、
**THE SYSTEM SHALL** 「アプリケーション共通環境変数」セクションを表示する。

受入基準:
- KEY=VALUE形式の入力エディタが表示される
- 環境変数の追加・編集・削除が可能
- 保存ボタンで設定が永続化される
- 既存のProject設定UIと同等の操作性

---

### 4. セキュリティ要件

#### REQ-SEC-001: 環境変数キーのバリデーション

**THE SYSTEM SHALL** 環境変数キーを `^[A-Z_][A-Z0-9_]*$` パターンで検証する。

受入基準:
- 既存の `ClaudeOptionsService.validateCustomEnvVars()` と同一ルールを適用
- 不正なキーはAPIレベルで拒否

---

### 5. 非機能要件

#### REQ-NFR-001: 後方互換性

**THE SYSTEM SHALL** 既存のProject/Session環境変数機能に影響を与えない。

受入基準:
- `custom_env_vars` が未設定の `settings.json` でもエラーなく動作
- 既存のProject/Session環境変数の動作が変わらない

## 影響範囲

### 変更対象ファイル

| ファイル | 変更内容 |
|--------|--------|
| `src/services/config-service.ts` | `AppConfig` に `custom_env_vars` 追加 |
| `src/app/api/settings/config/route.ts` | `custom_env_vars` のバリデーション・保存 |
| `src/services/claude-options-service.ts` | 3階層マージメソッド追加 |
| `src/lib/websocket/claude-ws.ts` | Application環境変数の取得・マージ |
| Settings画面コンポーネント | 環境変数エディタUI追加 |
