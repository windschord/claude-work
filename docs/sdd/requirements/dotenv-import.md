# 要件定義: .envファイルインポート機能

## 概要

ClaudeWorkのプロジェクト設定画面にある「カスタム環境変数」エディタに、
リポジトリ内の.envファイルからkey-valueペアをインポートする機能を追加する。

## 背景

現在、プロジェクトのカスタム環境変数は手動でkey-valueペアを1つずつ入力する必要がある。
多くのプロジェクトでは.envファイルに環境変数が定義されており、
これらを手動で転記するのは非効率かつ転記ミスのリスクがある。
.envファイルから直接インポートすることで、設定作業を効率化する。

## 既存実装の状況

- `projects.custom_env_vars`（TEXT, JSON文字列）は既にDBに存在
- `ClaudeOptionsService.mergeEnvVars()` でプロジェクト -> セッションへのマージは実装済み
- `ClaudeOptionsForm` コンポーネントに環境変数エディタ（key-valueペア入力）は既存
- `ProjectSettingsModal` が `ClaudeOptionsForm` を表示し、`PATCH /api/projects/:id` で `custom_env_vars` を保存
- Docker/Host Adapterでの環境変数の受け渡しは完了

## DB変更

なし（既存の `projects.custom_env_vars` を使用）

---

## 要件定義

### 1. API要件

#### REQ-API-001: .envファイル一覧取得API

**WHEN** `GET /api/projects/:id/env-files` が呼び出されるとき、
**THE SYSTEM SHALL** プロジェクトのリポジトリディレクトリ内の `.env*` パターンに一致するファイルを検索し、相対パスのリストを返す。

**IF** プロジェクトの `clone_location` が `'host'` または `null` の場合、
**THE SYSTEM SHALL** ホストファイルシステム上のプロジェクトパスを基点に検索する。

**IF** プロジェクトの `clone_location` が `'docker'` の場合、
**THE SYSTEM SHALL** Docker volume内のファイルを `docker exec` で検索する。

**WHILE** 検索を実行する間、
**THE SYSTEM SHALL** `node_modules`, `.git`, `dist`, `build`, `.next` ディレクトリを検索対象から除外する。

受入基準:
- `.env`, `.env.local`, `.env.production`, `.env.example` などのファイルが検出される
- パスはプロジェクトルートからの相対パスで返される
- `node_modules/.env` や `.git/` 配下のファイルは返されない
- プロジェクトが存在しない場合は404を返す
- ファイルが見つからない場合は空配列を返す

#### REQ-API-002: .envファイルパースAPI

**WHEN** `POST /api/projects/:id/env-files/parse` が `{ path: string }` を受け取るとき、
**THE SYSTEM SHALL** 指定されたファイルを読み込み、dotenvフォーマットとしてパースし、key-valueオブジェクトを返す。

**IF** 指定されたパスがプロジェクトディレクトリ外を参照する場合（パストラバーサル）、
**THE SYSTEM SHALL** 400エラーを返し、ファイルの読み込みを拒否する。

**IF** プロジェクトの `clone_location` が `'docker'` の場合、
**THE SYSTEM SHALL** Docker volume内のファイルを `docker exec` で読み込む。

受入基準:
- `KEY=VALUE` 形式の行が正しくパースされる
- レスポンスに `{ variables: { [key: string]: string }, errors: string[] }` が含まれる
- `../` や絶対パスを使ったパストラバーサルが拒否される（400エラー）
- パース中にエラーが発生した行は `errors` 配列に報告される
- ファイルが存在しない場合は404を返す

---

### 2. サービス層要件

#### REQ-SVC-001: Dotenvパーサーサービス

**WHEN** dotenvフォーマットのテキストが入力されるとき、
**THE SYSTEM SHALL** 以下のルールに従ってkey-valueオブジェクトに変換する:
- `KEY=VALUE` 形式の行をパースする
- `#` で始まる行はコメントとしてスキップする
- 空行はスキップする
- シングルクォート（`'value'`）で囲まれた値のクォートを除去する
- ダブルクォート（`"value"`）で囲まれた値のクォートを除去する
- `export KEY=VALUE` 形式の `export` プレフィックスを除去してパースする
- 値の前後の空白をトリムする

**THE SYSTEM SHALL NOT** 複数行値（ダブルクォート内の改行）をサポートする。

受入基準:
- `KEY=VALUE` が `{ KEY: "VALUE" }` にパースされる
- `KEY="quoted value"` が `{ KEY: "quoted value" }` にパースされる
- `KEY='single quoted'` が `{ KEY: "single quoted" }` にパースされる
- `export KEY=VALUE` が `{ KEY: "VALUE" }` にパースされる
- コメント行と空行がスキップされる
- パースエラーの行番号と内容が `errors` 配列に含まれる
- 値に`=`を含む場合（`KEY=a=b`）、最初の`=`で分割する

#### REQ-SVC-002: .envファイル検索サービス（ホスト）

**WHEN** ホスト環境のプロジェクトに対して.envファイル検索が要求されるとき、
**THE SYSTEM SHALL** `glob` パターン `**/.env*` でファイルを検索し、除外ディレクトリをスキップする。

受入基準:
- プロジェクトディレクトリ内の全.envファイルが再帰的に検出される
- `node_modules`, `.git`, `dist`, `build`, `.next` が除外される
- 結果がプロジェクトルートからの相対パスで返される

#### REQ-SVC-003: .envファイル検索サービス（Docker）

**WHEN** Docker環境のプロジェクトに対して.envファイル検索が要求されるとき、
**THE SYSTEM SHALL** Docker volume内で `find` コマンドを実行してファイルを検索する。

受入基準:
- Docker volume内の.envファイルが検出される
- 除外ディレクトリがスキップされる
- 結果がプロジェクトルートからの相対パスで返される

#### REQ-SVC-004: パストラバーサル防止

**WHEN** .envファイルのパスが指定されるとき、
**THE SYSTEM SHALL** パスを正規化し、プロジェクトディレクトリ内に収まることを検証する。

受入基準:
- `../../../etc/passwd` のようなパスが拒否される
- `/etc/passwd` のような絶対パスが拒否される
- `subdir/.env.local` のような正当な相対パスは許可される
- シンボリックリンクによるディレクトリ外参照は `path.resolve()` で検出される

---

### 3. フロントエンド要件

#### REQ-UI-001: インポートボタンの追加

**WHEN** ユーザーがClaudeOptionsFormの「カスタム環境変数」セクションを表示しているとき、
**THE SYSTEM SHALL** 「.envからインポート」ボタンを表示する。

受入基準:
- 環境変数エディタセクションに「.envからインポート」ボタンが存在する
- ボタンはdisabled状態（フォーム全体が無効時）に対応する

#### REQ-UI-002: .envファイル選択ドロップダウン

**WHEN** ユーザーが「.envからインポート」ボタンをクリックするとき、
**THE SYSTEM SHALL** プロジェクト内の.envファイル一覧を取得し、ドロップダウンで表示する。

**IF** .envファイルが見つからない場合、
**THE SYSTEM SHALL** 「.envファイルが見つかりません」というメッセージを表示する。

受入基準:
- ボタンクリック時にAPIを呼び出してファイル一覧を取得する
- ファイル一覧がドロップダウンまたはリストで表示される
- ローディング中はスピナーまたはローディング表示がある
- エラー時はエラーメッセージが表示される
- ファイル未検出時は適切なメッセージが表示される

#### REQ-UI-003: パース結果のプレビューとインポート

**WHEN** ユーザーがドロップダウンから.envファイルを選択するとき、
**THE SYSTEM SHALL** パースAPIを呼び出し、結果をプレビュー表示する。

**WHEN** ユーザーがプレビュー画面で「インポート」ボタンをクリックするとき、
**THE SYSTEM SHALL** パース結果を既存の環境変数にマージする。

**IF** インポートするキーが既存の環境変数に存在する場合、
**THE SYSTEM SHALL** 上書きされるキーをユーザーに通知し、確認を求める。

受入基準:
- ファイル選択後にパース結果（key-valueの一覧）がプレビュー表示される
- パースエラーがある場合は警告として表示される
- 「インポート」ボタンクリックで既存環境変数にマージされる
- 既存キーと重複する場合は上書き確認が表示される
- インポート後もフォームの未保存状態が維持される（保存はユーザーが明示的に行う）

---

### 4. セキュリティ要件

#### REQ-SEC-001: パストラバーサル防止

**THE SYSTEM SHALL** .envファイルのパスをプロジェクトディレクトリ内に限定し、
ディレクトリ外のファイルアクセスを拒否する。

受入基準:
- `path.resolve()` で正規化されたパスがプロジェクトディレクトリのプレフィックスを持つことを検証する
- `../`, `..\\`, 絶対パスが拒否される

#### REQ-SEC-002: ログへの機密情報非記録

**THE SYSTEM SHALL** .envファイルの内容（値）をサーバーログに記録しない。

受入基準:
- パースAPIのリクエスト/レスポンスの値部分がログに出力されない
- ファイルパスのみがログに記録される（デバッグ目的）

---

### 5. 非機能要件

#### REQ-NFR-001: パフォーマンス

**WHEN** .envファイル一覧を検索するとき、
**THE SYSTEM SHALL** 検索結果を5秒以内に返す。

受入基準:
- 一般的なプロジェクト（ファイル数10,000以下）で5秒以内にレスポンスが返る
- 検索対象ディレクトリが適切に除外されている

#### REQ-NFR-002: ファイルサイズ制限

**WHEN** .envファイルをパースするとき、
**THE SYSTEM SHALL** 1MB以上のファイルを拒否する。

受入基準:
- 1MB以上のファイルに対して413または400エラーが返される
- エラーメッセージにファイルサイズ制限を示す説明が含まれる

---

## 影響範囲

### 変更対象ファイル（主要）

| ファイル | 変更内容 |
|--------|--------|
| `src/components/claude-options/ClaudeOptionsForm.tsx` | 「.envからインポート」UI追加 |

### 新規ファイル

| ファイル | 内容 |
|--------|--------|
| `src/app/api/projects/[project_id]/env-files/route.ts` | .envファイル一覧API |
| `src/app/api/projects/[project_id]/env-files/parse/route.ts` | .envファイルパースAPI |
| `src/services/dotenv-parser.ts` | Dotenvパーサーサービス |
| `src/services/env-file-service.ts` | .envファイル検索・読み込みサービス |
