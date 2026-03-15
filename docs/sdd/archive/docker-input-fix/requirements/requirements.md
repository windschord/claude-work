# 要件定義書: Docker環境ターミナル入力不能の修正

## 概要

Docker環境でClaude Codeターミナルに入力が一切できない問題を修正する。
クライアント(XTerm.js)からWebSocket経由で入力データは正常に送信されるが、
サーバー側のDockerAdapterがPTYに書き込めないため、入力がDockerコンテナに到達しない。

## 根本原因分析

### 原因1: destroySessionがDockerコンテナを停止しない

`DockerAdapter.destroySession()`は`ptyProcess.kill()`でホスト側のdocker CLIプロセスにSIGHUPを送る。
しかし、Dockerはクライアント-サーバーアーキテクチャのため、CLIが終了してもコンテナ自体は
Dockerデーモンで動き続ける。結果としてコンテナがゾンビ状態（PTY接続なし）で残る。

### 原因2: restartSessionが不完全

旧コンテナを`docker stop/kill`せずに新コンテナを作成するため:
- 旧コンテナがリソースを占有し続ける
- 新コンテナのdocker CLIがexit code 129(SIGHUP)で即座に終了する場合がある
- 新コンテナが起動してもPTY接続が喪失する

### 原因3: write()が無言で失敗する

`DockerAdapter.write()`はオプショナルチェーニング(`?.`)を使用しており、
セッションがMapに存在しない場合は無言で何も起きない。エラーログも出力されないため
デバッグが困難。

## ユーザーストーリー

**US-001**: ユーザーとして、Docker環境のClaude Codeセッションでキーボード入力が
正常に受け付けられ、Claude Codeと対話できるようにしたい。

**US-002**: ユーザーとして、Claude Codeの再起動ボタンを押した時、
Docker環境でも旧コンテナが確実に停止し、新しいセッションで入力できるようにしたい。

## 要件

### 機能要件

**REQ-001**: DockerAdapter.destroySession()が呼ばれた時、
システムはPTYプロセスの終了に加えて、Dockerコンテナを明示的に停止(`docker stop`)しなければならない。

**REQ-002**: DockerAdapter.restartSession()が呼ばれた時、
システムは旧Dockerコンテナの完全停止を確認してから新コンテナを作成しなければならない。

**REQ-003**: DockerAdapter.onExitハンドラーにおいて、
PTYプロセス終了時にDockerコンテナがまだ実行中の場合、システムはコンテナを停止しなければならない。

**REQ-004**: DockerAdapter.write()でセッションが存在しない場合、
システムは警告ログを出力しなければならない。

### 非機能要件

**NFR-001**: コンテナ停止処理はバックグラウンドで非同期に実行し、
メインの処理フローをブロックしてはならない。

**NFR-002**: HOST環境の既存動作に影響を与えてはならない。

**NFR-003**: コンテナ停止のタイムアウトは5秒以内とし、応答性を損なってはならない。

**NFR-004**: 既存のDockerAdapterテストが全てパスしなければならない。

## 受入基準

- AC-001: destroySession()呼び出し後、対象Dockerコンテナが停止していること
- AC-002: restartSession()呼び出し後、旧コンテナが停止し新コンテナで入力可能なこと
- AC-003: PTY予期しない終了時に、ゾンビコンテナが残らないこと
- AC-004: write()でセッション不在時に警告ログが出力されること
- AC-005: HOST環境の既存テストがすべてパスすること
