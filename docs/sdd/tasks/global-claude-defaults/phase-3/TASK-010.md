# TASK-010: 環境設定UI: オーバーライドUI追加

## 概要

環境設定モーダル/ページにClaude Code設定オーバーライドセクションを追加する。

## 依存: TASK-003

## 対象ファイル

- `src/components/environments/` 配下に新規コンポーネントまたは既存コンポーネント拡張

## UI設計

```
[Claude Code設定オーバーライド]
--------------------------------------------
パーミッション自動スキップ
  (x) アプリ設定に従う [現在: 無効]
  ( ) 有効
  ( ) 無効

Worktreeモード
  (x) アプリ設定に従う [現在: 有効]
  ( ) 有効
  ( ) 無効
--------------------------------------------
```

## 実装方針

- ラジオボタン形式で「アプリ設定に従う / 有効 / 無効」の3択
- 「アプリ設定に従う」選択時は現在のアプリ設定値をグレー文字で表示
- 環境更新API（PUT /api/environments/:id）を通じてconfig JSONにclaude_defaults_overrideを保存
- アプリ共通設定の現在値を表示するため、/api/settings/configも参照する

## データフロー

```
1. 環境設定UIロード
   -> GET /api/settings/config (アプリ共通設定取得)
   -> GET /api/environments/:id (環境設定取得)

2. ユーザーがオーバーライド設定を変更
   -> UI状態更新

3. 保存ボタン押下
   -> PUT /api/environments/:id
      body: {
        config: {
          ...existingConfig,
          claude_defaults_override: {
            dangerouslySkipPermissions: true | false | 'inherit',
            worktree: true | false | 'inherit',
          }
        }
      }
```

## 受入条件

- [ ] 環境設定UIにオーバーライドセクションが表示される
- [ ] ラジオボタンで「アプリ設定に従う / 有効 / 無効」が選択できる
- [ ] 「アプリ設定に従う」の横に現在のアプリ設定値が表示される
- [ ] 保存が成功し、環境のconfig JSONにclaude_defaults_overrideが保存される
- [ ] 再読み込み時に設定が復元される
