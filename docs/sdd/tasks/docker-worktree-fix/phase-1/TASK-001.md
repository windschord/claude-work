# TASK-001: DockerAdapterのPTY起動実装

## 説明

Docker環境セッションでPTYプロセスをDockerコンテナ内で起動できるようにする。

## 対象ファイル

- `src/services/adapters/docker-adapter.ts`
- `src/services/pty-session-manager.ts`

## 技術的文脈

- EnvironmentAdapterインターフェースを実装
- `docker run -dit` でコンテナを起動
- working directoryを `/repo/.worktrees/${sessionName}` に設定
- PTY入出力をWebSocket経由で転送

## 実装手順

### 1. DockerAdapterクラスの作成

**ファイル**: `src/services/adapters/docker-adapter.ts`

```typescript
import { EnvironmentAdapter, PTYSpawnOptions, PTYProcess } from '../environment-adapter';
import { spawn } from 'child_process';
import { logger } from '@/lib/logger';

export class DockerAdapter implements EnvironmentAdapter {
  async spawnPTY(options: PTYSpawnOptions): Promise<PTYProcess> {
    const { sessionId, worktreePath } = options;

    // Dockerコンテナ名
    const containerName = `claude-session-${sessionId}`;

    // ボリューム名を取得（sessionIdからprojectIdを解決）
    const volumeName = await this.getVolumeName(sessionId);

    // Dockerコマンド構築
    const dockerArgs = [
      'run',
      '-dit',
      '--name', containerName,
      '-v', `${volumeName}:/repo`,
      '-w', worktreePath,  // /repo/.worktrees/session-XXX
      'alpine/git',
      '/bin/sh'
    ];

    // コンテナ起動
    const proc = spawn('docker', dockerArgs);

    // PTYプロセスオブジェクト作成
    return {
      pid: proc.pid!,
      write: (data: string) => proc.stdin.write(data),
      resize: (cols: number, rows: number) => this.resizePTY(containerName, cols, rows),
      kill: () => this.killPTY(containerName),
      onData: (callback) => proc.stdout.on('data', callback),
      onExit: (callback) => proc.on('exit', callback),
    };
  }

  async killPTY(containerName: string): Promise<void> {
    await execDockerCommand(['stop', containerName]);
    await execDockerCommand(['rm', containerName]);
  }

  async resizePTY(containerName: string, cols: number, rows: number): Promise<void> {
    // Docker exec で stty を使ってターミナルサイズを変更
    await execDockerCommand([
      'exec', containerName,
      'stty', 'cols', cols.toString(), 'rows', rows.toString()
    ]);
  }

  private async getVolumeName(sessionId: string): Promise<string> {
    // セッションからprojectIdを取得してボリューム名を返す
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
    });
    return `claude-repo-${session.project_id}`;
  }
}
```

### 2. AdapterFactoryの更新

**ファイル**: `src/services/adapter-factory.ts`

DockerAdapterをインポートし、環境タイプに応じて返すように修正。

```typescript
import { DockerAdapter } from './adapters/docker-adapter';

export class AdapterFactory {
  static getAdapter(environmentType: string): EnvironmentAdapter {
    switch (environmentType) {
      case 'HOST':
        return new HostAdapter();
      case 'DOCKER':
        return new DockerAdapter();  // 追加
      default:
        throw new Error(`Unknown environment type: ${environmentType}`);
    }
  }
}
```

### 3. テスト作成

**ファイル**: `src/services/adapters/__tests__/docker-adapter.test.ts`

```typescript
describe('DockerAdapter', () => {
  it('should spawn PTY in Docker container', async () => {
    const adapter = new DockerAdapter();
    const pty = await adapter.spawnPTY({
      sessionId: 'test-session',
      worktreePath: '/repo/.worktrees/test-session',
      environmentId: 'docker-env',
    });

    expect(pty.pid).toBeDefined();
  });
});
```

## 受入基準

- [ ] DockerAdapterクラスが作成されている
- [ ] spawnPTYメソッドがDockerコンテナを起動する
- [ ] working directoryが正しく設定される
- [ ] PTY入出力が正常に動作する
- [ ] AdapterFactoryがDockerAdapterを返す
- [ ] ユニットテストがパスする

## 依存関係

なし

## 推定工数

40分

## ステータス

`DONE`

**完了サマリー**: DockerAdapterは既にsrc/services/adapters/docker-adapter.ts（1,372行）に完全実装済み。EnvironmentAdapterインターフェースを実装し、spawnPTY、createSession、write、resize、destroySession等のメソッドが動作。AdapterFactoryもDOCKER環境タイプに対応済み。
