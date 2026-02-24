# 設計書: Docker CLI から Dockerode ライブラリへの移行

## アーキテクチャ概要

### 現行アーキテクチャ

```text
ClaudeWork Server
  ├── DockerAdapter          ─── child_process.execFile('docker', ...) ──→ Docker CLI ──→ Docker Daemon
  ├── DockerPTYAdapter       ─── pty.spawn('docker', ...)              ──→ Docker CLI ──→ Docker Daemon
  ├── DockerService          ─── child_process.exec('docker ...')      ──→ Docker CLI ──→ Docker Daemon
  ├── DockerGitService       ─── child_process.execFile('docker', ...) ──→ Docker CLI ──→ Docker Daemon
  ├── EnvironmentService     ─── child_process.spawn('docker', ...)    ──→ Docker CLI ──→ Docker Daemon
  └── API Routes             ─── child_process.spawn('docker', ...)    ──→ Docker CLI ──→ Docker Daemon
```

### 移行後アーキテクチャ

```text
ClaudeWork Server
  ├── DockerClient (singleton) ─── Dockerode ──→ /var/run/docker.sock ──→ Docker Daemon
  │
  ├── DockerAdapter          ─── DockerClient
  ├── DockerPTYAdapter       ─── DockerClient (attach + Tty)
  ├── DockerService          ─── DockerClient
  ├── DockerGitService       ─── DockerClient
  ├── EnvironmentService     ─── DockerClient
  └── API Routes             ─── DockerClient
```

## コンポーネント設計

### 1. DockerClient（新規）

Dockerode インスタンスをシングルトンで管理するラッパー。

**ファイル**: `src/services/docker-client.ts`

```typescript
import Docker from 'dockerode';

export class DockerClient {
  private static instance: DockerClient | undefined;
  private docker: Docker;

  private constructor() {
    this.docker = new Docker({ socketPath: '/var/run/docker.sock' });
  }

  public static getInstance(): DockerClient {
    if (!DockerClient.instance) {
      DockerClient.instance = new DockerClient();
    }
    return DockerClient.instance;
  }

  // テスト用
  public static resetForTesting(): void {
    DockerClient.instance = undefined;
  }

  public getDockerInstance(): Docker {
    return this.docker;
  }
}
```

### 2. DockerAdapter 移行設計

#### 非PTY操作の移行

| 現行メソッド | 現行実装 | Dockerode 実装 |
|-------------|---------|---------------|
| コンテナ状態確認 | `execFile('docker', ['inspect', '--format', ...])` | `container.inspect()` → `state.Running` |
| コンテナ停止 | `execFile('docker', ['stop', '-t', '10', name])` | `container.stop({ t: 10 })` |
| コンテナ強制停止 | `execFile('docker', ['kill', name])` | `container.kill()` |
| コンテナ待機 | `execFile('docker', ['wait', name])` | `container.wait()` |
| ファイルコピー | `execFile('docker', ['cp', src, dst])` | `container.putArchive(tarStream, { path })` |
| コマンド実行 | `execFile('docker', ['exec', ...])` | `container.exec({ Cmd })` → `exec.start()` |

#### PTY操作の移行（docker run -it）

現行の `pty.spawn('docker', ['run', '-it', ...])` を以下に置き換える:

```typescript
// 1. コンテナ作成
const container = await docker.createContainer({
  Image: `${imageName}:${imageTag}`,
  Cmd: claudeArgs,
  Tty: true,
  OpenStdin: true,
  AttachStdin: true,
  AttachStdout: true,
  AttachStderr: true,
  HostConfig: {
    AutoRemove: true,
    Binds: [...volumeMounts],
    CapDrop: ['ALL'],
    SecurityOpt: ['no-new-privileges'],
    PortBindings: portBindings,
  },
  Env: envVars,
  WorkingDir: '/workspace',
});

// 2. ストリーム接続
const stream = await container.attach({
  stream: true,
  stdin: true,
  stdout: true,
  stderr: true,
  hijack: true,
});

// 3. コンテナ起動
await container.start();

// 4. WebSocket ↔ Docker ストリーム接続
// 入力: WebSocket → stream.write()
// 出力: stream.on('data') → WebSocket

// 5. リサイズ
await container.resize({ h: rows, w: cols });
```

#### PTY操作の移行（docker exec -it）

```typescript
const exec = await container.exec({
  Cmd: ['bash'],
  Tty: true,
  AttachStdin: true,
  AttachStdout: true,
  AttachStderr: true,
  WorkingDir: execCwd,
});

const stream = await exec.start({ hijack: true, stdin: true, Tty: true });

// リサイズ
await exec.resize({ h: rows, w: cols });
```

### 3. PTYストリームアダプタ（新規）

node-pty の `IPty` インタフェースと Dockerode ストリームの橋渡しをするアダプタ。

**ファイル**: `src/services/docker-pty-stream.ts`

```typescript
import { EventEmitter } from 'events';
import Docker from 'dockerode';

export interface IDockerPTY {
  // node-pty IPty 互換インタフェース
  onData: (callback: (data: string) => void) => void;
  onExit: (callback: (exitCode: { exitCode: number }) => void) => void;
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: (signal?: string) => void;
  pid: number;
  cols: number;
  rows: number;
}

export class DockerPTYStream extends EventEmitter implements IDockerPTY {
  private stream: NodeJS.ReadWriteStream;
  private container: Docker.Container;
  // ...
}
```

### 4. DockerService 移行設計

| 現行メソッド | Dockerode 実装 |
|-------------|---------------|
| `isDockerAvailable()` | `docker.ping()` |
| `isDockerRunning()` | `docker.info()` |
| `hasDockerPermission()` | `docker.listContainers()` |
| `imageExists()` | `docker.getImage(name).inspect()` (catch 404) |
| `buildImage()` | `docker.buildImage(tarStream, { t: tag })` + ストリーム解析 |

### 5. DockerGitService 移行設計

| 現行メソッド | Dockerode 実装 |
|-------------|---------------|
| `createVolume()` | `docker.createVolume({ Name })` |
| `removeVolume()` | `docker.getVolume(name).remove()` |
| Git操作（clone等） | `DockerClient.run()` (Dockerode の high-level API `docker.run()`) |

Git操作の一時コンテナ実行パターン:

```typescript
const stdoutStream = new Writable({ write(chunk, encoding, callback) { stdout += chunk.toString(); callback(); } });
const stderrStream = new Writable({ write(chunk, encoding, callback) { stderr += chunk.toString(); callback(); } });

const data = await DockerClient.getInstance().run(
  'alpine/git',
  ['clone', url, '/repo'],
  [stdoutStream, stderrStream],
  {
    HostConfig: {
      Binds: [`${volumeName}:/repo`],
      AutoRemove: true,
    },
  }
);
// data.StatusCode === 0 で成功判定
```

### 6. API Routes 移行設計

#### docker/images/route.ts

```typescript
// 現行: execAsync('docker images --format "{{json .}}"')
const images = await docker.listImages();
// images.map() で必要な情報を抽出
```

#### docker/image-build/route.ts

```typescript
// 現行: spawn('docker', ['build', '-t', tag, '-f', file, '.'])
const stream = await docker.buildImage(
  { context: buildDir, src: [dockerfileName] },
  { t: fullImageName }
);

// ストリーム解析（JSON行形式）
docker.modem.followProgress(stream, onFinished, onProgress);
```

## エラーハンドリング設計

### Dockerode エラー構造

```typescript
interface DockerodeError {
  statusCode: number;  // HTTP status code (404, 409, 500, etc.)
  json: {
    message: string;
  };
}
```

### エラーマッピング

| Docker CLI エラー | Dockerode エラー | アプリケーション対応 |
|------------------|-----------------|-------------------|
| exit code 非0 + stderr | statusCode + json.message | DockerError に変換 |
| `No such container` | statusCode 404 | ContainerNotFoundError |
| `Container already running` | statusCode 409 (Conflict) | ContainerAlreadyRunningError |
| `No such image` | statusCode 404 | ImageNotFoundError |
| `ECONNREFUSED` (daemon停止) | ECONNREFUSED | DockerDaemonNotRunningError |

### 共通エラーハンドラ

```typescript
// src/services/docker-error-handler.ts
export function handleDockerodeError(error: unknown, context: string): never {
  if (error && typeof error === 'object' && 'statusCode' in error) {
    const dockerError = error as DockerodeError;
    switch (dockerError.statusCode) {
      case 404: throw new DockerNotFoundError(context, dockerError.json?.message);
      case 409: throw new DockerConflictError(context, dockerError.json?.message);
      default: throw new DockerError(context, dockerError.json?.message);
    }
  }
  throw new DockerError(context, String(error));
}
```

## 移行フェーズ

### フェーズ1: 基盤 + 非PTY操作（低リスク）

1. Dockerode 依存追加、DockerClient シングルトン作成
2. EnvironmentService の docker info / image inspect 移行
3. DockerService の状態確認系メソッド移行
4. DockerAdapter の inspect / stop / kill / wait / cp / exec（非PTY）移行
5. DockerGitService の volume create / rm / run 移行
6. pty-session-manager.ts の inspect / rm 移行

### フェーズ2: ビルド操作（中リスク）

1. DockerService の buildImage 移行
2. docker/images/route.ts のイメージ一覧移行
3. docker/image-build/route.ts のビルド移行
4. environments/route.ts のビルド移行

### フェーズ3: PTY操作（高リスク）

1. DockerPTYStream アダプタ実装
2. DockerAdapter の docker run -it 移行
3. DockerAdapter の docker exec -it 移行
4. DockerPTYAdapter の docker run -it 移行
5. XTerm.js との統合テスト

### フェーズ4: クリーンアップ

1. Docker CLI 関連のユーティリティ削除
2. Dockerfile から Docker CLI インストール削除
3. テスト全体の整合性確認

## 技術的決定事項

| 決定事項 | 選択 | 根拠 |
|---------|------|------|
| Docker ライブラリ | Dockerode | Node.js での事実上の標準。活発にメンテナンスされている |
| DockerClient管理 | シングルトン | 接続プール不要（UNIXソケット）。テスト時にモック差し替え可能 |
| PTY互換レイヤー | DockerPTYStream | node-pty IPty 互換インタフェースで既存コードへの影響を最小化 |
| エラーハンドリング | 集約ハンドラ | Dockerode のエラー構造を既存の DockerError 体系にマッピング |
| フォールバック | PTYのみpty.spawn維持可 | フェーズ3で問題が発生した場合、PTY部分のみ現行方式を維持する選択肢を残す |
