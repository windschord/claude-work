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
  imageName: string;      // デフォルト: 'claude-code-sandboxed'
  imageTag: string;       // デフォルト: 'latest'
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
└─────────────────────────────────────────────────────────────┘
```

### 環境追加ダイアログ

```text
┌─────────────────────────────────────────────────────────────┐
│ 実行環境を追加                                      [×]   │
├─────────────────────────────────────────────────────────────┤
│ 環境タイプ:                                                 │
│   ○ Docker コンテナ                                        │
│   ○ SSH リモート（準備中）                                 │
│                                                             │
│ 名前:                                                       │
│ [Docker Production                              ]           │
│                                                             │
│ 説明:                                                       │
│ [本番用Docker環境                               ]           │
│                                                             │
│ Docker設定:                                                 │
│   イメージ名: [claude-code-sandboxed            ]           │
│   タグ:       [latest                           ]           │
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

## テスト戦略

### ユニットテスト

- EnvironmentService: CRUD操作、状態チェック
- AdapterFactory: 環境タイプに応じたアダプター生成
- DockerAdapter: 認証ディレクトリの正しいマウント

### 統合テスト

- Docker環境の作成→セッション起動→認証→終了の一連のフロー
- 複数環境での並行セッション実行

### E2Eテスト

- 環境管理画面のUI操作
- セッション作成時の環境選択
- 環境の状態表示（利用可能/認証済み）
