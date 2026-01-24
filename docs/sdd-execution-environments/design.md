# 設計書: 実行環境（Execution Environments）機能

## アーキテクチャ概要

### 現在のアーキテクチャ（Before）

```text
┌─────────────────────────────────────────────────────────────┐
│                      Session                                 │
│  ┌────────────────────────────────────────────────────┐     │
│  │  docker_mode: boolean                               │     │
│  │  container_id: string?                              │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                              ↓
              ┌───────────────┴───────────────┐
              │                               │
    docker_mode=false              docker_mode=true
              │                               │
              ↓                               ↓
    ┌──────────────────┐          ┌──────────────────────┐
    │ ClaudePTYManager │          │ DockerPTYAdapter     │
    │ (HOST実行)       │          │ (ホスト認証情報共有) │
    └──────────────────┘          └──────────────────────┘
```

### 新アーキテクチャ（After）

```text
┌─────────────────────────────────────────────────────────────┐
│                 ExecutionEnvironment                         │
│  ┌────────────────────────────────────────────────────┐     │
│  │  id: string                                         │     │
│  │  name: string                                       │     │
│  │  type: 'HOST' | 'DOCKER' | 'SSH'                    │     │
│  │  config: JSON (type固有設定)                        │     │
│  │  auth_dir_path: string (Docker用認証ディレクトリ)   │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      Session                                 │
│  ┌────────────────────────────────────────────────────┐     │
│  │  environment_id: string? (→ExecutionEnvironment)    │     │
│  │  docker_mode: boolean (非推奨、互換性維持)          │     │
│  │  container_id: string?                              │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              EnvironmentAdapter (抽象)                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  interface EnvironmentAdapter {                       │   │
│  │    createSession(sessionId, workDir, prompt?): void   │   │
│  │    write(sessionId, data): void                       │   │
│  │    resize(sessionId, cols, rows): void                │   │
│  │    destroySession(sessionId): void                    │   │
│  │    hasSession(sessionId): boolean                     │   │
│  │    checkStatus(): Promise<EnvironmentStatus>          │   │
│  │  }                                                    │   │
│  └──────────────────────────────────────────────────────┘   │
│                              ↓                               │
│    ┌───────────────────┬───────────────────┬──────────────┐ │
│    ↓                   ↓                   ↓              │ │
│  ┌──────────┐   ┌──────────────┐   ┌──────────────┐       │ │
│  │HostAdapter│   │DockerAdapter │   │SSHAdapter    │       │ │
│  │(既存PTY)  │   │(独立認証)    │   │(将来実装)    │       │ │
│  └──────────┘   └──────────────┘   └──────────────┘       │ │
└─────────────────────────────────────────────────────────────┘
```

## データモデル設計

### Prismaスキーマ変更

```prisma
// 実行環境タイプ
// Prisma SQLiteではenumが使えないためStringで管理
// 値: 'HOST' | 'DOCKER' | 'SSH'

model ExecutionEnvironment {
  id            String   @id @default(uuid())
  name          String   // 表示名（例: "Docker Dev", "Production Server"）
  type          String   // 'HOST' | 'DOCKER' | 'SSH'
  description   String?  // 環境の説明
  config        String   // JSON形式の設定（type固有）
  auth_dir_path String?  // Docker用認証情報ディレクトリ（data/environments/<id>/）
  is_default    Boolean  @default(false) // デフォルト環境フラグ
  created_at    DateTime @default(now())
  updated_at    DateTime @updatedAt

  sessions      Session[]

  @@unique([is_default]) // is_default=trueは1つのみ（制約はアプリ側で管理）
}

model Session {
  id                 String    @id @default(uuid())
  project_id         String
  name               String
  status             String
  worktree_path      String
  branch_name        String
  environment_id     String?   // 新規追加：実行環境への参照
  resume_session_id  String?
  last_activity_at   DateTime?
  pr_url             String?
  pr_number          Int?
  pr_status          String?
  pr_updated_at      DateTime?
  docker_mode        Boolean   @default(false) // 非推奨（互換性維持）
  container_id       String?
  created_at         DateTime  @default(now())
  updated_at         DateTime  @updatedAt

  project            Project   @relation(fields: [project_id], references: [id], onDelete: Cascade)
  environment        ExecutionEnvironment? @relation(fields: [environment_id], references: [id], onDelete: SetNull)
  messages           Message[]
}
```

### 環境タイプ別Config

```typescript
// HOST環境設定
interface HostEnvironmentConfig {
  // 特別な設定なし（ローカル実行）
}

// Docker環境設定
interface DockerEnvironmentConfig {
  // イメージソース（排他的）
  imageSource: 'existing' | 'dockerfile';

  // 既存イメージを使用する場合
  imageName?: string;      // 例: 'claude-code-sandboxed', 'ubuntu'
  imageTag?: string;       // 例: 'latest', '22.04'

  // Dockerfileからビルドする場合
  // Dockerfileは data/environments/<env-id>/Dockerfile に保存される
  dockerfileUploaded?: boolean; // Dockerfileがアップロード済みかどうか
  buildImageName?: string;      // ビルド後のイメージ名（自動生成: claude-work-env-<env-id>）

  // Volume設定
  volumes: {
    workspace: 'bind';    // 常にbindマウント
    auth: 'bind' | 'named'; // 認証情報のマウント方式
  };
  // セキュリティ設定
  security: {
    capDrop: string[];    // デフォルト: ['ALL']
    noNewPrivileges: boolean; // デフォルト: true
  };
}

// SSH環境設定（将来用）
interface SSHEnvironmentConfig {
  host: string;
  port: number;           // デフォルト: 22
  username: string;
  authMethod: 'key' | 'password';
  keyPath?: string;
  remoteWorkDir: string;
}

// 共通型
type EnvironmentConfig =
  | { type: 'HOST'; config: HostEnvironmentConfig }
  | { type: 'DOCKER'; config: DockerEnvironmentConfig }
  | { type: 'SSH'; config: SSHEnvironmentConfig };
```

## コンポーネント設計

### 1. EnvironmentService（新規）

**目的**: 実行環境のCRUD操作と状態管理

**ファイル**: `src/services/environment-service.ts`

**責務**:
- 実行環境の作成・更新・削除
- 環境一覧の取得
- 環境の状態チェック（Docker利用可能性など）
- 認証ディレクトリの管理

**インターフェース**:
```typescript
interface EnvironmentStatus {
  available: boolean;
  authenticated: boolean;
  error?: string;
  details?: {
    dockerDaemon?: boolean;
    imageExists?: boolean;
  };
}

interface CreateEnvironmentInput {
  name: string;
  type: 'HOST' | 'DOCKER' | 'SSH';
  description?: string;
  config: object;
}

interface UpdateEnvironmentInput {
  name?: string;
  description?: string;
  config?: object;
}

class EnvironmentService {
  // CRUD
  async create(input: CreateEnvironmentInput): Promise<ExecutionEnvironment>;
  async findById(id: string): Promise<ExecutionEnvironment | null>;
  async findAll(): Promise<ExecutionEnvironment[]>;
  async update(id: string, input: UpdateEnvironmentInput): Promise<ExecutionEnvironment>;
  async delete(id: string): Promise<void>;

  // デフォルト環境
  async getDefault(): Promise<ExecutionEnvironment>;
  async ensureDefaultExists(): Promise<void>;

  // 状態チェック
  async checkStatus(id: string): Promise<EnvironmentStatus>;

  // Docker環境固有
  async createAuthDirectory(id: string): Promise<string>;
  async deleteAuthDirectory(id: string): Promise<void>;
}
```

### 2. EnvironmentAdapter（抽象インターフェース）

**目的**: 実行環境の抽象化インターフェース

**ファイル**: `src/services/environment-adapter.ts`

```typescript
import { EventEmitter } from 'events';

export interface EnvironmentAdapter extends EventEmitter {
  // セッション管理
  createSession(
    sessionId: string,
    workingDir: string,
    initialPrompt?: string,
    options?: CreateSessionOptions
  ): void;
  write(sessionId: string, data: string): void;
  resize(sessionId: string, cols: number, rows: number): void;
  destroySession(sessionId: string): void;
  restartSession(sessionId: string): void;
  hasSession(sessionId: string): boolean;
  getWorkingDir(sessionId: string): string | undefined;

  // イベント
  // 'data': (sessionId: string, data: string) => void
  // 'exit': (sessionId: string, info: { exitCode: number; signal?: number }) => void
  // 'error': (sessionId: string, error: Error) => void
  // 'claudeSessionId': (sessionId: string, claudeSessionId: string) => void
}

export interface CreateSessionOptions {
  resumeSessionId?: string;
}
```

### 3. HostAdapter（新規、既存ClaudePTYManagerのラッパー）

**目的**: HOST環境用のアダプター

**ファイル**: `src/services/adapters/host-adapter.ts`

```typescript
import { EventEmitter } from 'events';
import { ClaudePTYManager } from '../claude-pty-manager';
import { EnvironmentAdapter, CreateSessionOptions } from '../environment-adapter';

export class HostAdapter extends EventEmitter implements EnvironmentAdapter {
  private ptyManager: ClaudePTYManager;

  constructor() {
    super();
    this.ptyManager = new ClaudePTYManager();

    // イベント転送
    this.ptyManager.on('data', (sid, data) => this.emit('data', sid, data));
    this.ptyManager.on('exit', (sid, info) => this.emit('exit', sid, info));
    this.ptyManager.on('error', (sid, err) => this.emit('error', sid, err));
    this.ptyManager.on('claudeSessionId', (sid, csid) => this.emit('claudeSessionId', sid, csid));
  }

  createSession(
    sessionId: string,
    workingDir: string,
    initialPrompt?: string,
    options?: CreateSessionOptions
  ): void {
    this.ptyManager.createSession(sessionId, workingDir, initialPrompt, {
      resumeSessionId: options?.resumeSessionId,
      dockerMode: false,
    });
  }

  write(sessionId: string, data: string): void {
    this.ptyManager.write(sessionId, data);
  }

  resize(sessionId: string, cols: number, rows: number): void {
    this.ptyManager.resize(sessionId, cols, rows);
  }

  destroySession(sessionId: string): void {
    this.ptyManager.destroySession(sessionId);
  }

  restartSession(sessionId: string): void {
    this.ptyManager.restartSession(sessionId);
  }

  hasSession(sessionId: string): boolean {
    return this.ptyManager.hasSession(sessionId);
  }

  getWorkingDir(sessionId: string): string | undefined {
    return this.ptyManager.getWorkingDir(sessionId);
  }
}
```

### 4. DockerAdapter（新規、独立認証対応）

**目的**: Docker環境用のアダプター（環境ごとに独立した認証）

**ファイル**: `src/services/adapters/docker-adapter.ts`

```typescript
import { EventEmitter } from 'events';
import * as pty from 'node-pty';
import * as path from 'path';
import * as fs from 'fs';
import { EnvironmentAdapter, CreateSessionOptions } from '../environment-adapter';

export interface DockerAdapterConfig {
  environmentId: string;
  imageName: string;
  imageTag: string;
  authDirPath: string; // 環境専用認証ディレクトリ
}

export class DockerAdapter extends EventEmitter implements EnvironmentAdapter {
  private config: DockerAdapterConfig;
  private sessions: Map<string, DockerSession> = new Map();

  constructor(config: DockerAdapterConfig) {
    super();
    this.config = config;
  }

  /**
   * Docker実行引数を構築（環境専用認証ディレクトリを使用）
   */
  private buildDockerArgs(workingDir: string, options?: CreateSessionOptions): string[] {
    const args: string[] = ['run', '-it', '--rm'];

    // コンテナ名
    const containerName = `claude-env-${this.config.environmentId}-${Date.now()}`;
    args.push('--name', containerName);

    // セキュリティ
    args.push('--cap-drop', 'ALL');
    args.push('--security-opt', 'no-new-privileges');

    // ワークスペース（RW）
    args.push('-v', `${workingDir}:/workspace`);

    // 環境専用認証ディレクトリ（RW）
    // data/environments/<env-id>/claude → /home/node/.claude
    const claudeAuthDir = path.join(this.config.authDirPath, 'claude');
    args.push('-v', `${claudeAuthDir}:/home/node/.claude`);

    const claudeConfigDir = path.join(this.config.authDirPath, 'config', 'claude');
    args.push('-v', `${claudeConfigDir}:/home/node/.config/claude`);

    // Git認証情報（RO）- ホストから共有
    const homeDir = process.env.HOME || '';
    const sshDir = path.join(homeDir, '.ssh');
    if (fs.existsSync(sshDir)) {
      args.push('-v', `${sshDir}:/home/node/.ssh:ro`);
    }
    const gitconfigPath = path.join(homeDir, '.gitconfig');
    if (fs.existsSync(gitconfigPath)) {
      args.push('-v', `${gitconfigPath}:/home/node/.gitconfig:ro`);
    }

    // SSH Agent転送
    const sshAuthSock = process.env.SSH_AUTH_SOCK;
    if (sshAuthSock) {
      args.push('-v', `${sshAuthSock}:/ssh-agent`);
      args.push('-e', 'SSH_AUTH_SOCK=/ssh-agent');
    }

    // イメージ
    args.push(`${this.config.imageName}:${this.config.imageTag}`);

    // claudeコマンド
    args.push('claude');
    if (options?.resumeSessionId) {
      args.push('--resume', options.resumeSessionId);
    }

    return args;
  }

  createSession(
    sessionId: string,
    workingDir: string,
    initialPrompt?: string,
    options?: CreateSessionOptions
  ): void {
    // 既存セッションのクリーンアップ
    if (this.sessions.has(sessionId)) {
      this.destroySession(sessionId);
    }

    const dockerArgs = this.buildDockerArgs(workingDir, options);

    const ptyProcess = pty.spawn('docker', dockerArgs, {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      env: { TERM: 'xterm-256color', COLORTERM: 'truecolor' },
    });

    this.sessions.set(sessionId, {
      ptyProcess,
      workingDir,
    });

    // イベント転送
    ptyProcess.onData((data) => this.emit('data', sessionId, data));
    ptyProcess.onExit(({ exitCode, signal }) => {
      this.emit('exit', sessionId, { exitCode, signal });
      this.sessions.delete(sessionId);
    });

    // 初期プロンプト
    if (initialPrompt) {
      setTimeout(() => {
        if (this.sessions.has(sessionId)) {
          ptyProcess.write(initialPrompt + '\n');
        }
      }, 3000);
    }
  }

  write(sessionId: string, data: string): void {
    this.sessions.get(sessionId)?.ptyProcess.write(data);
  }

  resize(sessionId: string, cols: number, rows: number): void {
    this.sessions.get(sessionId)?.ptyProcess.resize(cols, rows);
  }

  destroySession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.ptyProcess.kill();
      this.sessions.delete(sessionId);
    }
  }

  restartSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      const { workingDir } = session;
      this.destroySession(sessionId);
      setTimeout(() => this.createSession(sessionId, workingDir), 500);
    }
  }

  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  getWorkingDir(sessionId: string): string | undefined {
    return this.sessions.get(sessionId)?.workingDir;
  }
}

interface DockerSession {
  ptyProcess: pty.IPty;
  workingDir: string;
}
```

### 5. AdapterFactory（新規）

**目的**: 環境タイプに応じたアダプターの生成

**ファイル**: `src/services/adapter-factory.ts`

```typescript
import { ExecutionEnvironment } from '@prisma/client';
import { EnvironmentAdapter } from './environment-adapter';
import { HostAdapter } from './adapters/host-adapter';
import { DockerAdapter } from './adapters/docker-adapter';

export class AdapterFactory {
  private static hostAdapter: HostAdapter | null = null;
  private static dockerAdapters: Map<string, DockerAdapter> = new Map();

  /**
   * 環境に対応するアダプターを取得
   */
  static getAdapter(environment: ExecutionEnvironment): EnvironmentAdapter {
    switch (environment.type) {
      case 'HOST':
        return this.getHostAdapter();

      case 'DOCKER':
        return this.getDockerAdapter(environment);

      case 'SSH':
        throw new Error('SSH adapter is not yet implemented');

      default:
        throw new Error(`Unknown environment type: ${environment.type}`);
    }
  }

  private static getHostAdapter(): HostAdapter {
    if (!this.hostAdapter) {
      this.hostAdapter = new HostAdapter();
    }
    return this.hostAdapter;
  }

  private static getDockerAdapter(environment: ExecutionEnvironment): DockerAdapter {
    let adapter = this.dockerAdapters.get(environment.id);
    if (!adapter) {
      const config = JSON.parse(environment.config) as DockerEnvironmentConfig;
      adapter = new DockerAdapter({
        environmentId: environment.id,
        imageName: config.imageName || 'claude-code-sandboxed',
        imageTag: config.imageTag || 'latest',
        authDirPath: environment.auth_dir_path!,
      });
      this.dockerAdapters.set(environment.id, adapter);
    }
    return adapter;
  }

  /**
   * Docker環境削除時にアダプターをクリーンアップ
   */
  static removeDockerAdapter(environmentId: string): void {
    this.dockerAdapters.delete(environmentId);
  }
}
```

### 6. ClaudeWebSocketHandler変更

**目的**: 環境に応じたアダプターを使用

**ファイル**: `src/lib/websocket/claude-ws.ts`

```typescript
// 変更前
const dockerMode = session.docker_mode;
if (dockerMode) {
  dockerPtyAdapter.createSession(...);
} else {
  claudePtyManager.createSession(...);
}

// 変更後
import { AdapterFactory } from '@/services/adapter-factory';
import { environmentService } from '@/services/environment-service';

// 環境を取得（environment_idがなければデフォルト環境）
const environment = session.environment_id
  ? await environmentService.findById(session.environment_id)
  : await environmentService.getDefault();

// アダプターを取得
const adapter = AdapterFactory.getAdapter(environment);

// セッション作成
adapter.createSession(
  session.id,
  session.worktree_path,
  initialPrompt,
  { resumeSessionId: session.resume_session_id || undefined }
);
```

## API設計

### 環境管理API

#### GET /api/environments

**説明**: 実行環境一覧を取得

**レスポンス**:
```json
{
  "environments": [
    {
      "id": "host-default",
      "name": "Local Host",
      "type": "HOST",
      "description": "ローカル環境で直接実行",
      "config": {},
      "is_default": true,
      "status": {
        "available": true,
        "authenticated": true
      }
    },
    {
      "id": "docker-dev",
      "name": "Docker Dev",
      "type": "DOCKER",
      "description": "開発用Docker環境",
      "config": {
        "imageName": "claude-code-sandboxed",
        "imageTag": "latest"
      },
      "is_default": false,
      "status": {
        "available": true,
        "authenticated": false,
        "details": {
          "dockerDaemon": true,
          "imageExists": true
        }
      }
    }
  ]
}
```

#### POST /api/environments

**説明**: 実行環境を作成

**リクエスト**:
```json
{
  "name": "Docker Production",
  "type": "DOCKER",
  "description": "本番用Docker環境",
  "config": {
    "imageName": "claude-code-sandboxed",
    "imageTag": "v1.0"
  }
}
```

**レスポンス**:
```json
{
  "id": "abc123",
  "name": "Docker Production",
  "type": "DOCKER",
  "description": "本番用Docker環境",
  "config": {...},
  "auth_dir_path": "data/environments/abc123",
  "is_default": false
}
```

#### PUT /api/environments/:id

**説明**: 実行環境を更新

#### DELETE /api/environments/:id

**説明**: 実行環境を削除

**エラーケース**:
- 400: デフォルト環境は削除不可
- 409: 使用中のセッションがある（警告後は強制削除可能）

#### GET /api/environments/:id/status

**説明**: 実行環境の状態を取得

**レスポンス**:
```json
{
  "available": true,
  "authenticated": true,
  "details": {
    "dockerDaemon": true,
    "imageExists": true
  }
}
```

#### GET /api/docker/images

**説明**: ローカルDockerイメージ一覧を取得

**レスポンス**:
```json
{
  "images": [
    {
      "repository": "claude-code-sandboxed",
      "tag": "latest",
      "id": "sha256:abc123...",
      "size": "1.2GB",
      "created": "2025-01-20T10:00:00Z"
    },
    {
      "repository": "ubuntu",
      "tag": "22.04",
      "id": "sha256:def456...",
      "size": "77MB",
      "created": "2025-01-15T08:00:00Z"
    }
  ]
}
```

#### POST /api/docker/image-build

**説明**: Dockerfileからイメージをビルド

**リクエスト**:
```json
{
  "dockerfilePath": "/path/to/Dockerfile",
  "imageName": "claude-work-env-abc123",
  "imageTag": "latest"
}
```

**レスポンス**:
```json
{
  "success": true,
  "imageName": "claude-work-env-abc123:latest",
  "buildLog": "Step 1/5: FROM ubuntu:22.04\n..."
}
```

**エラーケース**:
- 400: Dockerfileが見つからない
- 400: ビルドエラー
- 500: Dockerデーモンに接続できない

#### POST /api/environments/:id/dockerfile

**説明**: Docker環境にDockerfileをアップロード

**リクエスト**: `multipart/form-data`
- `dockerfile`: Dockerfileファイル（必須）

**処理**:
1. ファイルを `data/environments/<env-id>/Dockerfile` に保存
2. 環境の`config.dockerfileUploaded`を`true`に更新

**レスポンス**:
```json
{
  "success": true,
  "path": "data/environments/abc123/Dockerfile"
}
```

**エラーケース**:
- 400: ファイルが添付されていない
- 400: 環境タイプがDOCKERではない
- 404: 環境が見つからない

#### DELETE /api/environments/:id/dockerfile

**説明**: Docker環境のDockerfileを削除

**処理**:
1. `data/environments/<env-id>/Dockerfile` を削除
2. 環境の`config.dockerfileUploaded`を`false`に更新
3. 環境の`config.imageSource`を`'existing'`に変更

**レスポンス**:
```json
{
  "success": true
}
```

**エラーケース**:
- 400: 環境タイプがDOCKERではない
- 404: 環境が見つからない

### セッション作成API変更

#### POST /api/projects/:project_id/sessions

**リクエスト（変更後）**:
```json
{
  "name": "feature-auth",
  "prompt": "認証機能を実装してください",
  "environment_id": "docker-dev"
}
```

`docker_mode`は非推奨。`environment_id`が指定されない場合はデフォルト環境を使用。

## ディレクトリ構造

### 認証情報ディレクトリ

```text
data/
└── environments/
    ├── <env-id-1>/
    │   ├── Dockerfile              # Dockerfileアップロード時のみ存在
    │   ├── claude/
    │   │   ├── .credentials.json
    │   │   └── debug/
    │   └── config/
    │       └── claude/
    │           └── settings.json
    ├── <env-id-2>/
    │   └── ...
    └── ...
```

### ソースコード構造

```text
src/
└── services/
    ├── environment-service.ts      # 新規
    ├── environment-adapter.ts      # 新規（インターフェース）
    ├── adapter-factory.ts          # 新規
    ├── adapters/
    │   ├── host-adapter.ts         # 新規
    │   └── docker-adapter.ts       # 新規
    ├── claude-pty-manager.ts       # 既存（変更なし）
    ├── docker-pty-adapter.ts       # 既存（非推奨、互換性維持）
    └── docker-service.ts           # 既存（変更なし）
```

## UI設計

### レイアウト構造

環境管理画面は既存のアプリケーションと同じレイアウト構造を使用する。

```text
┌─────────────────────────────────────────────────────────────────────┐
│ ClaudeWork                              [設定] [通知] [テーマ]      │  ← Header
├──────────────┬──────────────────────────────────────────────────────┤
│ プロジェクト │                                                      │
│ ├ project-1  │  メインコンテンツエリア                              │
│ └ project-2  │  （環境管理画面など）                                │
│              │                                                      │
│   Sidebar    │                                                      │
└──────────────┴──────────────────────────────────────────────────────┘
```

**実装方針**:
- `/settings/layout.tsx` を作成し、`MainLayout` を適用
- これにより `/settings/` 以下の全ページでヘッダー・サイドバーが表示される
- 既存の `/projects/[id]/layout.tsx` と同じパターンを使用

### 環境管理画面

**パス**: `/settings/environments`

```text
┌─────────────────────────────────────────────────────────────┐
│ 実行環境                                          [+ 追加] │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [HOST] Local Host                    [デフォルト]       │ │
│ │ ローカル環境で直接実行                                  │ │
│ │ 状態: 利用可能 / 認証済み                              │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [DOCKER] Docker Dev                        [編集] [削除]│ │
│ │ 開発用Docker環境                                        │ │
│ │ イメージ: claude-code-sandboxed:latest                  │ │
│ │ 状態: 利用可能 / 未認証 [認証する]                      │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [DOCKER] Custom Build Env                  [編集] [削除]│ │
│ │ カスタムビルド環境                                      │ │
│ │ Dockerfile: /home/user/project/Dockerfile               │ │
│ │ 状態: 利用可能 / 認証済み                               │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 環境追加ダイアログ（Docker選択時）

```text
┌─────────────────────────────────────────────────────────────┐
│ 実行環境を追加                                      [×]   │
├─────────────────────────────────────────────────────────────┤
│ 環境タイプ:                                                 │
│   ○ ホスト                                                 │
│   ● Docker コンテナ                                        │
│   ○ SSH リモート（準備中）                                 │
│                                                             │
│ 名前:                                                       │
│ [Docker Production                              ]           │
│                                                             │
│ 説明:                                                       │
│ [本番用Docker環境                               ]           │
│                                                             │
│ ─────────────── イメージソース ───────────────              │
│                                                             │
│   ● 既存イメージを使用                                     │
│   ○ Dockerfileからビルド                                   │
│                                                             │
│ 【既存イメージを使用 選択時】                              │
│   イメージ:                                                 │
│   [▼ claude-code-sandboxed:latest              ]           │
│     ├── claude-code-sandboxed:latest                       │
│     ├── ubuntu:22.04                                        │
│     ├── node:20-slim                                        │
│     └── [カスタムイメージを入力...]                        │
│                                                             │
│ 【Dockerfileからビルド 選択時】                            │
│   Dockerfile:                                               │
│   [ファイルを選択] または ドラッグ&ドロップ                 │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ Dockerfile (2.5KB) ✓ アップロード済み       [削除]  │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
│                                    [キャンセル] [作成]     │
└─────────────────────────────────────────────────────────────┘
```

### セッション作成フォーム変更

```text
┌─────────────────────────────────────────────────────────────┐
│ 新規セッション                                              │
├─────────────────────────────────────────────────────────────┤
│ セッション名:                                               │
│ [feature-auth                                   ]           │
│                                                             │
│ 実行環境:                                                   │
│ [▼ Local Host (デフォルト)                      ]           │
│   ├── Local Host (デフォルト)                              │
│   ├── Docker Dev                                            │
│   └── Docker Production                                     │
│                                                             │
│ 初期プロンプト:                                             │
│ [認証機能を実装してください                     ]           │
│                                                             │
│                                    [キャンセル] [作成]     │
└─────────────────────────────────────────────────────────────┘
```

## マイグレーション計画

### Phase 1: スキーマ追加（破壊的変更なし）

1. `ExecutionEnvironment`モデルを追加
2. `Session`に`environment_id`フィールドを追加（nullable）
3. デフォルトHOST環境を作成

### Phase 2: 既存データのマイグレーション

1. `docker_mode=true`のセッション用にDocker環境を作成
2. 該当セッションの`environment_id`を設定

### Phase 3: 非推奨フィールドの処理

1. `docker_mode`と`container_id`は残すが、新規作成では使用しない
2. ドキュメントで非推奨を明記

### マイグレーションスクリプト

```typescript
// prisma/migrations/seed-environments.ts
async function migrateToEnvironments() {
  // 1. デフォルトHOST環境を作成
  const hostEnv = await prisma.executionEnvironment.create({
    data: {
      id: 'host-default',
      name: 'Local Host',
      type: 'HOST',
      description: 'ローカル環境で直接実行',
      config: '{}',
      is_default: true,
    },
  });

  // 2. docker_mode=trueのセッションがあればDocker環境を作成
  const dockerSessions = await prisma.session.findMany({
    where: { docker_mode: true },
  });

  if (dockerSessions.length > 0) {
    const dockerEnv = await prisma.executionEnvironment.create({
      data: {
        id: 'docker-legacy',
        name: 'Docker (Legacy)',
        type: 'DOCKER',
        description: '既存のDockerセッション用環境',
        config: JSON.stringify({
          imageName: 'claude-code-sandboxed',
          imageTag: 'latest',
        }),
        auth_dir_path: 'data/environments/docker-legacy',
      },
    });

    // 3. 該当セッションを更新
    await prisma.session.updateMany({
      where: { docker_mode: true },
      data: { environment_id: dockerEnv.id },
    });
  }
}
```

## 技術的決定事項

### 決定1: 環境ごとの認証情報分離方式

**検討した選択肢**:
- A) ホストの認証情報を共有（現状）
- B) Named Volumeで環境ごとに分離
- C) Bindマウントで環境ごとに分離

**決定**: C) Bindマウント（`data/environments/<id>/`）

**根拠**:
- 認証情報のバックアップが容易
- 環境削除時のクリーンアップが明確
- ホスト側からの確認・デバッグが可能

### 決定2: アダプターのライフサイクル

**検討した選択肢**:
- A) セッションごとにアダプターを作成
- B) 環境ごとにアダプターをシングルトン化
- C) グローバルシングルトン

**決定**: B) 環境ごとにシングルトン

**根拠**:
- 同一環境の複数セッションでリソースを効率的に共有
- 環境削除時のクリーンアップが明確
- メモリ効率が良い

### 決定3: SSH環境の設計準備

**決定**: インターフェースのみ定義し、実装は将来に延期

**根拠**:
- 現時点では要件が不明確
- EnvironmentAdapterインターフェースがあれば拡張可能
- 過剰設計を避ける

## 既存機能との互換性

### アダプター選択フロー

既存の`docker_mode`フラグと新しい`environment_id`の両方をサポートするため、以下の優先順位でアダプターを選択する。

```typescript
// ClaudeWebSocketHandler内での判断フロー
async function selectAdapter(session: Session): Promise<EnvironmentAdapter> {
  // 優先順位1: environment_idが指定されている場合
  if (session.environment_id) {
    const env = await environmentService.findById(session.environment_id);
    if (env) {
      return AdapterFactory.getAdapter(env);
    }
    // 環境が削除された場合はデフォルトにフォールバック
    logger.warn('Environment not found, falling back to default', {
      sessionId: session.id,
      environmentId: session.environment_id,
    });
  }

  // 優先順位2: docker_mode=true かつ environment_id未設定（レガシー）
  if (session.docker_mode && !session.environment_id) {
    // 既存のclaudePtyManager経由でDockerPTYAdapterを使用
    // これによりホスト認証情報を共有する従来の動作を維持
    return {
      type: 'legacy-docker',
      manager: claudePtyManager,
      options: { dockerMode: true },
    };
  }

  // 優先順位3: デフォルトHOST環境
  const defaultEnv = await environmentService.getDefault();
  return AdapterFactory.getAdapter(defaultEnv);
}
```

### セッション作成APIパラメータ優先順位

```typescript
// POST /api/projects/:project_id/sessions
const { name, prompt, environment_id, dockerMode = false } = body;

// 優先順位:
// 1. environment_id が指定されていればそれを使用
// 2. dockerMode=true かつ environment_id未指定 → レガシーDocker（警告ログ出力）
// 3. 両方未指定 → デフォルトHOST環境

let effectiveEnvironmentId: string | null = null;

if (environment_id) {
  // 新方式: environment_idを使用
  effectiveEnvironmentId = environment_id;
} else if (dockerMode) {
  // レガシー方式: 警告を出力しつつ従来動作を維持
  logger.warn('dockerMode parameter is deprecated, use environment_id instead', {
    projectId: project_id,
  });
  // environment_idはnullのまま、session.docker_mode=trueで保存
  // WebSocket接続時に既存DockerPTYAdapterが使用される
}
```

### HostAdapterとClaudePTYManagerの関係

既存の`ClaudePTYManager`は内部で`DockerPTYAdapter`を保持し、`dockerMode`フラグで切り替える設計になっている。

```typescript
// 既存のClaudePTYManager構造
class ClaudePTYManager {
  private dockerAdapter: DockerPTYAdapter;  // 内部保持

  createSession(..., options) {
    if (options?.dockerMode) {
      this.dockerAdapter.createSession(...);  // 委譲
    } else {
      // ホスト実行のPTYロジック
    }
  }
}
```

`HostAdapter`は`ClaudePTYManager`を`dockerMode: false`固定でラップする。これにより：
- ClaudePTYManager内部のdockerAdapter処理は使用されない
- 既存のdocker_modeを使うレガシーコードは引き続き動作
- 将来的にClaudePTYManagerからDocker処理を分離可能

```typescript
// HostAdapterの実装
class HostAdapter implements EnvironmentAdapter {
  private ptyManager: ClaudePTYManager;

  createSession(..., options) {
    // dockerModeは常にfalse
    this.ptyManager.createSession(..., {
      resumeSessionId: options?.resumeSessionId,
      dockerMode: false,  // 固定
    });
  }
}
```

### 新旧DockerAdapterの違い

| 項目 | 既存DockerPTYAdapter | 新DockerAdapter |
|------|---------------------|-----------------|
| 認証情報 | ホスト`~/.claude`を共有 | 環境専用ディレクトリ |
| インスタンス | グローバルシングルトン | 環境IDごとにシングルトン |
| 使用条件 | `docker_mode=true` | `environment_id`指定 |
| 用途 | レガシー互換 | 新規Docker環境 |

### container_idフィールドの更新タイミング

`Session.container_id`はアクティブなコンテナIDを記録する（デバッグ・管理用）。

```typescript
// DockerAdapter内での更新
class DockerAdapter {
  async createSession(sessionId, workingDir, ...) {
    const containerName = `claude-env-${this.config.environmentId}-${Date.now()}`;
    // ... コンテナ起動 ...

    // container_idを更新
    await prisma.session.update({
      where: { id: sessionId },
      data: { container_id: containerName },
    });
  }

  async destroySession(sessionId) {
    // ... コンテナ停止 ...

    // container_idをクリア
    await prisma.session.update({
      where: { id: sessionId },
      data: { container_id: null },
    });
  }
}
```

### APIステータス取得のパフォーマンス対策

環境一覧取得時に毎回Dockerデーモンチェックを行うとレイテンシが増大するため、ステータスはオプショナルとする。

```typescript
// GET /api/environments?includeStatus=true
//   → ステータス付きで返却（Docker状態チェックを実行）
// GET /api/environments
//   → ステータスなしで返却（高速）

// 個別環境のステータス取得
// GET /api/environments/:id/status
//   → 単一環境のステータスを取得
```

UIでは：
1. 環境一覧は`includeStatus=false`で高速取得
2. 各環境カードで非同期にステータスを取得（`/api/environments/:id/status`）
3. ステータスはローカルキャッシュ（30秒TTL）

## テスト戦略

### ユニットテスト

- EnvironmentService: CRUD操作、状態チェック
- AdapterFactory: 環境タイプに応じたアダプター生成
- DockerAdapter: 認証ディレクトリの正しいマウント
- アダプター選択フロー: 優先順位の正確性

### 統合テスト

- Docker環境の作成→セッション起動→認証→終了の一連のフロー
- 複数環境での並行セッション実行
- レガシーdocker_mode=trueセッションの動作確認

### E2Eテスト

- 環境管理画面のUI操作
- セッション作成時の環境選択
- 環境の状態表示（利用可能/認証済み）

## Phase 9: サイドメニューセッション作成改善

### 変更概要

1. プロジェクト詳細ページ（`/projects/[id]`）を削除
2. サイドメニューの「新規セッション」クリック時に環境選択モーダルを表示
3. プロジェクト名クリック時はツリー展開/折りたたみのみ（ページ遷移なし）

### 削除対象

- `src/app/projects/[id]/page.tsx`（プロジェクト詳細ページ）
- プロジェクト詳細ページへのリンク

### 新規コンポーネント

#### CreateSessionModal

**ファイル**: `src/components/sessions/CreateSessionModal.tsx`

**目的**: サイドメニューからセッション作成時に表示する環境選択モーダル

```typescript
interface CreateSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onSuccess: (sessionId: string) => void;
}
```

**UI設計**:
```text
┌─────────────────────────────────────────────────────────────┐
│ 新規セッション                                        [×]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 実行環境を選択してください                                  │
│                                                             │
│   ● Local Host (デフォルト)                                │
│   ○ Docker Dev                                              │
│   ○ Docker Production                                       │
│   ○ Custom Build Env                                        │
│                                                             │
│                                    [キャンセル] [作成]     │
└─────────────────────────────────────────────────────────────┘
```

**機能**:
- 環境一覧を取得してラジオボタンで表示
- デフォルト環境を初期選択
- 作成ボタンでセッション作成APIを呼び出し
- 作成成功時はonSuccessコールバックでセッションIDを渡す

### Sidebar変更

**ファイル**: `src/components/layout/Sidebar.tsx`

**変更内容**:
1. `handleAddSession`を変更: 直接API呼び出し → モーダル表示
2. 環境選択モーダルの状態管理を追加
3. プロジェクトクリック時のページ遷移を削除

```typescript
// 変更前
const handleAddSession = async (projectId: string) => {
  const response = await fetch(`/api/projects/${projectId}/sessions`, {
    method: 'POST',
    body: JSON.stringify({ prompt: '' }),
  });
  // ...
};

// 変更後
const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
const [targetProjectId, setTargetProjectId] = useState<string | null>(null);

const handleAddSession = (projectId: string) => {
  setTargetProjectId(projectId);
  setIsCreateModalOpen(true);
};

const handleSessionCreated = (sessionId: string) => {
  setIsCreateModalOpen(false);
  router.push(`/sessions/${sessionId}`);
};
```

### ProjectTreeItem変更

**ファイル**: `src/components/layout/ProjectTreeItem.tsx`

**変更内容**:
- プロジェクト名クリック時のページ遷移を削除
- プロジェクト名クリックで展開/折りたたみのみ実行

### ルーティング変更

| 現在のパス | 変更後 |
|-----------|--------|
| `/projects/[id]` | 削除 |
| プロジェクトクリック | ツリー展開のみ（遷移なし） |
| 新規セッションクリック | モーダル表示 |
