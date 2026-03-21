# シーケンス図: セッション起動 (サイドカー有効)

## 概要

Chrome Sidecarが有効な環境でDockerセッションを作成する際のフロー。

## 対応要件

REQ-001-001, REQ-001-002, REQ-001-003, REQ-001-004, NFR-RES-002

## 正常系フロー

```
Client          PTYSessionMgr     DockerAdapter     ChromeSidecarSvc    DockerClient
  |                  |                 |                  |                  |
  |  createSession   |                 |                  |                  |
  |----------------->|                 |                  |                  |
  |                  | read env config |                  |                  |
  |                  | (chromeSidecar) |                  |                  |
  |                  |                 |                  |                  |
  |                  | createSession   |                  |                  |
  |                  |---------------->|                  |                  |
  |                  |                 |                  |                  |
  |                  |                 | startSidecar()   |                  |
  |                  |                 |----------------->|                  |
  |                  |                 |                  |                  |
  |                  |                 |                  | createNetwork    |
  |                  |                 |                  | (cw-net-<sid>)   |
  |                  |                 |                  |----------------->|
  |                  |                 |                  |<-----------------|
  |                  |                 |                  |                  |
  |                  |                 |                  | createContainer  |
  |                  |                 |                  | (cw-chrome-<sid>)|
  |                  |                 |                  |----------------->|
  |                  |                 |                  |<-----------------|
  |                  |                 |                  |                  |
  |                  |                 |                  | startContainer   |
  |                  |                 |                  |----------------->|
  |                  |                 |                  |<-----------------|
  |                  |                 |                  |                  |
  |                  |                 |                  | waitForCDP()     |
  |                  |                 |                  | (max 30s)        |
  |                  |                 |                  |~~~~ polling ~~~~>|
  |                  |                 |                  |<~~~~ 200 OK ~~~~|
  |                  |                 |                  |                  |
  |                  |                 |                  | inspectContainer |
  |                  |                 |                  | (get debug port) |
  |                  |                 |                  |----------------->|
  |                  |                 |                  |<-----------------|
  |                  |                 |                  |                  |
  |                  |                 |<-- SidecarResult |                  |
  |                  |                 |   (success=true) |                  |
  |                  |                 |                  |                  |
  |                  |                 | buildContainerOptions              |
  |                  |                 | + injectBrowserUrl                 |
  |                  |                 |                  |                  |
  |                  |                 | createContainer  |                  |
  |                  |                 | (Claude Code)    |                  |
  |                  |                 |---------------------------------------->|
  |                  |                 |<----------------------------------------|
  |                  |                 |                  |                  |
  |                  |                 | startContainer   |                  |
  |                  |                 |---------------------------------------->|
  |                  |                 |<----------------------------------------|
  |                  |                 |                  |                  |
  |                  |                 | connectClaudeContainer              |
  |                  |                 |----------------->|                  |
  |                  |                 |                  | connectToNetwork |
  |                  |                 |                  | (cw-net-<sid>)   |
  |                  |                 |                  |----------------->|
  |                  |                 |                  |<-----------------|
  |                  |                 |<----------------|                  |
  |                  |                 |                  |                  |
  |                  |                 | DB update        |                  |
  |                  |                 | (chrome_container_id,               |
  |                  |                 |  chrome_debug_port)                 |
  |                  |                 |                  |                  |
  |                  |<----------------|                  |                  |
  |<-----------------|                 |                  |                  |
```

## タイムアウト時のフロー (CDPヘルスチェック失敗)

```
DockerAdapter     ChromeSidecarSvc    DockerClient
  |                  |                  |
  | startSidecar()   |                  |
  |----------------->|                  |
  |                  | createNetwork    |
  |                  |----------------->|
  |                  |<-----------------|
  |                  |                  |
  |                  | createContainer  |
  |                  |----------------->|
  |                  |<-----------------|
  |                  |                  |
  |                  | startContainer   |
  |                  |----------------->|
  |                  |<-----------------|
  |                  |                  |
  |                  | waitForCDP()     |
  |                  | (30s timeout)    |
  |                  |~~~~ polling ~~~~>|
  |                  |  ... 30秒経過 ...|
  |                  |                  |
  |                  | -- TIMEOUT --    |
  |                  |                  |
  |                  | stopContainer    |
  |                  | (Chrome)         |
  |                  |----------------->|
  |                  |<-----------------|
  |                  |                  |
  |                  | removeNetwork    |
  |                  |----------------->|
  |                  |<-----------------|
  |                  |                  |
  |<-- SidecarResult |                  |
  |   (success=false)|                  |
  |                  |                  |
  | [サイドカーなしでClaude Code起動]   |
  | buildContainerOptions (通常)        |
  | createContainer (Claude Code)       |
  |---------------------------------------->|
```

## ネットワーク作成失敗時のフロー

```
DockerAdapter     ChromeSidecarSvc    DockerClient
  |                  |                  |
  | startSidecar()   |                  |
  |----------------->|                  |
  |                  | createNetwork    |
  |                  |----------------->|
  |                  |<-- ERROR --------|
  |                  |                  |
  |<-- SidecarResult |                  |
  |   (success=false,|                  |
  |    error=msg)    |                  |
  |                  |                  |
  | [セッション作成をERROR状態にする]   |
  | (NFR-SEC-002: ネットワーク失敗は   |
  |  セッション作成中止)               |
```

注: NFR-SEC-002により、ネットワーク作成失敗時はサイドカーなしでのフォールバックではなく、セッション作成自体をエラーとして中止する。CDPヘルスチェック失敗（REQ-001-004）とは異なる挙動である。
