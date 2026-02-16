# 非機能要件: セキュリティ

## 概要

ハイブリッド設計では、SSH認証情報やgit設定などの機密情報をDockerコンテナにマウントする必要がある。これらの情報を安全に扱い、不正アクセスや改変を防ぐためのセキュリティ要件を定義する。

## セキュリティ要件

### NFR-SEC-001: SSH鍵の読み取り専用マウント
**Given** Docker環境でgit cloneまたはworktree作成を実行する時、
**When** SSH鍵ディレクトリ（~/.ssh）をマウントする時、
**Then** システムは読み取り専用（:ro）でマウントしなければならない

**実装例**:
```bash
docker run -v ~/.ssh:/root/.ssh:ro ...
```

**根拠**: コンテナ内での SSH鍵の改変や削除を防ぐ

### NFR-SEC-002: SSH Agent socketの安全なマウント
**Given** Docker環境でgit cloneまたはworktree作成を実行する時、
**When** SSH Agent socket（$SSH_AUTH_SOCK）をマウントする時、
**Then** システムは以下を遵守しなければならない:
- 環境変数SSH_AUTH_SOCKを適切に設定
- socketファイルをコンテナ内の固定パスにマウント
- socketのパーミッションを維持

**実装例**:
```bash
docker run \
  -v $SSH_AUTH_SOCK:/ssh-agent \
  -e SSH_AUTH_SOCK=/ssh-agent \
  ...
```

**根拠**: SSH Agent通信の安全性を保ち、認証問題を回避する

### NFR-SEC-003: git設定の読み取り専用マウント
**Given** Docker環境でgit cloneまたはworktree作成を実行する時、
**When** git設定ファイル（~/.gitconfig）をマウントする時、
**Then** システムは読み取り専用（:ro）でマウントしなければならない

**実装例**:
```bash
docker run -v ~/.gitconfig:/root/.gitconfig:ro ...
```

**根拠**: git設定の改変を防ぎ、ホスト環境の設定を保護する

### NFR-SEC-004: gh CLI認証の読み取り専用マウント
**Given** Docker環境でgit cloneまたはworktree作成を実行する時、
**When** gh CLI認証ディレクトリ（~/.config/gh）をマウントする時、
**Then** システムは読み取り専用（:ro）でマウントしなければならない

**実装例**:
```bash
docker run -v ~/.config/gh:/root/.config/gh:ro ...
```

**根拠**: gh CLI認証トークンの改変や漏洩を防ぐ

### NFR-SEC-005: パストラバーサル対策（プロジェクト名）
**Given** ユーザーがプロジェクト名を入力する時、
**When** プロジェクト名をバリデーションする時、
**Then** システムは以下を遵守しなければならない:
- `../` を含む名前を拒否
- 絶対パス（`/` で始まる）を拒否
- 英数字、ハイフン、アンダースコアのみを許可
- 最大長を255文字に制限

**実装例**:
```typescript
const VALID_PROJECT_NAME = /^[a-zA-Z0-9_-]+$/;
const MAX_PROJECT_NAME_LENGTH = 255;

function validateProjectName(name: string): boolean {
  if (!name || name.length > MAX_PROJECT_NAME_LENGTH) {
    return false;
  }
  if (name.includes('..') || name.startsWith('/')) {
    return false;
  }
  return VALID_PROJECT_NAME.test(name);
}
```

**根拠**: ディレクトリトラバーサル攻撃を防ぐ

### NFR-SEC-006: パストラバーサル対策（セッション名）
**Given** ユーザーがセッション名を入力する時、
**When** セッション名をバリデーションする時、
**Then** システムは以下を遵守しなければならない:
- `../` を含む名前を拒否
- 絶対パス（`/` で始まる）を拒否
- 英数字、ハイフン、アンダースコアのみを許可
- 最大長を255文字に制限

**根拠**: ディレクトリトラバーサル攻撃を防ぎ、worktreeディレクトリの安全性を保つ

### NFR-SEC-007: Dockerボリューム名の検証
**Given** Docker環境でプロジェクトを登録する時、
**When** Dockerボリューム名を生成する時、
**Then** システムは以下を遵守しなければならない:
- プレフィックス `claude-repo-` を使用
- プロジェクトIDまたはUUIDを使用（ユーザー入力を直接使用しない）
- 名前の一意性を保証

**実装例**:
```typescript
const volumeId = `claude-repo-${project.id}`;
```

**根拠**:
- 他のアプリケーションのボリュームとの衝突を防ぐ
- 手動クリーンアップ時の誤削除を防ぐ
- ユーザー入力に基づくインジェクション攻撃を防ぐ

### NFR-SEC-008: Dockerコンテナの自動削除
**Given** Docker環境でgit cloneまたはworktree作成を実行する時、
**When** 一時コンテナを起動する時、
**Then** システムは`--rm`フラグを使用してコンテナを自動削除しなければならない

**実装例**:
```bash
docker run --rm ...
```

**根拠**: 孤立したコンテナを残さず、セキュリティリスクを低減する

### NFR-SEC-009: コンテナの最小権限
**Given** Docker環境でgit cloneまたはworktree作成を実行する時、
**When** 一時コンテナを起動する時、
**Then** システムは最小限の権限でコンテナを実行しなければならない:
- root権限は必要最小限
- ネットワークアクセスはgit操作のみ
- 不要なケーパビリティは削除

**将来の改善**: 非rootユーザーでのコンテナ実行

### NFR-SEC-010: 認証情報のログ出力禁止
**Given** git cloneまたはworktree作成を実行する時、
**When** エラーが発生した時、
**Then** システムは以下の情報をログに出力してはならない:
- SSH鍵の内容
- SSH Agent socketのパス
- git設定の内容（認証トークンを含む可能性）
- gh CLI認証トークン

**根拠**: ログファイルからの認証情報漏洩を防ぐ

### NFR-SEC-011: リポジトリURLの検証
**Given** ユーザーがリポジトリURLを入力する時、
**When** URLをバリデーションする時、
**Then** システムは以下を遵守しなければならない:
- HTTPSまたはSSH形式のみを許可
- fileプロトコルは拒否
- ローカルパスは拒否

**実装例**:
```typescript
const VALID_GIT_URL = /^(https:\/\/|git@)/;

function validateRepositoryUrl(url: string): boolean {
  if (url.startsWith('file://') || url.startsWith('/')) {
    return false;
  }
  return VALID_GIT_URL.test(url);
}
```

**根拠**: ローカルファイルシステムへの不正アクセスを防ぐ

### NFR-SEC-012: エラーメッセージの適切な制御
**Given** git cloneまたはworktree作成が失敗した時、
**When** エラーメッセージをユーザーに表示する時、
**Then** システムは以下を遵守しなければならない:
- 認証情報を含まない
- ホスト環境のパス情報を最小限に抑える
- ユーザーにとって有用な情報のみを表示

**根拠**: エラーメッセージからの情報漏洩を防ぐ

## セキュリティテスト

### テストシナリオ1: SSH鍵の読み取り専用マウント検証
1. Docker環境でプロジェクトを登録
2. clone中にコンテナ内でSSH鍵の改変を試みる
3. 検証: 改変が拒否される（読み取り専用エラー）

### テストシナリオ2: パストラバーサル攻撃の防止
1. プロジェクト名に `../malicious` を入力
2. 登録ボタンをクリック
3. 検証: バリデーションエラーが表示される
4. 検証: プロジェクトが作成されない

### テストシナリオ3: Dockerボリューム名の安全性
1. Docker環境でプロジェクトを登録
2. 生成されたDockerボリューム名を確認
3. 検証: `claude-repo-` プレフィックスが付いている
4. 検証: ユーザー入力が直接使用されていない

### テストシナリオ4: コンテナの自動削除
1. Docker環境でプロジェクトを登録
2. `docker ps -a` でコンテナ一覧を確認
3. 検証: 一時コンテナが残っていない

### テストシナリオ5: リポジトリURLの検証
1. リポジトリURLに `file:///etc/passwd` を入力
2. 登録ボタンをクリック
3. 検証: バリデーションエラーが表示される

## セキュリティ監査

### 定期的な確認事項
- SSH鍵のマウントオプション（:ro）の確認
- git設定のマウントオプション（:ro）の確認
- gh CLI認証のマウントオプション（:ro）の確認
- パストラバーサル対策の有効性確認
- ログ出力の内容確認（認証情報が含まれていないか）

### セキュリティレビュー
- コードレビュー時にセキュリティチェックリストを使用
- 認証情報の扱いに関する特別な注意
- Dockerコマンドのセキュリティオプション確認

## 既知の制約と将来の改善

### 現在の制約
- Dockerコンテナをroot権限で実行（alpine/gitの制約）
- SSH Agent socketのパーミッションがホスト環境に依存

### 将来の改善
- 非rootユーザーでのコンテナ実行
- Docker securityプロファイルの適用
- 認証情報の暗号化（必要に応じて）
- 監査ログの強化

## 参考資料

- Docker Security Best Practices: https://docs.docker.com/develop/security-best-practices/
- OWASP Top 10: https://owasp.org/www-project-top-ten/
- Git Security: https://git-scm.com/book/en/v2/Git-Tools-Credential-Storage
