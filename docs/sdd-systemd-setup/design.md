# 設計書: systemd 自動起動セットアップ

## 明示された情報

- 対象 OS: Ubuntu
- 実行ユーザー: `claude-work` 専用システムユーザー
- 起動タイミング: システム起動時（multi-user.target）
- 成果物: ドキュメントのみ（CLI コマンドは追加しない）

---

## アーキテクチャ概要

```text
┌─────────────────────────────────────────────────────────────┐
│  Ubuntu System                                               │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  systemd                                             │    │
│  │                                                      │    │
│  │  claude-work.service                                 │    │
│  │    ├─ User=claude-work                              │    │
│  │    ├─ WorkingDirectory=/opt/claude-work             │    │
│  │    ├─ EnvironmentFile=/etc/claude-work/env          │    │
│  │    └─ ExecStart=/usr/bin/npx claude-work                   │
│  │                                                      │    │
│  └─────────────────────────────────────────────────────┘    │
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  claude-work プロセス                                │    │
│  │                                                      │    │
│  │  ├─ Next.js サーバー (port 3000)                    │    │
│  │  ├─ WebSocket サーバー                              │    │
│  │  └─ SQLite データベース                             │    │
│  │                                                      │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## コンポーネント

### コンポーネント1: systemd ユニットファイル

**ファイル**: `systemd/claude-work.service`

**目的**: systemd サービス定義

**内容**:
```ini
[Unit]
Description=ClaudeWork - Claude Code Session Manager
Documentation=https://github.com/windschord/claude-work
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=claude-work
Group=claude-work
WorkingDirectory=/opt/claude-work
EnvironmentFile=/etc/claude-work/env
# npx claude-work でフォアグラウンド起動
# 初回起動時に Prisma クライアント生成、DB 初期化、Next.js ビルドを検証し、不足分のみ実行
Environment=HOME=/opt/claude-work
# --no: ローカルにインストール済みのパッケージのみ実行（ネットワークインストールを防止）
ExecStart=/usr/bin/npx --no claude-work
# 初回起動時のビルドに時間がかかるためタイムアウトを延長
TimeoutStartSec=300
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=claude-work

# セキュリティ設定
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
PrivateTmp=true
ReadWritePaths=/opt/claude-work

[Install]
WantedBy=multi-user.target
```

**設計決定**:
- `Type=simple`: フォアグラウンドで実行されるため
- `ExecStart=npx --no claude-work`: CLI が Prisma・DB・ビルド成果物の存在を検証し、不足している場合のみセットアップを実行（npm install 時の prepare スクリプトによるセットアップを前提としたフォールバック）
- `Restart=on-failure`: 異常終了時のみ再起動
- `RestartSec=10`: 再起動間隔を10秒に設定（無限ループ防止）
- `ProtectSystem=strict`: /usr, /boot, /efi, /etc を読み取り専用に（最小権限の原則）
- `ProtectHome=read-only`: ホームディレクトリを読み取り専用に
- `ReadWritePaths=/opt/claude-work`: アプリケーションディレクトリ全体への書き込みを許可（データ、キャッシュ、ビルド出力）

### コンポーネント2: 環境変数ファイル

**ファイル**: `systemd/claude-work.env.example`

**目的**: サービス実行時の環境変数テンプレート

**内容**:
```bash
# ClaudeWork 環境変数設定
# このファイルを /etc/claude-work/env にコピーして編集してください

# データベースパス（必須）
DATABASE_URL=file:/opt/claude-work/data/claudework.db

# サーバーポート（デフォルト: 3000）
PORT=3000

# ログレベル（debug, info, warn, error）
LOG_LEVEL=info

# Node.js 環境
NODE_ENV=production

# プロセスのアイドルタイムアウト時間（分）（オプション）
# 一定時間操作がない Claude Code プロセスを自動的にサスペンドします（デフォルト: 30）
# PROCESS_IDLE_TIMEOUT_MINUTES=30

# Claude Code CLI パス（オプション）
# デフォルトでは PATH から自動検出
# CLAUDE_CODE_PATH=/usr/local/bin/claude

# 許可するプロジェクトディレクトリ（オプション）
# カンマ区切りで複数指定可能
# ALLOWED_PROJECT_DIRS=/home/projects,/opt/projects

# CORS で許可するオリジン（オプションだがブラウザアクセス時は推奨）
# カンマ区切りで複数指定可能
# 本番環境では "*" は使用せず、必要なドメインのみを列挙してください
# 例: ALLOWED_ORIGINS=https://example.com,https://app.example.com
# ALLOWED_ORIGINS=
```

### コンポーネント3: セットアップドキュメント

**ファイル**: `docs/SYSTEMD_SETUP.md`

**目的**: 手動セットアップ手順の提供

**構成**:
1. 前提条件
2. 専用ユーザーの作成
3. アプリケーションのインストール
4. 環境変数の設定
5. systemd サービスの設定
6. サービスの起動と確認
7. トラブルシューティング
8. アンインストール手順

---

## ディレクトリ構成

```text
/opt/claude-work/           # アプリケーションディレクトリ
├── data/                   # データディレクトリ（書き込み可能）
│   └── claudework.db      # SQLite データベース
├── node_modules/          # 依存パッケージ
└── ...                    # その他アプリケーションファイル

/etc/claude-work/          # 設定ディレクトリ
└── env                    # 環境変数ファイル

/etc/systemd/system/       # systemd ユニットファイル
└── claude-work.service    # サービス定義
```

---

## セキュリティ設計

### ユーザー権限

| ユーザー | 権限 | 用途 |
| -------- | ------ | ------ |
| claude-work | システムユーザー（ログイン不可） | サービス実行専用 |

### ファイル権限

| パス | 所有者 | パーミッション |
| ------ | -------- | ---------------- |
| /opt/claude-work | claude-work:claude-work | 755 |
| /opt/claude-work/data | claude-work:claude-work | 700 |
| /etc/claude-work/env | root:claude-work | 640 |
| /etc/systemd/system/claude-work.service | root:root | 644 |

### systemd セキュリティ機能

| 設定 | 効果 |
| ------ | ------ |
| NoNewPrivileges=true | 権限昇格を防止 |
| ProtectSystem=strict | /usr, /boot, /efi, /etc を読み取り専用に（最小権限の原則） |
| ProtectHome=read-only | /home, /root, /run/user を読み取り専用に |
| PrivateTmp=true | /tmp を隔離 |
| ReadWritePaths=/opt/claude-work | アプリケーションディレクトリへの書き込みを許可 |

---

## 技術的決定事項

### 決定1: インストール先を /opt/claude-work に

**理由**:
- /opt は追加ソフトウェアの標準的なインストール先
- ホームディレクトリ外にすることで ProtectHome との競合を回避
- パスが明確で管理しやすい

### 決定2: 環境変数ファイルを /etc/claude-work/env に

**理由**:
- /etc は設定ファイルの標準的な配置先
- systemd の EnvironmentFile で直接参照可能
- DATABASE_URL などの機密情報を分離管理

### 決定3: データディレクトリを /opt/claude-work/data に

**理由**:
- アプリケーションと同じ場所に配置し管理を簡素化
- ReadWritePaths で明示的に書き込み許可
- バックアップ対象が明確

---

## 成果物一覧

| ファイル | 説明 | 対応要件 |
| ---------- | ------ | ---------- |
| docs/SYSTEMD_SETUP.md | セットアップ手順ドキュメント | REQ-001〜REQ-005 |
| systemd/claude-work.service | systemd ユニットファイル | REQ-002, NFR-001, NFR-002, NFR-003 |
| systemd/claude-work.env.example | 環境変数テンプレート | REQ-002 |
