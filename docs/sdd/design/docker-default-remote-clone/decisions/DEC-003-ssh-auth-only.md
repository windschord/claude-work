# 技術的決定: DEC-003 - SSH推奨・HTTPS+PATもサポート

## ステータス

**決定済み** - 2026-02-17

## コンテキスト

リモートリポジトリへの認証方法を決定する必要がある。主なオプションはSSHとHTTPS（Personal Access Token）の2つ。

### 選択肢

1. **SSHのみサポート**
   - SSH鍵を使用した認証
   - セキュリティが高い
   - 設定が必要（SSH鍵の生成・登録）

2. **SSH推奨、HTTPS+PATもサポート**（採用）
   - SSHをデフォルトの推奨方法とする
   - HTTPS URLとPersonal Access Tokenによる認証も受け付ける
   - 柔軟性が高い

3. **HTTPS+PATのみ**
   - トークンによる認証
   - 設定が簡単
   - セキュリティ上はSSHより劣る

## 決定

**SSHを推奨しつつ、HTTPS+PATによる認証もサポートする**

## 根拠

### メリット

1. **SSH推奨の理由**:
   - 秘密鍵による強力な認証
   - パスワード/トークンが平文で扱われるリスクが低い
   - Docker環境で`~/.ssh`ディレクトリをマウントして既存の設定をそのまま使用可能

2. **HTTPS+PATサポートの理由**:
   - SSHキーが設定されていない環境でも利用可能
   - CI/CD環境やコンテナ環境での利用が容易
   - docs/SETUP.mdでのHTTPS+PAT利用案内と整合性を取る
   - テストコードでもHTTPSフローを想定

### デメリットと対応

1. **PATのセキュリティリスク**:
   - トークンが平文でURLに含まれるリスク
   - 対応: URLへのPAT埋め込みは行わず、環境変数やDocker環境の設定で管理
   - 対応: GitのCredential Helper（`GIT_ASKPASS`等）を使用して安全に認証

2. **複雑度の増加**:
   - 2つの認証方法のサポートが必要
   - 対応: Docker環境内でGit標準の認証フローを使用することで最小化

## 実装詳細

### SSH認証

```bash
# ~/.ssh を読み取り専用でマウント
docker run --rm \
  -v ~/.ssh:/home/node/.ssh:ro \
  -e GIT_TERMINAL_PROMPT=0 \
  image:tag \
  git clone git@github.com:user/repo.git /workspace/target
```

### HTTPS+PAT認証

```bash
# GIT_ASKPASSまたはURLに認証情報を含める（環境変数経由）
docker run --rm \
  -e GIT_TERMINAL_PROMPT=0 \
  image:tag \
  git clone https://github.com/user/repo.git /workspace/target
```

## 影響範囲

- DockerAdapter: SSH/HTTPS両方のURLをサポート
- RemoteRepoService: SSH URLとHTTPS URLの両方を受け付けるバリデーション
- docs/SETUP.md: 両認証方法の利用手順

## 参考資料

- SETUP.md: HTTPS+PATの利用案内
- remote-repo-service.ts: `validateRemoteUrl()`の実装
- US-005: リモートリポジトリのGit操作（認証要件）

## レビュー

- レビュアー: Claude Code
- レビュー日: 2026-02-17
- 承認: 承認済み
