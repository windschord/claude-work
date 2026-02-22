# タスク管理: Docker CLI から Dockerode ライブラリへの移行

## タスク概要

| フェーズ | タスク数 | リスク |
|---------|---------|-------|
| フェーズ1: 基盤 + 非PTY操作 | 7 | 低 |
| フェーズ2: ビルド操作 | 4 | 中 |
| フェーズ3: PTY操作 | 5 | 高 |
| フェーズ4: クリーンアップ | 3 | 低 |

## フェーズ1: 基盤 + 非PTY操作

### TASK-001: Dockerode 依存追加と DockerClient 作成

- **ステータス**: 未着手
- **対象ファイル**:
  - `package.json`: dockerode, @types/dockerode 追加
  - `src/services/docker-client.ts`: 新規作成
  - `src/services/__tests__/docker-client.test.ts`: 新規作成
- **受入基準**:
  - [ ] `dockerode` と `@types/dockerode` が devDependencies/dependencies に追加されている
  - [ ] DockerClient シングルトンが `/var/run/docker.sock` に接続する
  - [ ] テスト用の `resetDockerClient()` / `setDockerClient()` が動作する
  - [ ] テストが通過する
- **TDD手順**:
  1. docker-client.test.ts を作成し、シングルトン動作とリセットをテスト
  2. テスト失敗を確認
  3. docker-client.ts を実装
  4. テスト通過を確認

### TASK-002: EnvironmentService の Dockerode 移行

- **ステータス**: 未着手
- **依存**: TASK-001
- **対象ファイル**:
  - `src/services/environment-service.ts`: `spawnAsync('docker', ['info'])` → `docker.info()` 等
  - 関連テストファイル
- **受入基準**:
  - [ ] `docker info` 呼び出しが `docker.info()` に置き換わっている
  - [ ] `docker image inspect` 呼び出しが `docker.getImage().inspect()` に置き換わっている
  - [ ] 既存テストが Dockerode モックで通過する
- **TDD手順**:
  1. テストを Dockerode モック形式に更新
  2. テスト失敗を確認
  3. environment-service.ts を修正
  4. テスト通過を確認

### TASK-003: DockerService の状態確認メソッド Dockerode 移行

- **ステータス**: 未着手
- **依存**: TASK-001
- **対象ファイル**:
  - `src/services/docker-service.ts`: isDockerAvailable, isDockerRunning, hasDockerPermission, imageExists
  - `src/services/__tests__/docker-service.test.ts`
- **受入基準**:
  - [ ] `exec('docker info')` が `docker.ping()` / `docker.info()` に置き換わっている
  - [ ] `exec('which docker')` が不要になっている（Dockerodeが接続できれば十分）
  - [ ] `execFile('docker', ['images', '-q', ...])` が `docker.getImage().inspect()` に置き換わっている
  - [ ] 既存テストがDockerodeモックで通過する

### TASK-004: DockerAdapter 非PTY操作の Dockerode 移行

- **ステータス**: 未着手
- **依存**: TASK-001
- **対象ファイル**:
  - `src/services/adapters/docker-adapter.ts`: inspect, stop, kill, wait, cp, exec(非PTY)
  - `src/services/adapters/__tests__/docker-adapter.test.ts`
- **受入基準**:
  - [ ] `docker inspect` → `container.inspect()` に置き換わっている
  - [ ] `docker stop` → `container.stop()` に置き換わっている
  - [ ] `docker kill` → `container.kill()` に置き換わっている
  - [ ] `docker wait` → `container.wait()` に置き換わっている
  - [ ] `docker cp` → `container.putArchive()` に置き換わっている
  - [ ] `docker exec`(Git設定、非PTY) → `container.exec()` + `exec.start()` に置き換わっている
  - [ ] 既存テストがDockerodeモックで通過する
  - [ ] エラーハンドリングが DockerError 体系にマッピングされている

### TASK-005: DockerGitService の Dockerode 移行

- **ステータス**: 未着手
- **依存**: TASK-001
- **対象ファイル**:
  - `src/services/docker-git-service.ts`: volume create/rm, docker run
  - `src/services/__tests__/docker-git-service.test.ts`
  - `src/services/__tests__/docker-git-service-retry.test.ts`
- **受入基準**:
  - [ ] `docker volume create` → `docker.createVolume()` に置き換わっている
  - [ ] `docker volume rm` → `volume.remove()` に置き換わっている
  - [ ] Git操作用 `docker run` → `container.create()` + `start()` + `wait()` に置き換わっている
  - [ ] リトライロジックが Dockerode エラー形式で正常動作する
  - [ ] 既存テストがDockerodeモックで通過する

### TASK-006: pty-session-manager の Dockerode 移行

- **ステータス**: 未着手
- **依存**: TASK-001
- **対象ファイル**:
  - `src/services/pty-session-manager.ts`: docker inspect, docker rm
- **受入基準**:
  - [ ] `execAsync('docker inspect ...')` → `container.inspect()` に置き換わっている
  - [ ] `execAsync('docker rm -f ...')` → `container.remove({ force: true })` に置き換わっている

### TASK-007: エラーハンドリング共通モジュール作成

- **ステータス**: 未着手
- **依存**: TASK-001
- **対象ファイル**:
  - `src/services/docker-error-handler.ts`: 新規作成
  - `src/services/__tests__/docker-error-handler.test.ts`: 新規作成
- **受入基準**:
  - [ ] Dockerode エラー（statusCode, json.message）を既存 DockerError 体系にマッピングする関数が存在する
  - [ ] 404, 409, 500, ECONNREFUSED 等の主要エラーパターンがテストされている

## フェーズ2: ビルド操作

### TASK-008: DockerService の buildImage Dockerode 移行

- **ステータス**: 未着手
- **依存**: TASK-003
- **対象ファイル**:
  - `src/services/docker-service.ts`: buildImage メソッド
  - `src/services/__tests__/docker-service.test.ts`
- **受入基準**:
  - [ ] `spawn('docker', ['build', ...])` → `docker.buildImage()` に置き換わっている
  - [ ] ビルドログが `docker.modem.followProgress()` でストリーム解析されている
  - [ ] 進捗コールバックが既存のイベント形式と互換性がある

### TASK-009: docker/images API の Dockerode 移行

- **ステータス**: 未着手
- **依存**: TASK-001
- **対象ファイル**:
  - `src/app/api/docker/images/route.ts`
- **受入基準**:
  - [ ] `execAsync('docker images --format ...')` → `docker.listImages()` に置き換わっている
  - [ ] レスポンスの JSON 構造が既存と互換性がある

### TASK-010: docker/image-build API の Dockerode 移行

- **ステータス**: 未着手
- **依存**: TASK-008
- **対象ファイル**:
  - `src/app/api/docker/image-build/route.ts`
- **受入基準**:
  - [ ] `spawn('docker', ['build', ...])` → `docker.buildImage()` に置き換わっている
  - [ ] ビルドログのストリーミングが正常に動作する

### TASK-011: environments API のビルド処理 Dockerode 移行

- **ステータス**: 未着手
- **依存**: TASK-008
- **対象ファイル**:
  - `src/app/api/environments/route.ts`
- **受入基準**:
  - [ ] `spawn('docker', ['build', ...])` → `docker.buildImage()` に置き換わっている

## フェーズ3: PTY操作

### TASK-012: DockerPTYStream アダプタ実装

- **ステータス**: 未着手
- **依存**: TASK-001
- **対象ファイル**:
  - `src/services/docker-pty-stream.ts`: 新規作成
  - `src/services/__tests__/docker-pty-stream.test.ts`: 新規作成
- **受入基準**:
  - [ ] node-pty IPty 互換インタフェース（onData, onExit, write, resize, kill）が実装されている
  - [ ] Dockerode のストリームを内部で保持し、入出力を中継する
  - [ ] resize が container.resize() / exec.resize() に委譲される
  - [ ] コンテナ停止時に onExit コールバックが呼ばれる
  - [ ] テストが通過する

### TASK-013: DockerAdapter の docker run -it 移行

- **ステータス**: 未着手
- **依存**: TASK-012, TASK-004
- **対象ファイル**:
  - `src/services/adapters/docker-adapter.ts`: spawnClaudePTY メソッド
  - `src/services/adapters/__tests__/docker-adapter.test.ts`
- **受入基準**:
  - [ ] `pty.spawn('docker', ['run', '-it', ...])` が `container.create()` + `attach()` + `start()` に置き換わっている
  - [ ] DockerPTYStream がWebSocketハンドラに渡される
  - [ ] XTerm.js でカラー出力、ANSI escape codes が正常に表示される
  - [ ] ターミナルリサイズが正常に動作する

### TASK-014: DockerAdapter の docker exec -it 移行

- **ステータス**: 未着手
- **依存**: TASK-012, TASK-004
- **対象ファイル**:
  - `src/services/adapters/docker-adapter.ts`: spawnShellPTY メソッド
- **受入基準**:
  - [ ] `pty.spawn('docker', ['exec', '-it', ...])` が `container.exec({ Tty: true })` + `exec.start()` に置き換わっている
  - [ ] リサイズが exec.resize() で処理される

### TASK-015: DockerPTYAdapter の Dockerode 移行

- **ステータス**: 未着手
- **依存**: TASK-012
- **対象ファイル**:
  - `src/services/docker-pty-adapter.ts`
  - `src/services/__tests__/docker-pty-adapter.test.ts`
- **受入基準**:
  - [ ] `pty.spawn('docker', ['run', '-it', ...])` が Dockerode ベースに置き換わっている
  - [ ] 既存テストが通過する

### TASK-016: PTY統合テスト（XTerm.js互換性検証）

- **ステータス**: 未着手
- **依存**: TASK-013, TASK-014, TASK-015
- **対象ファイル**:
  - インテグレーションテスト
- **受入基準**:
  - [ ] Claude Code PTYセッションが正常に起動・操作できる
  - [ ] シェルPTYセッションが正常に起動・操作できる
  - [ ] ターミナルリサイズが WebSocket 経由で正常に動作する
  - [ ] ANSI カラー出力が XTerm.js で正常にレンダリングされる

## フェーズ4: クリーンアップ

### TASK-017: Docker CLI 関連ユーティリティ削除

- **ステータス**: 未着手
- **依存**: TASK-016
- **対象ファイル**:
  - 各サービスファイルから未使用の child_process import 削除
  - docker CLI パス解決ロジックの削除（不要になった場合）
- **受入基準**:
  - [ ] Docker CLI を直接呼び出すコードがソースコードに残っていない
  - [ ] lint が通過する

### TASK-018: Dockerfile から Docker CLI インストール削除

- **ステータス**: 未着手
- **依存**: TASK-017
- **対象ファイル**:
  - `Dockerfile`: runner ステージから docker-ce-cli 削除（追加されている場合）
- **受入基準**:
  - [ ] Dockerfile に Docker CLI のインストール行がない
  - [ ] Docker イメージビルドが成功する
  - [ ] コンテナ内から Docker 操作が正常に動作する（Dockerode 経由）

### TASK-019: 全テスト回帰確認

- **ステータス**: 未着手
- **依存**: TASK-017, TASK-018
- **対象ファイル**:
  - 全テストファイル
- **受入基準**:
  - [ ] `npm test` が全テスト通過
  - [ ] E2E テストが通過（Docker環境のセッション操作を含む）
  - [ ] lint が通過
