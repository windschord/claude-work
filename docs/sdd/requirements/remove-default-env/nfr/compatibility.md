# NFR: 後方互換性

## 要件

### NFR-RDE-C01: 既存データの保全

既存の環境データ（host-default, docker-defaultなど）は、`is_default`フラグが削除されても通常の環境として残存しなければならない。

### NFR-RDE-C02: 既存セッションへの影響なし

既存のセッションが参照している`environment_id`は変更されてはならない。

### NFR-RDE-C03: DBマイグレーション

`is_default`カラムの削除は`db:push`で実施する。SQLiteのカラム削除はテーブル再作成を伴うため、データバックアップの手順を明記する。
