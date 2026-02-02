# systemd による ClaudeWork の自動起動設定

このドキュメントでは、Ubuntu で ClaudeWork を systemd サービスとして設定し、システム起動時に自動起動させる方法を説明します。

## 目次

1. [前提条件](#前提条件)
2. [専用ユーザーの作成](#専用ユーザーの作成)
3. [アプリケーションのインストール](#アプリケーションのインストール)
4. [環境変数の設定](#環境変数の設定)
5. [systemd サービスの設定](#systemd-サービスの設定)
6. [サービスの起動と確認](#サービスの起動と確認)
7. [ログの確認](#ログの確認)
8. [トラブルシューティング](#トラブルシューティング)
9. [アンインストール](#アンインストール)

---

## 前提条件

- Ubuntu 20.04 LTS 以降
- Node.js 20 以上がインストール済み
- npm または pnpm がインストール済み
- sudo 権限を持つユーザーでログイン

### Node.js のインストール（未インストールの場合）

```bash
# NodeSource リポジトリの追加
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Node.js のインストール
sudo apt-get install -y nodejs
```

---

## 専用ユーザーの作成

セキュリティのため、ClaudeWork 専用のシステムユーザーを作成します。

```bash
# claude-work ユーザーを作成（ログイン不可、ホームディレクトリなし）
sudo useradd --system --no-create-home --shell /usr/sbin/nologin claude-work

# ユーザーが作成されたことを確認
id claude-work
```

---

## アプリケーションのインストール

### インストールディレクトリの準備

```bash
# /opt/claude-work ディレクトリを作成
sudo mkdir -p /opt/claude-work

# データディレクトリを作成
sudo mkdir -p /opt/claude-work/data

# 所有者を claude-work ユーザーに変更
sudo chown -R claude-work:claude-work /opt/claude-work
```

### ClaudeWork のインストール

```bash
# インストールディレクトリに移動
cd /opt/claude-work

# リポジトリをクローン
sudo -u claude-work git clone https://github.com/windschord/claude-work.git .

# 依存パッケージのインストール（ビルドに必要な devDependencies を含む）
sudo -u claude-work npm install

# アプリケーションのビルド
sudo -u claude-work npm run build

# Prisma クライアントの生成とデータベースの初期化
# DATABASE_URL を明示的に指定してデータベースを正しい場所に作成
sudo -u claude-work env DATABASE_URL=file:/opt/claude-work/data/claudework.db npx prisma generate
sudo -u claude-work env DATABASE_URL=file:/opt/claude-work/data/claudework.db npx prisma db push
```

> **注意**: npm グローバルインストール（`npm install -g claude-work`）は systemd セットアップには対応していません。上記の git clone 方式を使用してください。

---

## 環境変数の設定

### 設定ディレクトリの作成

```bash
# 設定ディレクトリを作成
sudo mkdir -p /etc/claude-work

# 環境変数ファイルをコピー
sudo cp /opt/claude-work/systemd/claude-work.env.example /etc/claude-work/env

# 権限を設定（root と claude-work グループのみ読み取り可能）
sudo chown root:claude-work /etc/claude-work/env
sudo chmod 640 /etc/claude-work/env
```

### 環境変数の編集

```bash
sudo nano /etc/claude-work/env
```

最低限、以下の設定を確認・編集してください：

```bash
# データベースパス
DATABASE_URL=file:/opt/claude-work/data/claudework.db

# ポート番号
PORT=3000

# 本番環境設定
NODE_ENV=production
```

---

## systemd サービスの設定

### ユニットファイルのコピー

```bash
# ユニットファイルをコピー
sudo cp /opt/claude-work/systemd/claude-work.service /etc/systemd/system/

# systemd にリロードを通知
sudo systemctl daemon-reload
```

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

正常に起動した場合、以下のような出力が表示されます：

```text
claude-work.service - ClaudeWork - Claude Code Session Manager
     Loaded: loaded (/etc/systemd/system/claude-work.service; enabled; vendor preset: enabled)
     Active: active (running) since ...
```

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
   ls -la /etc/claude-work/
   ```

### よくあるエラーと対処法

| エラー | 原因 | 対処法 |
| ------ | ------ | ------ |
| `Permission denied` | ファイル権限の問題 | `chown -R claude-work:claude-work /opt/claude-work` |
| `DATABASE_URL not set` | 環境変数が未設定 | `/etc/claude-work/env` を確認 |
| `EADDRINUSE` | ポートが使用中 | `PORT` を変更するか、競合プロセスを停止 |
| `Read-only file system` | ProtectSystem 制限 | `ReadWritePaths` に必要なパスを追加 |

### セキュリティ設定による制限事項

**ProtectHome=read-only について**:

systemd サービスはセキュリティ強化のため `ProtectHome=read-only` が設定されています。これにより、ホームディレクトリ（`/home/*`）への書き込みができません。

ユーザーのホームディレクトリ内のプロジェクト（例: `/home/user/projects`）を登録して使用する場合は、以下のいずれかの対応が必要です:

1. **プロジェクトを `/opt` 配下に配置する（推奨）**:
   ```bash
   # プロジェクトを /opt/projects に移動
   sudo mkdir -p /opt/projects
   sudo chown claude-work:claude-work /opt/projects
   ```

2. **systemd 設定を変更する**:
   ```bash
   sudo systemctl edit claude-work
   ```
   以下を追加:
   ```ini
   [Service]
   ProtectHome=false
   ```

### 手動でのテスト実行

```bash
# claude-work ユーザーとして手動実行（デバッグ用）
sudo -u claude-work bash -c 'source /etc/claude-work/env && cd /opt/claude-work && npx claude-work'
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

# アプリケーションを削除（データも削除される）
sudo rm -rf /opt/claude-work
```

### ユーザーの削除（オプション）

```bash
# claude-work ユーザーを削除
sudo userdel claude-work
```

---

## 関連ドキュメント

- [環境変数リファレンス](ENV_VARS.md)
- [セットアップガイド](SETUP.md)
- [API リファレンス](API.md)
