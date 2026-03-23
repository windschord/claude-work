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

CDPヘルスチェックがタイムアウトした場合、サイドカーのリソースをクリーンアップし、
サイドカーなしでClaude Codeを起動する（graceful degradation）。

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

ネットワーク作成失敗もサイドカー起動失敗として扱い、サイドカーなしでClaude Codeを起動する（graceful degradation）。

注: 現在の実装では、ネットワーク作成失敗を含むすべてのサイドカー起動失敗はgraceful degradationで処理される。DockerAdapterはstartSidecarの戻り値 `success: false` を受け取り、警告ログを出力してサイドカーなしでClaude Codeを起動する。

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
  | [警告ログを出力]                    |
  | [サイドカーなしでClaude Code起動]   |
  | buildContainerOptions (通常)        |
  | createContainer (Claude Code)       |
  |---------------------------------------->|
```
