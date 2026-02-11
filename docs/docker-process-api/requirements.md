# 要件定義書: Docker環境プロセス管理API修正

## 概要

Docker環境でClaude Codeを実行する際、プロセス状態の表示・再起動・自動停止が正しく動作しない問題を修正する。

## 背景

現在のシステムには2つのPTY管理システムが並行して存在する:
- **ProcessManager**: stream-json形式のClaude Codeプロセス管理（レガシー）
- **AdapterFactory + DockerAdapter**: 環境別のPTY管理（新規実装）

APIエンドポイントがProcessManagerのみに依存しているため、Docker環境で以下の問題が発生している。

## ユーザーストーリー

### US-001: プロセス状態の正確な表示
**役割:** システム管理者
**目的:** Docker環境で実行中のClaude Codeの状態を正確に把握したい
**理由:** 現在、Docker PTYが実行中でも「停止」と表示され、システム状態を把握できない

### US-002: 環境に応じた再起動
**役割:** 開発者
**目的:** 「再起動」ボタンでDocker環境のClaude Codeを正しく再起動したい
**理由:** 現在、再起動するとHOST環境でプロセスが起動してしまい、Dockerコンテナが使われない

### US-003: アイドルタイムアウトによるリソース解放
**役割:** システム管理者
**目的:** 一定時間使用されていないDocker PTYを自動停止してリソースを解放したい
**理由:** 現在、idle_timeoutがDocker環境で機能せず、コンテナが動き続けリソースを消費する

## 機能要件

### REQ-001: プロセス状態確認APIの環境対応
**EARS記法:** イベント駆動型
> GET /api/sessions/[id]/process が呼ばれた時、システムはセッションのenvironment_idに基づいて適切なアダプター経由でプロセス状態を確認しなければならない

**受入基準:**
- [ ] environment_idがある場合、AdapterFactory経由で状態確認する
- [ ] environment_idがない場合（レガシー）、ProcessManagerで状態確認する
- [ ] Docker環境でPTY実行中の場合、running: trueを返す
- [ ] Docker環境でPTY停止中の場合、running: falseを返す

### REQ-002: プロセス再起動APIの環境対応
**EARS記法:** イベント駆動型
> POST /api/sessions/[id]/process が呼ばれた時、システムはセッションのenvironment_idに基づいて適切なアダプター経由でプロセスを再起動しなければならない

**受入基準:**
- [ ] environment_idがある場合、AdapterFactory経由で再起動する
- [ ] environment_idがない場合（レガシー）、ProcessManagerで再起動する
- [ ] Docker環境で再起動後、Docker内でClaude Codeが起動する
- [ ] HOST環境で再起動後、ホスト上でClaude Codeが起動する

### REQ-003: アイドルタイムアウトの環境対応
**EARS記法:** イベント駆動型
> アイドルタイムアウトが発生した時、システムはセッションのenvironment_idに基づいて適切なアダプター経由でプロセスを停止しなければならない

**受入基準:**
- [ ] environment_idがある場合、AdapterFactory経由で停止する
- [ ] environment_idがない場合（レガシー）、ProcessManagerで停止する
- [ ] Docker環境でタイムアウト後、Dockerコンテナが停止する
- [ ] HOST環境でタイムアウト後、ホストプロセスが停止する

## 非機能要件

### NFR-001: 後方互換性
> システムは既存のレガシーセッション（environment_idがないセッション）でも正常に動作しなければならない

### NFR-002: エラーハンドリング
> アダプター取得やプロセス操作に失敗した場合、適切なエラーメッセージを返さなければならない

## 用語定義

| 用語 | 定義 |
|------|------|
| environment_id | セッションに紐づく実行環境のID（ExecutionEnvironmentテーブルのID） |
| AdapterFactory | 環境タイプに応じて適切なアダプター（HostAdapter/DockerAdapter）を返すファクトリ |
| ProcessManager | stream-json形式のClaude Codeプロセスを管理するレガシーシステム |
| DockerAdapter | Docker環境でのPTY管理を担当するアダプター |
| HostAdapter | ホスト環境でのPTY管理を担当するアダプター |

## スコープ外

- 新しい実行環境タイプ（SSH等）の追加
- WebSocket接続部分の修正（既に正しく動作している）
- UI側の修正（APIが正しい値を返せばUIは自動的に正しく表示される）
