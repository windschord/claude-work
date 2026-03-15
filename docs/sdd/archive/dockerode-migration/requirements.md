# 要件定義: Docker CLI から Dockerode ライブラリへの移行

## 概要

ClaudeWork が Docker CLI（`docker` コマンド）を `child_process.execFile` / `child_process.spawn` / `pty.spawn` で直接呼び出している箇所を、Node.js 用 Docker ライブラリ（Dockerode）に置き換える。これにより、コンテナ内に Docker CLI バイナリをインストールせずに Docker ソケット経由で Docker 操作が可能になる。

## ユーザーストーリー

### ストーリー1: 非PTY Docker操作のDockerode化

**私は** ClaudeWorkの開発者として
**したい** コンテナのライフサイクル管理、状態確認、ボリューム操作を Dockerode API で行いたい
**なぜなら** Docker CLI バイナリへの依存を削除し、Docker ソケットのみで動作可能にするため

#### 受入基準（EARS記法）

- REQ-001: DockerAdapter が Dockerode API を使用してコンテナの状態確認（inspect）を行わなければならない
- REQ-002: DockerAdapter が Dockerode API を使用してコンテナの停止（stop）、強制停止（kill）、削除（rm）、待機（wait）を行わなければならない
- REQ-003: DockerAdapter が Dockerode API を使用してコンテナへのファイルコピー（cp）を行わなければならない
- REQ-004: DockerAdapter が Dockerode API を使用してコンテナ内でのコマンド実行（exec、非PTY）を行わなければならない
- REQ-005: DockerGitService が Dockerode API を使用してボリュームの作成・削除を行わなければならない
- REQ-006: DockerGitService が Dockerode API を使用してGit操作用の一時コンテナ実行を行わなければならない
- REQ-007: EnvironmentService が Dockerode API を使用して Docker デーモン状態確認とイメージ検査を行わなければならない

### ストーリー2: ビルド操作のDockerode化

**私は** ClaudeWorkの開発者として
**したい** Docker イメージのビルドとイメージ一覧取得を Dockerode API で行いたい
**なぜなら** ビルドログのストリーム処理も含めて統一的なAPIで管理できるため

#### 受入基準（EARS記法）

- REQ-008: DockerService が Dockerode の `buildImage` API を使用してイメージビルドを行わなければならない
- REQ-009: Docker images API が Dockerode の `listImages` API を使用してイメージ一覧を返さなければならない
- REQ-010: イメージビルドの進捗ログがストリーム形式でクライアントに返されなければならない

### ストーリー3: PTYセッションのDockerode化

**私は** ClaudeWorkの開発者として
**したい** `pty.spawn('docker', ['run', '-it', ...])` を Dockerode のコンテナ作成+attach+TTY で置き換えたい
**なぜなら** PTY起動においてもDocker CLIへの依存をなくすため

#### 受入基準（EARS記法）

- REQ-011: DockerAdapter の Claude Code PTYセッション起動が、Dockerode の `container.create()` + `container.start()` + `container.attach({ Tty: true })` で行われなければならない
- REQ-012: DockerAdapter のシェルPTYセッション（docker exec -it）が、Dockerode の `container.exec({ Tty: true })` + `exec.start()` で行われなければならない
- REQ-013: PTYセッションのリサイズ（ターミナルサイズ変更）が、Dockerode の `container.resize()` または `exec.resize()` で処理されなければならない
- REQ-014: PTYセッションの入出力ストリームが XTerm.js クライアントと正常に通信できなければならない（ANSI escape codes、カラー出力を含む）
- REQ-015: DockerPTYAdapter の PTYセッション起動も同様に Dockerode ベースに移行されなければならない

### ストーリー4: テストとDocker CLI依存の除去

**私は** ClaudeWorkの開発者として
**したい** 移行後にすべてのテストが通過し、Docker CLIへの依存が完全に除去されること
**なぜなら** Dockerfile から Docker CLI インストールを削除して、イメージサイズを削減するため

#### 受入基準（EARS記法）

- REQ-016: 既存のすべての Docker 関連ユニットテストが、Dockerode モック を使用する形式に更新されなければならない
- REQ-017: 既存のすべての Docker 関連インテグレーションテストが通過しなければならない
- REQ-018: Dockerfile の runner ステージに Docker CLI のインストールが不要でなければならない
- REQ-019: `package.json` に `dockerode` と `@types/dockerode` が依存として追加されなければならない

## 非機能要件

- NFR-001: Dockerode への移行により、コンテナ起動のレスポンス時間が現行比 2 倍以上悪化してはならない
- NFR-002: PTYセッションの入出力遅延が体感上変化してはならない（100ms以内）
- NFR-003: メモリ使用量がDockerode導入により 50MB 以上増加してはならない

## 影響範囲

### 移行対象ファイル

| ファイル | Docker CLI 使用箇所 | PTY利用 |
|---------|---------------------|---------|
| `src/services/adapters/docker-adapter.ts` | run, exec, inspect, stop, kill, wait, cp | あり（run, exec） |
| `src/services/docker-service.ts` | info, ps, images, build | なし（buildはストリーム） |
| `src/services/docker-git-service.ts` | volume create/rm, run | なし |
| `src/services/docker-pty-adapter.ts` | run -it | あり |
| `src/services/environment-service.ts` | info, image inspect | なし |
| `src/app/api/docker/images/route.ts` | images --format | なし |
| `src/app/api/docker/image-build/route.ts` | build | なし（ストリーム） |
| `src/app/api/environments/route.ts` | build | なし（ストリーム） |
| `src/services/pty-session-manager.ts` | inspect, rm | なし |

### テストファイル

- `src/services/adapters/__tests__/docker-adapter.test.ts`
- `src/services/__tests__/docker-service.test.ts`
- `src/services/__tests__/docker-git-service.test.ts`
- `src/services/__tests__/docker-git-service-retry.test.ts`
- `src/services/__tests__/docker-pty-adapter.test.ts`
- `src/services/__tests__/docker-integration.test.ts`
- `src/services/adapters/__tests__/docker-adapter.integration.test.ts`
- `src/services/adapters/__tests__/docker-dev-settings.integration.test.ts`
- `src/services/__tests__/session-state-integration.test.ts`

## 前提条件

- `/var/run/docker.sock` がアプリケーションからアクセス可能であること
- Dockerode が Docker API v1.25 以上をサポートしていること

## リスク

| リスク | 影響度 | 対策 |
|-------|--------|------|
| PTY + Dockerode の統合でXTerm.js互換性問題 | 高 | フェーズ3着手前にPoC実施。問題があればハイブリッド方式（PTYのみpty.spawn維持）にフォールバック |
| Dockerode のストリーム処理が既存のbuildログ形式と異なる | 中 | JSON行形式の解析レイヤーを追加 |
| docker cp のDockerode対応（tar形式） | 中 | Dockerode の `putArchive` / `getArchive` API を使用 |
| エラーハンドリングの構造変更 | 中 | DockerError 生成ロジックをDockerode形式に段階的に移行 |
| 既存テストの大幅修正 | 中 | フェーズごとにテスト更新。CIで回帰を検知 |
