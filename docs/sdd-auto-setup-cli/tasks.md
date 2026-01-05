# タスク: npx実行による全自動セットアップCLI

## 情報の明確性チェック（全体）

### ユーザーから明示された情報
- 実行コマンド: `npx github:windschord/claude-work`
- CLI機能: 最小限（フォアグラウンド起動 + help）
- セットアップ: 全自動

### 不明/要確認の情報
| 項目 | 現状の理解 | 確認状況 |
|------|-----------|----------|
| なし | - | [x] 確認済み |

## 実装計画

### フェーズ1: ビルド設定
*推定期間: 10分*

#### タスク1.1: package.jsonにprepareスクリプトを追加

**説明**:
- 対象ファイルパス: `package.json`
- npm install後に自動的にサーバーをビルドするprepareスクリプトを追加

**技術的文脈**:
- npm ライフサイクルフック: prepare
- 既存のビルドスクリプト: `build:server`

**情報の明確性**:

| 分類 | 内容 |
|------|------|
| 明示された情報 | prepare スクリプトで build:server を実行 |
| 不明/要確認の情報 | なし |

**実装手順**:
1. package.json を開く
2. scripts セクションに `"prepare": "npm run build:server"` を追加
3. 変更を保存

**受入基準**:
- [x] package.json の scripts に `prepare` が存在する
- [x] prepare の値が `npm run build:server` である

**依存関係**: なし
**推定工数**: 5分
**ステータス**: `DONE`
**完了サマリー**: package.jsonのscriptsにprepareスクリプトを追加

**対応要件**: REQ-009, REQ-010

---

### フェーズ2: CLIシンプル化
*推定期間: 20分*

#### タスク2.1: cli.tsからpm2関連機能を削除

**説明**:
- 対象ファイルパス: `src/bin/cli.ts`
- バックグラウンド起動関連の機能を削除し、最小限のCLIにする

**技術的文脈**:
- 削除対象関数: `startDaemon()`, `stopDaemon()`, `restartDaemon()`, `showStatus()`, `showLogs()`
- 維持する関数: `setupEnvFile()`, `runSetup()`, `startForeground()`, `showHelp()`
- main() 関数のswitch文を簡略化

**情報の明確性**:

| 分類 | 内容 |
|------|------|
| 明示された情報 | pm2関連機能を削除、フォアグラウンド起動とhelpのみ維持 |
| 不明/要確認の情報 | なし |

**実装手順**:
1. cli.ts を開く
2. 以下の関数を削除:
   - `startDaemon()`
   - `stopDaemon()`
   - `restartDaemon()`
   - `showStatus()`
   - `showLogs()`
3. `PM2_APP_NAME` 定数を削除
4. `main()` 関数を修正:
   - `status`, `logs`, `stop` のcase文を削除
   - `start`, `restart` のcase文を削除
   - デフォルトでフォアグラウンド起動
5. `showHelp()` を簡略化（フォアグラウンド起動とhelpのみ記載）

**受入基準**:
- [x] `startDaemon`, `stopDaemon`, `restartDaemon`, `showStatus`, `showLogs` 関数が存在しない
- [x] `PM2_APP_NAME` が存在しない
- [x] `main()` がフォアグラウンド起動とhelpのみをサポート
- [x] TypeScriptコンパイルエラーがない

**依存関係**: なし
**推定工数**: 15分
**ステータス**: `DONE`
**完了サマリー**: cli.tsからpm2関連の5関数と定数を削除し、最小限のCLIに簡略化

**対応要件**: REQ-005, スコープ外（pm2機能削除）

---

### フェーズ3: 検証
*推定期間: 15分*

#### タスク3.1: ローカルビルドの検証

**説明**:
- prepareスクリプトが正しく動作し、dist/src/bin/cli.jsが生成されることを確認

**技術的文脈**:
- ビルドコマンド: `npm run build:server`
- 出力先: `dist/src/bin/cli.js`

**情報の明確性**:

| 分類 | 内容 |
|------|------|
| 明示された情報 | dist/src/bin/cli.js が生成される |
| 不明/要確認の情報 | なし |

**実装手順**:
1. `npm run build:server` を実行
2. `dist/src/bin/cli.js` の存在を確認
3. TypeScriptコンパイルエラーがないことを確認

**受入基準**:
- [x] `npm run build:server` が成功する
- [x] `dist/src/bin/cli.js` が存在する
- [x] コンパイルエラーがない

**依存関係**: タスク1.1, タスク2.1
**推定工数**: 5分
**ステータス**: `DONE`
**完了サマリー**: ビルド成功、dist/src/bin/cli.jsが正常に生成

**対応要件**: REQ-010

#### タスク3.2: CLI動作検証

**説明**:
- ビルドしたCLIが正しく動作することを確認

**技術的文脈**:
- 実行コマンド: `node dist/src/bin/cli.js`
- 期待動作: 全自動セットアップ後にサーバー起動

**情報の明確性**:

| 分類 | 内容 |
|------|------|
| 明示された情報 | フォアグラウンド起動、helpコマンド |
| 不明/要確認の情報 | なし |

**実装手順**:
1. `node dist/src/bin/cli.js help` でヘルプ表示を確認
2. `node dist/src/bin/cli.js` でサーバー起動を確認
3. Ctrl+C で停止できることを確認

**受入基準**:
- [x] `help` コマンドでヘルプが表示される
- [x] 引数なしでサーバーが起動する
- [x] 不正なコマンドでエラーメッセージが表示される

**依存関係**: タスク3.1
**推定工数**: 10分
**ステータス**: `DONE`
**完了サマリー**: helpコマンド正常動作、不正コマンドでエラー表示を確認

**対応要件**: REQ-001~008, NFR-002, NFR-003

---

## タスクステータスの凡例
- `TODO` - 未着手
- `IN_PROGRESS` - 作業中
- `BLOCKED` - ブロック中
- `REVIEW` - レビュー待ち
- `DONE` - 完了

## 逆順レビュー結果

### タスク → 設計の整合性

| タスク | 設計コンポーネント | 整合性 |
|--------|-------------------|--------|
| 1.1 | package.json (prepare) | [x] OK |
| 2.1 | CLI エントリーポイント | [x] OK |
| 3.1, 3.2 | ビルド・動作検証 | [x] OK |

### 設計 → 要件の整合性

| 要件 | 対応タスク | 整合性 |
|------|-----------|--------|
| REQ-001~005 | 3.2 | [x] OK |
| REQ-006~008 | 3.2 (既存機能) | [x] OK |
| REQ-009, REQ-010 | 1.1, 3.1 | [x] OK |
| NFR-001~003 | 3.2 | [x] OK |

## リスクと軽減策

| リスク | 影響度 | 軽減策 |
|--------|--------|--------|
| prepareスクリプトがnpx実行時に動作しない | 高 | ローカルでnpm installを削除して再実行し検証 |
| TypeScriptビルドエラー | 中 | 既存のテストを実行して問題ないか確認 |
