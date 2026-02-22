# TASK-012: セッション起動時のDockerボリュームマウント処理

## ステータス: DONE

## 概要

`clone_location='docker'`のプロジェクトでセッション起動時、worktreePathがDockerボリューム内パスになる。
`DockerAdapter.buildDockerArgs()`がこれをホストパスとしてマウントしようとするため、ホスト上にパスが存在せず失敗する問題を修正する。

## 修正内容

### 1. CreateSessionOptions (environment-adapter.ts)
- `dockerVolumeId?: string`フィールドを追加

### 2. SessionOptions (pty-session-manager.ts)
- `dockerVolumeId?: string`フィールドを追加
- `createSession()`内でadapter.createSession()呼び出し時にdockerVolumeIdを透過

### 3. buildDockerArgs() (docker-adapter.ts)
- `dockerVolumeId`が指定された場合:
  - `-v <dockerVolumeId>:/repo` でDockerボリュームをマウント
  - `-w <workingDir>` でworktreePathをコンテナ内CWDに設定
- 未指定の場合: 従来通り `-v <workingDir>:/workspace`

### 4. claude-ws.ts
- セッション取得クエリでprojectの`clone_location`と`docker_volume_id`を含める
- `clone_location === 'docker'`の場合、`docker_volume_id`（またはフォールバック値`claude-repo-<projectId>`）をdockerVolumeIdとして渡す

## テスト

- `docker-adapter.test.ts`: buildDockerArgsのdockerVolumeIdサポートテスト（4件）
- `pty-session-manager.test.ts`: dockerVolumeId透過テスト（1件）

## 依存タスク

- TASK-011: Docker環境でのworktree作成実装
