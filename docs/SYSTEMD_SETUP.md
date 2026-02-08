# systemd による ClaudeWork の自動起動設定

このドキュメントでは、Ubuntu で ClaudeWork を systemd サービスとして設定し、システム起動時に自動起動させる方法を説明します。

`claude-work` ユーザーのホームディレクトリを `/opt/claude-work` に設定し、npm キャッシュ (`~/.npm`)、Claude Code CLI (`~/.local/bin`)、SSH 鍵 (`~/.ssh`) をすべてこのディレクトリ配下に統一します。

## 目次

1. [前提条件](#前提条件)
2. [専用ユーザーの作成](#専用ユーザーの作成)
3. [ディレクトリの準備](#ディレクトリの準備)
4. [Claude Code CLI のインストール](#claude-code-cli-のインストール)
5. [SSH 鍵の設定（プライベートリポジトリ用）](#ssh-鍵の設定プライベートリポジトリ用)
6. [環境変数の設定](#環境変数の設定)
7. [systemd サービスの設定](#systemd-サービスの設定)
8. [サービスの起動と確認](#サービスの起動と確認)
9. [ログの確認](#ログの確認)
10. [トラブルシューティング](#トラブルシューティング)
11. [アンインストール](#アンインストール)

---

## 前提条件

- Ubuntu 20.04 LTS 以降
- Node.js 20 以上がインストール済み
- npm がインストール済み
- git がインストール済み（ワークツリー操作に必要）
- sudo 権限を持つユーザーでログイン
- Docker を使用する場合: Docker Engine がインストール済み

> **注**: Claude Code CLI はセットアップ手順の中で `claude-work` ユーザーにインストールします（[Claude Code CLI のインストール](#claude-code-cli-のインストール)を参照）。事前のインストールは不要です。

### git のインストール（未インストールの場合）

```bash
sudo apt-get update
sudo apt-get install -y git
```

### Node.js のインストール（未インストールの場合）

```bash
# NodeSource リポジトリの追加
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Node.js のインストール
sudo apt-get install -y nodejs
```

---

## 専用ユーザーの作成

セキュリティのため、ClaudeWork 専用のシステムユーザーを作成します。ホームディレクトリは `/opt/claude-work` です。

```bash
# claude-work ユーザーを作成（ログイン不可、ホームディレクトリは /opt/claude-work）
sudo useradd --system --home /opt/claude-work --shell /usr/sbin/nologin claude-work

# Docker を使用する場合: docker グループに追加
sudo usermod -aG docker claude-work

# ユーザーが作成されたことを確認
id claude-work
```

> **注意**: Docker グループへの追加は Docker Engine がインストールされている場合のみ必要です。Docker を使用しない場合はスキップしてください。グループ追加後、サービスの再起動が必要です。

---

## ディレクトリの準備

`/opt/claude-work` をホームディレクトリとして、必要なサブディレクトリを作成します。

```bash
# /opt/claude-work ディレクトリを作成
sudo mkdir -p /opt/claude-work

# 各サブディレクトリを作成
sudo mkdir -p /opt/claude-work/data        # データベース、リポジトリ
sudo mkdir -p /opt/claude-work/.npm        # npm キャッシュ
sudo mkdir -p /opt/claude-work/.local/bin  # Claude Code CLI インストール先

# 所有者を claude-work ユーザーに変更
sudo chown -R claude-work:claude-work /opt/claude-work
```

### ディレクトリ構成

systemd サービスでは `HOME=/opt/claude-work` が設定されるため、各ツールが `~` を参照する際にこのディレクトリが使用されます。

```text
/opt/claude-work/           # HOME ディレクトリ
  ├── .local/bin/           # Claude Code CLI (PATH に含まれる)
  ├── .npm/                 # npm/npx キャッシュ
  ├── .ssh/                 # SSH 鍵（プライベートリポジトリ用）
  └── data/                 # 永続データ
      ├── claudework.db     # SQLite データベース
      ├── repos/            # clone したリポジトリ
      └── environments/     # Docker 環境の認証情報
```

> **注意**: `npx github:windschord/claude-work` は初回実行時に GitHub からパッケージを取得し、ローカルにキャッシュします。キャッシュは `/opt/claude-work/.npm` に保存され、2回目以降はキャッシュから起動されるため高速です。データベース初期化、Next.js ビルドは自動実行されます。git clone や npm install は不要です。
>
> **ネットワーク要件**:
> - **初回起動**: GitHub へのインターネット接続が必須
> - **2回目以降**: キャッシュが有効な場合はオフラインでも起動可能
> - **キャッシュ更新**: npx は定期的に更新を確認するため、その際にはネットワーク接続が必要
> - **ネットワーク障害時**: キャッシュが存在すればそのキャッシュから起動、存在しなければ起動失敗

---

## Claude Code CLI のインストール

ClaudeWork は Claude Code CLI を使用してセッションを管理します。`claude-work` ユーザーのホームディレクトリにインストールします。

```bash
# claude-work ユーザーとして Claude Code CLI をインストール
# npm prefix を使用して ~/.local にインストール
sudo -u claude-work HOME=/opt/claude-work npm install -g @anthropic-ai/claude-code --prefix /opt/claude-work/.local

# インストールされたことを確認
sudo -u claude-work HOME=/opt/claude-work /opt/claude-work/.local/bin/claude --version
```

systemd サービスの PATH に `/opt/claude-work/.local/bin` が含まれているため、サービス起動時に `claude` コマンドが自動検出されます。`CLAUDE_CODE_PATH` を明示的に設定する必要はありません。

> **更新**: CLI を更新する場合は、同じコマンドを再実行してください。
> ```bash
> sudo -u claude-work HOME=/opt/claude-work npm install -g @anthropic-ai/claude-code --prefix /opt/claude-work/.local
> ```

---

## SSH 鍵の設定（プライベートリポジトリ用）

ClaudeWork でプライベート Git リポジトリを Clone する場合、`claude-work` ユーザー用の SSH 鍵を設定する必要があります。パブリックリポジトリのみ使用する場合はこのセクションをスキップしてください。

`HOME=/opt/claude-work` が設定されているため、SSH は自動的に `/opt/claude-work/.ssh/` を鍵の配置場所として参照します。

```bash
# claude-work ユーザーの .ssh ディレクトリを作成
sudo mkdir -p /opt/claude-work/.ssh
sudo chmod 700 /opt/claude-work/.ssh

# SSH 鍵ペアを生成
sudo ssh-keygen -t ed25519 -C "claude-work@$(hostname)" -f /opt/claude-work/.ssh/id_ed25519 -N ""

# 所有者を変更
sudo chown -R claude-work:claude-work /opt/claude-work/.ssh

# 公開鍵を表示（GitHub の Deploy Key などに登録）
sudo cat /opt/claude-work/.ssh/id_ed25519.pub
```

### GitHub への鍵登録

1. 表示された公開鍵をコピーします
2. GitHub リポジトリの **Settings** > **Deploy keys** > **Add deploy key** で登録します
3. **Allow write access** にチェックを入れます（ワークツリーの push が必要な場合）

### SSH 接続の確認

```bash
# claude-work ユーザーとして SSH 接続をテスト
sudo -u claude-work HOME=/opt/claude-work ssh -T git@github.com
```

> **注意**: systemd サービスの `ProtectHome=read-only` 設定により `/home/*` への書き込みは制限されますが、`/opt/claude-work/.ssh/` は `ReadWritePaths` で許可されているため問題ありません。

---

## 環境変数の設定

### 設定ディレクトリの作成

```bash
# 設定ディレクトリを作成
sudo mkdir -p /etc/claude-work

# 環境変数ファイルをダウンロード（HTTPS を利用）
# 本番環境では、/main/ の代わりに特定のタグやコミットハッシュへの URL を使用することを推奨します
sudo curl -fsSL https://raw.githubusercontent.com/windschord/claude-work/main/systemd/claude-work.env.example \
  -o /etc/claude-work/env \
  || { echo "環境変数ファイルのダウンロードに失敗しました。ネットワーク接続と URL を確認してください。"; exit 1; }

# 権限を設定（root と claude-work グループのみ読み取り可能）
sudo chown root:claude-work /etc/claude-work/env
sudo chmod 640 /etc/claude-work/env
```

### 環境変数の編集

```bash
sudo nano /etc/claude-work/env
```

最低限、以下の設定を確認・編集してください:

```bash
# データベースパス
DATABASE_URL=file:/opt/claude-work/data/claudework.db

# データディレクトリ（repos/ と environments/ の親ディレクトリ）
# npx キャッシュの再構築でデータが消失しないよう、node_modules 外に配置する
DATA_DIR=/opt/claude-work/data

# ポート番号
PORT=3000

# 本番環境設定
NODE_ENV=production

# 外部からのアクセスを許可する場合（デフォルト: localhost）
HOST=0.0.0.0
```

> **DATA_DIR について**: `npx github:windschord/claude-work` で起動する場合、カレントディレクトリは npx キャッシュ内のパッケージディレクトリになります。`DATA_DIR` を設定しない場合、`repos/`（clone したリポジトリ）や `environments/`（Docker 環境の認証情報）がキャッシュ内に作成され、`npx` キャッシュの再構築時にデータが消失します。`DATABASE_URL` と同じディレクトリ（`/opt/claude-work/data`）を指定することを推奨します。

> **注意**: `HOST=0.0.0.0` を設定すると、すべてのネットワークインターフェースでリッスンします。セキュリティのため、ファイアウォールや認証（`CLAUDE_WORK_TOKEN`）の設定を推奨します。

> **CLAUDE_CODE_PATH について**: systemd サービスの PATH に `/opt/claude-work/.local/bin` が含まれているため、通常は設定不要です。別の場所にインストールした場合のみ絶対パスを指定してください。

---

## systemd サービスの設定

### ユニットファイルのダウンロード

```bash
# ユニットファイルをダウンロード（HTTPS を利用）
# 本番環境では、/main/ の代わりに特定のタグやコミットハッシュへの URL を使用することを推奨します
sudo curl -fsSL https://raw.githubusercontent.com/windschord/claude-work/main/systemd/claude-work.service \
  -o /etc/systemd/system/claude-work.service \
  || { echo "ユニットファイルのダウンロードに失敗しました。ネットワーク接続と URL を確認してください。"; exit 1; }

# systemd にリロードを通知
sudo systemctl daemon-reload
```

### サービスの主要な設定

サービスファイルでは以下の環境が設定されます:

| 設定 | 値 | 説明 |
| --- | --- | --- |
| `HOME` | `/opt/claude-work` | ホームディレクトリ (`~/.npm`, `~/.ssh` 等の基準) |
| `PATH` | `/opt/claude-work/.local/bin:...` | Claude CLI を含む PATH |
| `ProtectHome` | `read-only` | `/home/*` への書き込みを制限 |
| `ReadWritePaths` | `/opt/claude-work` | アプリケーションディレクトリへの書き込みを許可 |

### サービスの有効化

```bash
# 自動起動を有効化
sudo systemctl enable claude-work

# 有効化されたことを確認
sudo systemctl is-enabled claude-work
```

---

## サービスの起動と確認

### サービスの起動

```bash
# サービスを起動
sudo systemctl start claude-work

# ステータスを確認
sudo systemctl status claude-work
```

正常に起動した場合、以下のような出力が表示されます:

```text
claude-work.service - ClaudeWork - Claude Code Session Manager
     Loaded: loaded (/etc/systemd/system/claude-work.service; enabled; vendor preset: enabled)
     Active: active (running) since ...
```

> **注意**: 初回起動時は GitHub からのダウンロード、データベース初期化、Next.js ビルドが実行されるため、起動に数分かかる場合があります。2回目以降はキャッシュから起動されるため高速です。

### 動作確認

```bash
# ブラウザでアクセス、または curl で確認
curl http://localhost:3000
```

---

## ログの確認

### リアルタイムログの表示

```bash
# ログをリアルタイムで監視
sudo journalctl -u claude-work -f
```

### 過去のログを確認

```bash
# 最新100行を表示
sudo journalctl -u claude-work -n 100

# 今日のログを表示
sudo journalctl -u claude-work --since today

# エラーログのみ表示
sudo journalctl -u claude-work -p err
```

---

## トラブルシューティング

### サービスが起動しない場合

1. **ログを確認**:
   ```bash
   sudo journalctl -u claude-work -n 50 --no-pager
   ```

2. **設定ファイルの構文確認**:
   ```bash
   sudo systemd-analyze verify /etc/systemd/system/claude-work.service
   ```

3. **環境変数ファイルの確認**:
   ```bash
   sudo cat /etc/claude-work/env
   ```

4. **権限の確認**:
   ```bash
   ls -la /opt/claude-work/
   ls -la /opt/claude-work/data/
   ls -la /opt/claude-work/.local/bin/
   ls -la /etc/claude-work/
   ```

5. **Claude CLI の確認**:
   ```bash
   sudo -u claude-work HOME=/opt/claude-work /opt/claude-work/.local/bin/claude --version
   ```

### よくあるエラーと対処法

| エラー | 原因 | 対処法 |
| ------ | ------ | ------ |
| `Permission denied` | ファイル権限の問題 | `chown -R claude-work:claude-work /opt/claude-work` |
| `DATABASE_URL not set` | 環境変数が未設定 | `/etc/claude-work/env` を確認 |
| `EADDRINUSE` | ポートが使用中 | `PORT` を変更するか、競合プロセスを停止 |
| `Read-only file system` | ProtectSystem 制限 | `ReadWritePaths` に必要なパスを追加 |
| `claude command not found in PATH` | CLI が PATH 上にない | [Claude Code CLI のインストール](#claude-code-cli-のインストール)を実行 |
| `CLAUDE_CODE_PATH is set but the path does not exist` | 指定パスに CLI がない | パスを修正するか `CLAUDE_CODE_PATH` を削除して PATH に任せる |
| `Module not found: Can't resolve '@/...'` | npx キャッシュ破損 | `sudo rm -rf /opt/claude-work/.npm/_npx` で再取得 |
| `permission denied while trying to connect to the Docker daemon` | docker グループ未参加 | `sudo usermod -aG docker claude-work` 後にサービス再起動 |
| `SQLITE_ERROR` / `no such table: Project` | DB が未初期化 | サービスを再起動して自動初期化を実行 |
| `Permission denied (publickey)` (git clone 時) | SSH 鍵が未設定 | [SSH 鍵の設定](#ssh-鍵の設定プライベートリポジトリ用)を参照 |

### セキュリティ設定による制限事項

**ProtectHome=read-only について**:

systemd サービスはセキュリティ強化のため `ProtectHome=read-only` が設定されています。これにより、`/home/*` への書き込みができません。`claude-work` ユーザーのホームディレクトリは `/opt/claude-work` のため、この制限の影響を受けません。

ユーザーのホームディレクトリ内のプロジェクト（例: `/home/user/projects`）を登録して使用する場合は、以下のいずれかの対応が必要です:

1. **プロジェクトを `/opt` 配下に配置する（推奨）**:
   ```bash
   # プロジェクトを /opt/projects に移動
   sudo mkdir -p /opt/projects
   sudo chown claude-work:claude-work /opt/projects
   ```

2. **systemd 設定を変更する（必要なディレクトリのみ書き込み可能にする）**:
   ```bash
   sudo systemctl edit claude-work
   ```
   以下を追加（`/home/user/projects` は実際のプロジェクトパスに置き換えてください）:
   ```ini
   [Service]
   ReadWritePaths=/home/user/projects
   ```

   複数のディレクトリを許可する場合:
   ```ini
   [Service]
   ReadWritePaths=/home/user1/projects /home/user2/projects
   ```

### 手動でのテスト実行

```bash
# claude-work ユーザーとして手動実行（デバッグ用）
sudo -u claude-work bash -c 'set -a && source /etc/claude-work/env && set +a && cd /opt/claude-work && HOME=/opt/claude-work PATH=/opt/claude-work/.local/bin:$PATH npx --yes github:windschord/claude-work'
```

---

## アンインストール

### サービスの停止と無効化

```bash
# サービスを停止
sudo systemctl stop claude-work

# 自動起動を無効化
sudo systemctl disable claude-work

# ユニットファイルを削除
sudo rm /etc/systemd/system/claude-work.service

# systemd をリロード
sudo systemctl daemon-reload
```

### ファイルの削除（オプション）

```bash
# 設定ファイルを削除
sudo rm -rf /etc/claude-work

# アプリケーションディレクトリを削除（データ、CLI、npm キャッシュも削除される）
sudo rm -rf /opt/claude-work
```

### ユーザーの削除（オプション）

```bash
# claude-work ユーザーを削除
sudo userdel claude-work
```

---

## 関連ドキュメント

- [環境変数リファレンス](./ENV_VARS.md)
- [セットアップガイド](./SETUP.md)
- [API リファレンス](./API.md)
