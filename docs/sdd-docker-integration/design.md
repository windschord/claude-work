# 設計書: Docker統合機能

## アーキテクチャ概要

### 現在のアーキテクチャ（Before）

```text
┌─────────────────────────────────────────────────────────────┐
│                      Frontend                                │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  XTerm.js Terminal                                  │    │
│  │  - 入力 → WebSocket送信                             │    │
│  │  - 受信 → terminal.write()                          │    │
│  └─────────────────────────────────────────────────────┘    │
│                          ↑↓                                  │
│                    WebSocket (/ws/claude/:id)                │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────┐
│                      Backend                                 │
│  ┌───────────────────────┴───────────────────────────┐      │
│  │  ClaudePTYManager                                  │      │
│  │  - node-pty でClaude Codeを起動                    │      │
│  │  - cwdをworktreeに設定                             │      │
│  │  - ホストシステム上で直接実行                       │      │
│  └───────────────────────────────────────────────────┘      │
│                          ↓                                   │
│  ┌───────────────────────────────────────────────────┐      │
│  │  Git Worktree                                      │      │
│  │  .worktrees/<session-name>/                        │      │
│  └───────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### 新アーキテクチャ（After）

```text
┌─────────────────────────────────────────────────────────────┐
│                      Frontend                                │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  XTerm.js Terminal（変更なし）                       │    │
│  │  - 入力 → WebSocket送信                             │    │
│  │  - 受信 → terminal.write()                          │    │
│  └─────────────────────────────────────────────────────┘    │
│                          ↑↓                                  │
│                    WebSocket (/ws/claude/:id)                │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────┐
│                      Backend                                 │
│  ┌───────────────────────┴───────────────────────────┐      │
│  │  ClaudePTYManager                                  │      │
│  │  ↓ dockerMode === true の場合                       │      │
│  │  DockerPTYAdapter を使用                            │      │
│  └───────────────────────────────────────────────────┘      │
│                          │                                   │
│          ┌───────────────┴───────────────┐                  │
│          ↓                               ↓                   │
│  ┌──────────────────┐          ┌──────────────────────┐     │
│  │ ホスト直接実行    │          │ Docker実行           │     │
│  │ (既存動作)        │          │ (新規)               │     │
│  │                   │          │                      │     │
│  │ node-pty          │          │ docker run           │     │
│  │   └→ claude       │          │   └→ claude          │     │
│  └──────────────────┘          └──────────────────────┘     │
│          ↓                               ↓                   │
│  ┌──────────────────┐          ┌──────────────────────┐     │
│  │ Git Worktree      │          │ Docker Container     │     │
│  │ (直接アクセス)    │          │ ┌────────────────┐  │     │
│  │                   │          │ │/workspace(RW)  │◄─┼─bind│
│  └──────────────────┘          │ │~/.claude(RO)   │  │     │
│                                 │ │~/.ssh(RO)      │  │     │
│                                 │ └────────────────┘  │     │
│                                 └──────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## コンポーネント設計

### 1. DockerService（新規）

**目的**: Dockerの可用性チェック、イメージ管理、コンテナ操作を統括

**ファイル**: `src/services/docker-service.ts`

**責務**:
- Dockerデーモンの可用性チェック
- イメージの存在確認とビルド
- コンテナの作成・起動・停止・削除
- ボリュームマウントの構成

**インターフェース**:
```typescript
interface DockerServiceConfig {
  imageName: string;           // デフォルト: 'claude-code-sandboxed'
  imageTag: string;            // デフォルト: 'latest'
  maxConcurrentContainers: number; // デフォルト: 5
}

interface ContainerConfig {
  sessionId: string;
  worktreePath: string;        // ホスト上のworktreeパス
  initialPrompt?: string;
}

interface ContainerInfo {
  containerId: string;
  sessionId: string;
  status: 'running' | 'stopped' | 'error';
}

class DockerService {
  // Docker可用性
  isDockerAvailable(): Promise<boolean>;

  // イメージ管理
  imageExists(): Promise<boolean>;
  buildImage(onProgress?: (line: string) => void): Promise<void>;

  // コンテナ管理
  createContainer(config: ContainerConfig): Promise<ContainerInfo>;
  startContainer(containerId: string): Promise<void>;
  stopContainer(containerId: string): Promise<void>;
  removeContainer(containerId: string): Promise<void>;

  // コンテナI/O
  attachToContainer(containerId: string): Promise<{
    stdin: NodeJS.WritableStream;
    stdout: NodeJS.ReadableStream;
  }>;
}
```

### 2. DockerPTYAdapter（新規）

**目的**: ClaudePTYManagerと同じインターフェースでDocker内Claude Codeを操作

**ファイル**: `src/services/docker-pty-adapter.ts`

**責務**:
- `docker run`を使用してClaude Codeコンテナを起動
- PTYと同等のI/Oインターフェースを提供
- コンテナライフサイクル管理

**インターフェース**:
```typescript
interface DockerPTYSession {
  containerId: string;
  sessionId: string;
  workingDir: string;
  initialPrompt?: string;
}

class DockerPTYAdapter extends EventEmitter {
  // ClaudePTYManagerと同じシグネチャ
  createSession(
    sessionId: string,
    workingDir: string,
    initialPrompt?: string,
    options?: CreateClaudePTYSessionOptions
  ): void;

  write(sessionId: string, data: string): void;
  resize(sessionId: string, cols: number, rows: number): void;
  destroySession(sessionId: string): void;
  restartSession(sessionId: string): void;
  hasSession(sessionId: string): boolean;
  getWorkingDir(sessionId: string): string | undefined;

  // イベント: 'data', 'exit', 'error'（ClaudePTYManagerと同じ）
}
```

**Docker起動コマンド構成**:
```typescript
const dockerArgs = [
  'run',
  '--rm',                                          // コンテナ終了時に削除
  '-it',                                           // 対話モード+TTY
  '--name', `claude-session-${sessionId}`,         // コンテナ名

  // ワークスペース（読み書き可能）
  '-v', `${worktreePath}:/workspace`,
  '-w', '/workspace',

  // Claude認証情報（読み取り専用）
  '-v', `${homeDir}/.claude:/home/claude/.claude:ro`,
  '-v', `${homeDir}/.config/claude:/home/claude/.config/claude:ro`,

  // Git認証情報（読み取り専用）
  '-v', `${homeDir}/.ssh:/home/claude/.ssh:ro`,
  '-v', `${homeDir}/.gitconfig:/home/claude/.gitconfig:ro`,

  // SSH Agent（macOS/Linux対応）
  '-v', `${sshAuthSock}:/ssh-agent`,
  '-e', 'SSH_AUTH_SOCK=/ssh-agent',

  // 環境変数
  '-e', `ANTHROPIC_API_KEY=${process.env.ANTHROPIC_API_KEY}`,

  // セキュリティ
  '--security-opt', 'no-new-privileges',
  '--cap-drop', 'ALL',

  // イメージ
  'claude-code-sandboxed:latest',

  // Claude Code起動
  'claude',
];
```

### 3. ClaudePTYManager（変更）

**目的**: ホスト実行とDocker実行の両方をサポート

**ファイル**: `src/services/claude-pty-manager.ts`

**変更内容**:
- `createSession`にdockerModeオプションを追加
- DockerPTYAdapterへの委譲ロジックを追加

**変更後のインターフェース**:
```typescript
interface CreateClaudePTYSessionOptions {
  resumeSessionId?: string;
  dockerMode?: boolean;        // 新規追加
}

// 内部実装
createSession(
  sessionId: string,
  workingDir: string,
  initialPrompt?: string,
  options?: CreateClaudePTYSessionOptions
): void {
  if (options?.dockerMode) {
    // DockerPTYAdapterを使用
    this.dockerAdapter.createSession(sessionId, workingDir, initialPrompt, options);
  } else {
    // 既存のnode-pty実装を使用
    // ... 現在のコード
  }
}
```

### 4. Dockerfile（新規）

**目的**: Claude Code実行用の軽量コンテナイメージ

**ファイル**: `docker/Dockerfile`

```dockerfile
# syntax=docker/dockerfile:1
FROM node:20-slim

# メタデータ
LABEL maintainer="Claude Work"
LABEL description="Sandboxed environment for running Claude Code"
LABEL version="1.0"

# 必要なツールをインストール
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    openssh-client \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Claude Codeをインストール
RUN npm install -g @anthropic-ai/claude-code

# nodeユーザーを使用（node:20-slimでは既にUID 1000のnodeユーザーが存在）
# /home/claudeを/home/nodeへのシンボリックリンクとして作成（互換性のため）
RUN ln -s /home/node /home/claude

# SSHディレクトリの準備（マウント用）
RUN mkdir -p /home/node/.ssh \
    && chmod 700 /home/node/.ssh \
    && chown node:node /home/node/.ssh

# Claude設定ディレクトリの準備（マウント用）
RUN mkdir -p /home/node/.claude \
    && mkdir -p /home/node/.config/claude \
    && chown -R node:node /home/node/.claude \
    && chown -R node:node /home/node/.config

# ワークスペースディレクトリの準備
RUN mkdir -p /workspace \
    && chown node:node /workspace

# 非rootユーザーに切り替え
USER node

# 環境変数設定
ENV HOME=/home/node
ENV TERM=xterm-256color
ENV COLORTERM=truecolor

# 作業ディレクトリ
WORKDIR /workspace

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD claude --version || exit 1

# デフォルトコマンド
CMD ["claude"]
```

### 5. Prismaスキーマ（変更）

**目的**: セッションのDockerモード設定を永続化

**ファイル**: `prisma/schema.prisma`

**変更内容**:
```prisma
model Session {
  id                 String    @id @default(uuid())
  project_id         String
  name               String
  status             String
  worktree_path      String
  branch_name        String
  docker_mode        Boolean   @default(false)  // 新規追加
  container_id       String?                     // 新規追加
  resume_session_id  String?
  last_activity_at   DateTime?
  pr_url             String?
  pr_number          Int?
  pr_status          String?
  pr_updated_at      DateTime?
  created_at         DateTime  @default(now())
  updated_at         DateTime  @updatedAt

  project            Project   @relation(fields: [project_id], references: [id], onDelete: Cascade)
  messages           Message[]
}
```

### 6. セッション作成API（変更）

**目的**: Dockerモード選択をサポート

**ファイル**: `src/app/api/projects/[id]/sessions/route.ts`

**変更内容**:
```typescript
interface CreateSessionRequest {
  name: string;
  prompt?: string;
  dockerMode?: boolean;  // 新規追加
}

// セッション作成時のロジック
if (dockerMode) {
  // Docker可用性をチェック
  const dockerService = new DockerService();
  if (!await dockerService.isDockerAvailable()) {
    return NextResponse.json(
      { error: 'Dockerが利用できません。Dockerデーモンが起動しているか確認してください。' },
      { status: 503 }
    );
  }

  // イメージが存在しない場合はビルド
  if (!await dockerService.imageExists()) {
    // ビルド処理（進捗をWebSocketで通知）
  }
}
```

### 7. UI変更

**目的**: セッション作成時のDockerモード選択

**ファイル**: `src/components/sessions/NewSessionForm.tsx`

**変更内容**:
```tsx
interface NewSessionFormData {
  name: string;
  prompt?: string;
  dockerMode: boolean;  // 新規追加
}

// フォームにトグルを追加
<div className="flex items-center gap-2">
  <label htmlFor="dockerMode" className="text-sm">
    Dockerモード
  </label>
  <input
    type="checkbox"
    id="dockerMode"
    checked={formData.dockerMode}
    onChange={(e) => setFormData({ ...formData, dockerMode: e.target.checked })}
  />
  <span className="text-xs text-gray-500">
    (隔離された環境で実行)
  </span>
</div>
```

## データフロー

### Docker セッション作成フロー

```text
1. ユーザーがDockerモードでセッション作成
   ↓
2. API: Docker可用性チェック
   ├─ 利用不可 → エラーレスポンス
   └─ 利用可能 → 続行
   ↓
3. API: Dockerイメージ存在チェック
   ├─ 存在しない → イメージビルド（進捗をWebSocketで通知）
   └─ 存在する → 続行
   ↓
4. API: worktree作成（既存処理）
   ↓
5. API: Sessionレコード作成（docker_mode=true）
   ↓
6. クライアント: WebSocket接続（/ws/claude/:id）
   ↓
7. ClaudeWebSocketHandler: DockerPTYAdapter使用を判断
   ↓
8. DockerPTYAdapter: docker run でコンテナ起動
   - ワークスペース: worktreeをバインドマウント
   - 認証情報: ~/.claude, ~/.ssh 等を読み取り専用マウント
   ↓
9. コンテナ内でClaude Code起動
   ↓
10. 双方向I/O確立（WebSocket ⟷ docker attach ⟷ Claude Code）
```

### Docker セッション停止フロー

```text
1. ユーザーがセッション停止をクリック
   ↓
2. API: セッション停止リクエスト
   ↓
3. ClaudePTYManager: DockerPTYAdapter.destroySession()
   ↓
4. DockerPTYAdapter: docker stop でコンテナ停止
   ↓
5. コンテナ終了 → 自動削除（--rm）
   ↓
6. Session.status = 'stopped', container_id = null
```

## ボリュームマウント詳細

### マウント構成

| ホストパス | コンテナパス | モード | 目的 |
|-----------|-------------|--------|------|
| `${PROJECT_ROOT}/.worktrees/${session}` | `/workspace` | RW | 作業ディレクトリ |
| `${HOME}/.claude` | `/home/node/.claude` | RW | Claude認証情報・デバッグログ |
| `${HOME}/.config/claude` | `/home/node/.config/claude` | RW | Claude設定 |
| `${HOME}/.ssh` | `/home/node/.ssh` | RO | SSH鍵 |
| `${HOME}/.gitconfig` | `/home/node/.gitconfig` | RO | Git設定 |
| `${SSH_AUTH_SOCK}` | `/ssh-agent` | RW | SSH Agent |

**注意**: Claude認証ディレクトリは、Claude Codeが`debug/`ディレクトリに診断ログを書き込むため、読み書き可能（RW）でマウントする必要があります。

### SSH Agent転送

**macOS**:
```bash
# SSH_AUTH_SOCKは通常 /private/tmp/com.apple.launchd.*/Listeners
-v "${SSH_AUTH_SOCK}:/ssh-agent" -e "SSH_AUTH_SOCK=/ssh-agent"
```

**Linux**:
```bash
# SSH_AUTH_SOCKは通常 /run/user/$(id -u)/keyring/ssh
-v "${SSH_AUTH_SOCK}:/ssh-agent" -e "SSH_AUTH_SOCK=/ssh-agent"
```

**WSL2**:
```bash
# npiperelayまたはsocat経由で転送が必要
# 実装詳細は後続タスクで検討
```

## セキュリティ設計

### コンテナセキュリティ

1. **非rootユーザー実行**
   - コンテナ内ではclaudeユーザー（UID 1000）で実行
   - ホストファイルへのアクセスは明示的にマウントされたもののみ

2. **権限制限**
   ```bash
   --security-opt no-new-privileges  # 権限昇格を禁止
   --cap-drop ALL                     # すべてのLinux capabilitiesを削除
   ```

3. **読み取り専用マウント**
   - 認証情報は`:ro`でマウント
   - ワークスペースのみ読み書き可能

4. **ネットワーク**
   - デフォルトのbridgeネットワークを使用（インターネットアクセス許可）
   - ホストネットワークへのアクセスは制限

### 認証情報の保護

1. **Anthropic利用規約準拠**
   - 認証情報は同一ユーザーのコンテナでのみ使用
   - コンテナ間での共有なし

2. **環境変数の取り扱い**
   - `ANTHROPIC_API_KEY`は`-e`オプションで渡す
   - コンテナ内の環境変数は外部からアクセス不可

3. **プラットフォーム別の認証方式**

   | プラットフォーム | 認証情報の保存場所 | Dockerコンテナでの利用方法 |
   |-----------------|-------------------|---------------------------|
   | macOS | Keychain（keytar経由） | `ANTHROPIC_API_KEY`環境変数が必要 |
   | Linux | `~/.claude/.credentials.json` | ディレクトリマウントで共有可能 |
   | WSL2 | `~/.claude/.credentials.json` | ディレクトリマウントで共有可能 |

   **macOSでの制約**:
   - macOSではClaude CodeがKeychainに認証情報を保存するため、`~/.claude/`をマウントしても認証情報は含まれない
   - Dockerモードを使用するには`ANTHROPIC_API_KEY`環境変数の設定が必須
   - API keyを使用すると、Pro/Max Planの使用量ではなく別途API料金が発生する

## 技術的決定事項

### 決定1: Docker CLIの使用方法

**検討した選択肢**:
- A) Docker SDK (dockerode) を使用
- B) Docker CLI (`docker` コマンド) を直接実行

**決定**: B) Docker CLI

**根拠**:
- 依存関係が少ない
- デバッグが容易（コマンドラインで再現可能）
- Docker SDKのAPI変更の影響を受けにくい

### 決定2: コンテナのライフサイクル

**検討した選択肢**:
- A) セッションごとに新規コンテナを作成・削除
- B) 永続的なコンテナを再利用

**決定**: A) セッションごとに新規コンテナ

**根拠**:
- クリーンな状態を保証
- リソースリーク防止
- セッション分離の明確化
- `--rm`フラグによる自動クリーンアップ

### 決定3: PTY vs docker attach

**検討した選択肢**:
- A) `docker run -it` + node-pty
- B) `docker run -d` + `docker attach`
- C) `docker run -d` + `docker exec -it`

**決定**: A) docker run -it + node-pty

**根拠**:
- 既存のClaudePTYManagerアーキテクチャと整合
- TTYの完全なサポート
- シンプルな実装

### 決定4: イメージビルドタイミング

**検討した選択肢**:
- A) インストール時に事前ビルド
- B) 初回Dockerセッション作成時に遅延ビルド
- C) ユーザーが明示的にビルド

**決定**: B) 初回Dockerセッション作成時 + C) 再ビルドオプション

**根拠**:
- ゼロコンフィグでの利用開始
- 必要になるまでリソースを消費しない
- 最新のClaude Codeを使用するための再ビルドオプション

## エラーハンドリング

### Dockerエラー

| エラー種別 | 検出方法 | ユーザーへの通知 |
|-----------|---------|----------------|
| Dockerデーモン停止 | `docker info`失敗 | 「Dockerが起動していません」 |
| イメージビルド失敗 | exit code非0 | ビルドログを表示 |
| コンテナ起動失敗 | docker run失敗 | エラーメッセージを表示 |
| 認証情報マウント失敗 | ファイル不在 | 「認証情報が見つかりません」 |
| ディスク容量不足 | イメージビルド時 | 「ディスク容量が不足しています」 |

### フォールバック

Dockerが利用できない場合:
1. UIでDockerモードを選択不可に
2. エラーメッセージ表示
3. ホスト直接実行モードへの切り替えを提案

## 設定オプション

### 環境変数

| 変数名 | 説明 | デフォルト値 |
|--------|------|-------------|
| `DOCKER_IMAGE_NAME` | 使用するイメージ名 | `claude-code-sandboxed` |
| `DOCKER_IMAGE_TAG` | イメージタグ | `latest` |
| `DOCKER_MAX_CONTAINERS` | 同時実行コンテナ数上限 | `5` |
| `DOCKER_ENABLED` | Docker機能の有効/無効 | `true` |

## テスト戦略

### ユニットテスト

- DockerService: Dockerコマンドのモック
- DockerPTYAdapter: コンテナI/Oのモック
- ClaudePTYManager: モード切り替えロジック

### 統合テスト

- 実際のDockerコンテナを使用
- ワークスペースのファイル操作確認
- 認証情報の引き継ぎ確認

### E2Eテスト

- UIからDockerセッション作成
- ターミナル操作
- セッション停止・再開

## 実装順序

1. **Phase 1: 基盤**
   - DockerService実装
   - Dockerfile作成
   - イメージビルド機能

2. **Phase 2: コア機能**
   - DockerPTYAdapter実装
   - ClaudePTYManager変更
   - Prismaスキーマ変更

3. **Phase 3: API・UI**
   - セッション作成API変更
   - UIにDockerモードトグル追加

4. **Phase 4: 品質・運用**
   - テスト追加
   - ドキュメント更新
   - エラーハンドリング強化
