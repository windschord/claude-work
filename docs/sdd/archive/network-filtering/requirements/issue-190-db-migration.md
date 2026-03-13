# 要件定義: NetworkFilterテーブルDBマイグレーション (Issue #190)

## 概要

Docker Composeデプロイ時に、PR #185で追加されたNetworkFilterConfig/NetworkFilterRuleテーブルが自動作成されない問題を修正する。

## 背景

- ProductionのDockerイメージにはdrizzle-kitが含まれていないため、コンテナ内で `db:push` を実行できない
- 既存のバージョンベースマイグレーションシステム（`src/bin/cli-utils.ts`）を使用して自動マイグレーションを行う必要がある
- 現在のDBバージョンはv6、NetworkFilterテーブルはv7で追加する

## 要件 (EARS記法)

### REQ-001: 既存DBへのマイグレーション

WHEN サーバーが起動する AND DBバージョンが6以下である
THEN システムはNetworkFilterConfigテーブルを自動作成しなければならない

WHEN サーバーが起動する AND DBバージョンが6以下である
THEN システムはNetworkFilterRuleテーブルを自動作成しなければならない

### REQ-002: 新規DBの初期作成

WHEN 新規データベースが初期化される
THEN システムはNetworkFilterConfigテーブルを含む全テーブルを作成しなければならない

WHEN 新規データベースが初期化される
THEN システムはNetworkFilterRuleテーブルを含む全テーブルを作成しなければならない

### REQ-003: 冪等性

WHEN マイグレーションが既に適用済みのDBに対して再実行される
THEN システムはエラーを発生させずに正常終了しなければならない

### REQ-004: データ保護

WHEN マイグレーションが実行される
THEN 既存のデータは保持されなければならない

## 受入基準

- [x] v6のDBに対してmigrateDatabase()を実行するとNetworkFilterConfig/NetworkFilterRuleテーブルが作成される
- [x] 新規DBにinitializeDatabase()を実行するとNetworkFilterConfig/NetworkFilterRuleテーブルが作成される
- [x] マイグレーション後のDBバージョンが7になる
- [x] 既存データが失われない
- [x] 既にv7のDBに対して再実行してもエラーにならない
