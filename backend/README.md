# ClaudeWork Backend API

FastAPIベースのバックエンドAPIサーバー

## 技術スタック

- FastAPI 0.115+
- Pydantic v2 (設定管理)
- structlog (JSON形式のログ出力)
- pytest + pytest-asyncio (テスト)
- uvicorn (ASGIサーバー)

## ディレクトリ構造

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPIアプリケーション
│   ├── config.py            # 設定クラス
│   ├── logging_config.py    # ロギング設定
│   ├── api/                 # APIエンドポイント
│   ├── models/              # データモデル
│   └── services/            # ビジネスロジック
├── tests/                   # テストコード
│   ├── conftest.py
│   ├── test_health.py
│   ├── test_logging.py
│   ├── test_config.py
│   └── test_app_startup.py
├── pyproject.toml           # プロジェクト設定
└── uv.lock                  # 依存関係ロック
```

## セットアップ

### 依存関係のインストール

```bash
# 本番環境の依存関係のみ
uv sync

# 開発環境の依存関係を含む
uv sync --extra dev
```

## 開発

### サーバーの起動

```bash
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### テストの実行

```bash
# すべてのテストを実行
uv run pytest

# 詳細出力
uv run pytest -v

# カバレッジ付き
uv run pytest --cov=app
```

## API エンドポイント

### ヘルスチェック

```
GET /health
```

レスポンス:
```json
{
  "status": "ok"
}
```

## 設定

設定は `app/config.py` で定義されており、環境変数または `.env` ファイルで上書き可能です。

### 主な設定項目

- `APP_NAME`: アプリケーション名 (デフォルト: "ClaudeWork Backend API")
- `DEBUG`: デバッグモード (デフォルト: False)
- `CORS_ORIGINS`: CORS許可オリジン (デフォルト: ["http://localhost:3000"])
- `LOG_LEVEL`: ログレベル (デフォルト: "INFO")

### 環境変数の例

```bash
APP_NAME="My API"
DEBUG=true
LOG_LEVEL=DEBUG
CORS_ORIGINS=["http://localhost:3000","http://localhost:3001"]
```

## ログ出力

structlogを使用してJSON形式でログを出力します。

```python
from app.logging_config import get_logger

logger = get_logger(__name__)
logger.info("user_action", user_id=123, action="login")
```

出力例:
```json
{
  "event": "user_action",
  "user_id": 123,
  "action": "login",
  "level": "info",
  "timestamp": "2025-12-08T22:30:00.123456Z"
}
```

## CORS設定

CORSは自動的に設定されており、`settings.cors_origins` で指定されたオリジンからのリクエストを許可します。

## TDD (テスト駆動開発)

このプロジェクトはTDDで開発されています。新機能を追加する際は以下の手順で進めてください。

1. テストを書く
2. テストを実行して失敗を確認
3. 実装を行う
4. テストが通過することを確認
5. リファクタリング
