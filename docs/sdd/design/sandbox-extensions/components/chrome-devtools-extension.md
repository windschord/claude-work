# Chrome DevTools Extension

## 概要

**目的**: Chromium + Chrome DevTools MCP環境を基本イメージに追加する拡張Dockerfile

**責務**:
- Chromiumブラウザとその依存ライブラリの提供
- CJKフォント等の必要フォントの提供
- Puppeteer/Chrome関連の環境変数設定

## 情報の明確性

### 明示された情報
- 既存の `docker/Dockerfile.chrome-devtools` を `docker/extensions/` に移動
- 内容は変更なし（既にARG BASE_IMAGE対応済み）
- PR#184で動作確認済み

---

## ファイル

**パス**: `docker/extensions/Dockerfile.chrome-devtools`
**移動元**: `docker/Dockerfile.chrome-devtools`

## Dockerfile設計

```dockerfile
ARG BASE_IMAGE=ghcr.io/windschord/claude-work-sandbox:latest
FROM ${BASE_IMAGE}

LABEL description="Sandboxed environment for running Claude Code with Chrome DevTools MCP"

USER root

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        chromium \
        fonts-liberation \
        fonts-noto-cjk \
        libnss3 \
        libatk-bridge2.0-0 \
        libdrm2 \
        libxcomposite1 \
        libxdamage1 \
        libxrandr2 \
        libgbm1 \
        libasound2 \
        libpango-1.0-0 \
        libcairo2 \
        libcups2 \
        libxss1 \
        libxtst6 \
        libdbus-1-3 \
    && apt-get autoremove -y \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

USER node

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV CHROME_PATH=/usr/bin/chromium
ENV CHROMIUM_FLAGS="--disable-dev-shm-usage"
```

### MCP設定例

コンテナ利用時の `.mcp.json` 設定:

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": [
        "chrome-devtools-mcp@0.12.1",
        "--headless",
        "--isolated",
        "--executablePath=/usr/bin/chromium",
        "--chromeArg=--disable-dev-shm-usage"
      ]
    }
  }
}
```

### セキュリティ注意

Chromiumのsandboxが機能しない環境では `--chromeArg=--no-sandbox` を追加。
sandbox有効化にはホスト側で `kernel.unprivileged_userns_clone=1` の設定が必要な場合がある。
コンテナ起動時に `--shm-size=256m` 以上を推奨。

## インストールされるツール

| ツール | 提供元 | 用途 |
|-------|--------|------|
| chromium | apt | ヘッドレスブラウザ |
| fonts-liberation | apt | 基本フォント |
| fonts-noto-cjk | apt | CJK (日中韓) フォント |
| libnss3等 | apt | Chromium依存ライブラリ群 |

## 環境変数

| 変数名 | 値 | 目的 |
|--------|-----|------|
| PUPPETEER_SKIP_CHROMIUM_DOWNLOAD | `true` | システムChromiumを使用 |
| PUPPETEER_EXECUTABLE_PATH | `/usr/bin/chromium` | Chromiumパスの指定 |
| CHROME_PATH | `/usr/bin/chromium` | Chrome DevTools MCPへの通知 |
| CHROMIUM_FLAGS | `--disable-dev-shm-usage` | /dev/shmサイズ制限の回避 |

## レジストリタグ

- `ghcr.io/windschord/claude-work-sandbox:chrome-devtools`
- `ghcr.io/windschord/claude-work-sandbox:chrome-devtools-sha-xxxxx`

## 依存関係

### 依存するコンポーネント
- [Base Image](base-image.md) @base-image.md: `FROM ${BASE_IMAGE}` で継承

## テスト観点

- [x] ビルド成功（PR#184で確認済み）
- [x] Chromiumが起動可能（MCP経由で確認済み）
- [x] Chrome DevTools MCPのJSON-RPC通信が正常動作
- [ ] nodeユーザーで実行される
