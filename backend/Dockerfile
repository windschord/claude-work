FROM python:3.11-slim

WORKDIR /app

# システムパッケージのインストール
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# uvのインストール
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# セキュリティ: 非rootユーザーで実行
RUN groupadd -r appuser && \
    useradd -r -g appuser -u 1001 appuser && \
    chown -R appuser:appuser /app

# 依存関係のインストール
COPY pyproject.toml ./
RUN uv pip install --system --no-cache -r pyproject.toml

# アプリケーションコードのコピー
COPY . .

# データディレクトリの作成と権限設定
RUN mkdir -p /app/data && \
    chown -R appuser:appuser /app/data

# ユーザーを切り替え
USER appuser

# 環境変数
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

EXPOSE 8000

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
