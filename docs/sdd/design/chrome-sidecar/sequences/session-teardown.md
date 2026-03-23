# シーケンス図: セッション破棄 (サイドカー付き)

## 概要

Chrome Sidecarが付いたセッションの破棄フロー。破棄順序は依存関係に基づく: Claude Code停止 -> Chrome停止 -> ネットワーク削除。

## 対応要件

REQ-002-001, REQ-002-003

## 正常系フロー

```
Client          PTYSessionMgr     DockerAdapter     ChromeSidecarSvc    DockerClient       DB
  |                  |                 |                  |                  |              |
  | destroySession   |                 |                  |                  |              |
  |----------------->|                 |                  |                  |              |
  |                  | destroySession  |                  |                  |              |
  |                  |---------------->|                  |                  |              |
  |                  |                 |                  |                  |              |
  |                  |                 | [1] Claude Code PTY kill           |              |
  |                  |                 | sessions.delete  |                  |              |
  |                  |                 | ptyProcess.kill() |                 |              |
  |                  |                 |                  |                  |              |
  |                  |                 | [2] Claude Codeコンテナ停止        |              |
  |                  |                 | stopContainer    |                  |              |
  |                  |                 |---------------------------------------->|         |
  |                  |                 |<----------------------------------------|         |
  |                  |                 |                  |                  |              |
  |                  |                 | [3] DB: container_id = NULL        |              |
  |                  |                 |------------------------------------------------------>|
  |                  |                 |                  |                  |              |
  |                  |                 | [4] DB: chrome_container_id読取    |              |
  |                  |                 |------------------------------------------------------>|
  |                  |                 |<------------------------------------------------------|
  |                  |                 |                  |                  |              |
  |                  |                 | [5] Chrome停止   |                  |              |
  |                  |                 | stopSidecar()    |                  |              |
  |                  |                 |----------------->|                  |              |
  |                  |                 |                  |                  |              |
  |                  |                 |                  | [5a] stopContainer              |
  |                  |                 |                  | (Chrome, AutoRemove=true)       |
  |                  |                 |                  |----------------->|              |
  |                  |                 |                  |<-----------------|              |
  |                  |                 |                  |                  |              |
  |                  |                 |                  | [5b] disconnectNetwork          |
  |                  |                 |                  | (Claude Codeを先にdisconnect)   |
  |                  |                 |                  |----------------->|              |
  |                  |                 |                  |<-----------------|              |
  |                  |                 |                  |                  |              |
  |                  |                 |                  | [5c] removeNetwork              |
  |                  |                 |                  | (cw-net-<sid>)   |              |
  |                  |                 |                  |----------------->|              |
  |                  |                 |                  |<-----------------|              |
  |                  |                 |                  |                  |              |
  |                  |                 |<----------------|                  |              |
  |                  |                 |                  |                  |              |
  |                  |                 | [6] DB更新       |                  |              |
  |                  |                 | chrome_container_id = NULL          |              |
  |                  |                 | chrome_debug_port = NULL            |              |
  |                  |                 |------------------------------------------------------>|
  |                  |                 |                  |                  |              |
  |                  |                 | [7] proxyルールクリーンアップ       |              |
  |                  |                 | (既存処理、best-effort)            |              |
  |                  |                 |                  |                  |              |
  |                  |<----------------|                  |                  |              |
  |<-----------------|                 |                  |                  |              |
```

## Chrome停止失敗時のフロー

```
DockerAdapter     ChromeSidecarSvc    DockerClient       DB
  |                  |                  |                  |
  | [4-5] Chrome停止 |                  |                  |
  | stopSidecar()    |                  |                  |
  |----------------->|                  |                  |
  |                  | stopContainer    |                  |
  |                  |----------------->|                  |
  |                  |<-- ERROR --------|                  |
  |                  |                  |                  |
  |                  | force-kill       |                  |
  |                  |----------------->|                  |
  |                  |<-- ERROR --------|                  |
  |                  |                  |                  |
  |<-- warn log -----|                  |                  |
  |                  |                  |                  |
  | [Chrome停止失敗でもセッション破棄は続行]               |
  | [chrome_container_idは保持、次回cleanupOrphanedで回収] |
  |                  |                  |                  |
  | DB: container_id = NULL (Claude Code側のみクリア)      |
  |------------------------------------------------------>|
```

## 備考

- AutoRemove=true により、Chromeコンテナは停止と同時に自動削除される。明示的なremoveContainer呼び出しは不要
- ネットワーク削除前に、接続中の全コンテナをdisconnectする必要がある（Claude Codeコンテナが既に停止済みの場合は不要だが、念のためdisconnectを試行する）
- Chrome停止失敗はセッション破棄を妨げない（best-effort）。失敗した場合はcontainer_idを保持し、サーバー起動時のcleanupOrphanedで回収する
