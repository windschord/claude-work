# タスク: vitest forks workerプロセス孤児化問題の修正

## 関連ドキュメント

- 設計書: `docs/design-vitest-process-orphan.md`
- 要件書: `docs/requirements.md`

## 情報の明確性チェック（全体）

### ユーザーから明示された情報

- 対象ファイル: `ecosystem.config.js`
- 修正内容: vitestを直接実行するように変更
- 追加設定: `kill_timeout: 10000`
- 変更設定: `autorestart: false`

### 不明/要確認の情報

| 項目 | 現状の理解 | 確認状況 |
|------|-----------|----------|
| なし | - | [x] 確認済み |

## 実装計画

### フェーズ1: ecosystem.config.js の修正

#### 推定期間: 10分

#### タスク1.1: claude-work-test 設定の修正

**説明**:
- 対象ファイルパス: `ecosystem.config.js`
- npm経由からvitest直接実行に変更
- kill_timeoutを追加

**技術的文脈**:
- pm2設定ファイル
- Node.js環境

**情報の明確性**:

| 分類 | 内容 |
|------|------|
| 明示された情報 | script: './node_modules/.bin/vitest', args: 'run', kill_timeout: 10000 |
| 不明/要確認の情報 | なし |

**実装手順**:
1. `ecosystem.config.js` の `claude-work-test` エントリを特定（39-52行目）
2. `script: 'npm'` を `script: './node_modules/.bin/vitest'` に変更
3. `args: 'test'` を `args: 'run'` に変更
4. `kill_timeout: 10000` を追加

**変更前**:
```javascript
{
  name: 'claude-work-test',
  script: 'npm',
  args: 'test',
  cwd: __dirname,
  env: {
    NODE_ENV: 'test',
  },
  watch: false,
  autorestart: false,
  error_file: './logs/pm2-test-error.log',
  out_file: './logs/pm2-test-out.log',
  log_date_format: 'YYYY-MM-DD HH:mm:ss',
},
```

**変更後**:
```javascript
{
  name: 'claude-work-test',
  script: './node_modules/.bin/vitest',
  args: 'run',
  cwd: __dirname,
  env: {
    NODE_ENV: 'test',
  },
  watch: false,
  autorestart: false,
  kill_timeout: 10000,
  error_file: './logs/pm2-test-error.log',
  out_file: './logs/pm2-test-out.log',
  log_date_format: 'YYYY-MM-DD HH:mm:ss',
},
```

**受入基準**:
- [ ] `script` が `'./node_modules/.bin/vitest'` に変更されている
- [ ] `args` が `'run'` に変更されている
- [ ] `kill_timeout: 10000` が追加されている

**依存関係**: なし
**推定工数**: 5分
**ステータス**: `TODO`

---

#### タスク1.2: claude-work-test-watch 設定の修正

**説明**:
- 対象ファイルパス: `ecosystem.config.js`
- npm経由からvitest直接実行に変更
- kill_timeoutを追加
- autorestart を false に変更

**技術的文脈**:
- pm2設定ファイル
- Node.js環境

**情報の明確性**:

| 分類 | 内容 |
|------|------|
| 明示された情報 | script: './node_modules/.bin/vitest', args: '', kill_timeout: 10000, autorestart: false |
| 不明/要確認の情報 | なし |

**実装手順**:
1. `ecosystem.config.js` の `claude-work-test-watch` エントリを特定（54-67行目）
2. `script: 'npm'` を `script: './node_modules/.bin/vitest'` に変更
3. `args: 'run test:watch'` を `args: ''`（空文字列、watchがデフォルト）に変更
4. `autorestart: true` を `autorestart: false` に変更
5. `kill_timeout: 10000` を追加

**変更前**:
```javascript
{
  name: 'claude-work-test-watch',
  script: 'npm',
  args: 'run test:watch',
  cwd: __dirname,
  env: {
    NODE_ENV: 'test',
  },
  watch: false,
  autorestart: true,
  error_file: './logs/pm2-test-watch-error.log',
  out_file: './logs/pm2-test-watch-out.log',
  log_date_format: 'YYYY-MM-DD HH:mm:ss',
},
```

**変更後**:
```javascript
{
  name: 'claude-work-test-watch',
  script: './node_modules/.bin/vitest',
  args: '',
  cwd: __dirname,
  env: {
    NODE_ENV: 'test',
  },
  watch: false,
  autorestart: false,
  kill_timeout: 10000,
  error_file: './logs/pm2-test-watch-error.log',
  out_file: './logs/pm2-test-watch-out.log',
  log_date_format: 'YYYY-MM-DD HH:mm:ss',
},
```

**受入基準**:
- [ ] `script` が `'./node_modules/.bin/vitest'` に変更されている
- [ ] `args` が `''` に変更されている
- [ ] `autorestart` が `false` に変更されている
- [ ] `kill_timeout: 10000` が追加されている

**依存関係**: なし
**推定工数**: 5分
**ステータス**: `TODO`

---

### フェーズ2: 動作確認

#### 推定期間: 10分

#### タスク2.1: テスト実行・停止の動作確認

**説明**:
- pm2でテストを実行し、停止後にプロセスが残存していないことを確認

**技術的文脈**:
- pm2コマンド
- Linux psコマンド

**実装手順**:
1. 既存のpm2プロセスを削除（クリーンな状態にする）
   ```bash
   pm2 delete claude-work-test claude-work-test-watch 2>/dev/null || true
   ```
2. テスト実行
   ```bash
   npm run test:pm2
   ```
3. テスト完了を待つ
4. プロセス確認
   ```bash
   ps aux | grep vitest | grep -v grep
   ```
5. 停止
   ```bash
   pm2 stop claude-work-test
   ```
6. 再度プロセス確認（vitest関連プロセスがないこと）
   ```bash
   ps aux | grep vitest | grep -v grep
   ```

**受入基準**:
- [ ] `npm run test:pm2` が正常に実行される
- [ ] `pm2 stop claude-work-test` 後、vitest関連プロセスが存在しない

**依存関係**: タスク1.1
**推定工数**: 5分
**ステータス**: `TODO`

---

#### タスク2.2: watch実行・停止の動作確認

**説明**:
- pm2でwatch モードを実行し、停止後にプロセスが残存していないことを確認

**技術的文脈**:
- pm2コマンド
- Linux psコマンド

**実装手順**:
1. watch実行
   ```bash
   npm run test:watch:pm2
   ```
2. 数秒待機してプロセス確認
   ```bash
   ps aux | grep vitest | grep -v grep
   ```
3. 停止
   ```bash
   pm2 stop claude-work-test-watch
   ```
4. 再度プロセス確認（vitest関連プロセスがないこと）
   ```bash
   ps aux | grep vitest | grep -v grep
   ```

**受入基準**:
- [ ] `npm run test:watch:pm2` が正常に実行される
- [ ] `pm2 stop claude-work-test-watch` 後、vitest関連プロセスが存在しない

**依存関係**: タスク1.2
**推定工数**: 5分
**ステータス**: `TODO`

---

### フェーズ3: コミット

#### 推定期間: 5分

#### タスク3.1: 変更をコミット

**説明**:
- 設計書とecosystem.config.jsの変更をコミット

**実装手順**:
1. 変更ファイルをステージング
   ```bash
   git add ecosystem.config.js docs/design-vitest-process-orphan.md docs/tasks-vitest-process-orphan.md
   ```
2. コミット
   ```bash
   git commit -m "fix: pm2でvitestを直接実行し孤児プロセスを防止"
   ```

**受入基準**:
- [ ] コミットが作成されている
- [ ] コミットメッセージが適切である

**依存関係**: タスク2.1, タスク2.2
**推定工数**: 2分
**ステータス**: `TODO`

---

## タスクステータスの凡例

- `TODO` - 未着手
- `IN_PROGRESS` - 作業中
- `BLOCKED` - ブロック中
- `REVIEW` - レビュー待ち
- `DONE` - 完了

## 逆順レビュー

### タスク → 設計の整合性

| タスク | 設計書の対応箇所 | 整合性 |
|--------|-----------------|--------|
| タスク1.1 | ecosystem.config.js の設計（89-128行） | OK |
| タスク1.2 | ecosystem.config.js の設計（89-128行） | OK |
| タスク2.1 | テスト計画（241-257行） | OK |
| タスク2.2 | テスト計画（241-257行） | OK |

### 設計 → 要件の整合性

| 設計要素 | 要件の対応 | 整合性 |
|----------|-----------|--------|
| プロセス終了の信頼性向上 | NFR-007（サーバー再起動後の復元） | OK |

## リスクと軽減策

| リスク | 影響 | 軽減策 |
|--------|------|--------|
| vitest直接実行でパス問題が発生 | テストが実行できない | `./node_modules/.bin/vitest` のパス確認、npx fallback検討 |
| pm2のkill_timeoutが効かない | 孤児プロセス発生 | 手動でのプロセス確認を運用に追加 |

## 実装完了後の確認事項

- [ ] pm2 stop後にvitest関連プロセスが残存しないこと
- [ ] テストが正常に実行されること
- [ ] watchモードが正常に動作すること
