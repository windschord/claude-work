# 要件定義: Docker環境のポートマッピング・ボリュームマウント設定

## 概要

Docker環境の作成時および編集時に、ポートマッピング（PORT）とホストボリュームマウントの設定を追加・削除できる機能を提供する。これにより、Docker環境内で動作するアプリケーションのネットワークアクセスやホストファイルシステムとの連携が柔軟に設定可能になる。

**変更の目的**:
- Docker環境でのWeb開発（開発サーバーへのブラウザアクセス等）を可能にする
- ホスト上のファイルやディレクトリをDocker環境から参照・編集できるようにする
- 環境設定の柔軟性を向上させ、多様なユースケースに対応する

**スコープ**:
- Docker環境のconfig JSONにポートマッピング・ボリュームマウントの設定を追加
- 環境作成フォーム（EnvironmentForm）にポートマッピング・ボリュームマウントのUI追加
- 環境編集時のポートマッピング・ボリュームマウントの変更対応
- DockerAdapterのdocker runコマンド構築にポート・ボリューム引数の追加
- 設定変更時の既存セッションへの即時適用オプション

**スコープ外**:
- Docker networkの作成・管理
- named volume（Docker管理ボリューム）の作成・管理
- コンテナ間通信の設定
- SSH環境でのポート・ボリューム設定

## ユーザーストーリー一覧

| ID | タイトル | 優先度 | ステータス | リンク |
|----|----------|--------|-----------|--------|
| US-001 | ポートマッピングの設定 | 高 | 完了 | [詳細](stories/US-001.md) |
| US-002 | ボリュームマウントの設定 | 高 | 完了 | [詳細](stories/US-002.md) |
| US-003 | 設定の即時適用 | 中 | 完了 | [詳細](stories/US-003.md) |

## 非機能要件

| カテゴリ | 概要 | リンク |
|---------|------|--------|
| セキュリティ | 危険パスの警告、バリデーション | [詳細](nfr/security.md) |
| ユーザビリティ | 直感的な設定UI、明確なフィードバック | [詳細](nfr/usability.md) |

## 依存関係

### 既存機能
- ExecutionEnvironment（環境管理テーブル、configフィールド）
- DockerAdapter（docker runコマンド構築: `buildDockerArgs`メソッド）
- EnvironmentService（環境CRUD操作）
- EnvironmentForm（環境作成・編集UI）
- useEnvironments（環境管理フック）

### 影響範囲
- `src/services/adapters/docker-adapter.ts`: `buildDockerArgs()`にポート・ボリューム引数追加
- `src/components/environments/EnvironmentForm.tsx`: UIにポート・ボリューム設定セクション追加
- `src/app/api/environments/route.ts`: バリデーション追加
- `src/services/environment-service.ts`: 設定変更時のコンテナ再作成ロジック
