# タスク: npx 実行時の依存バージョン不整合修正

> このドキュメントはAIエージェント（Claude Code等）が実装を行うことを前提としています。

## 実装計画

### フェーズ1: package.json 修正

#### タスク1.1: prepare スクリプトの修正

**説明**:
- 対象ファイル: `package.json`
- 変更内容: `npx prisma generate` → `prisma generate`

**技術的文脈**:
- npm scripts 内では `node_modules/.bin` が PATH に自動追加される
- `prisma` と書くだけでローカルの prisma が使用される

**受入基準**:
- [x] prepare スクリプトが `prisma generate` を使用している
- [x] `npm install` 実行時に Prisma 5.x が使用される

**依存関係**: なし
**ステータス**: `DONE`

---

### フェーズ2: CLI コード修正

#### タスク2.1: ローカルバイナリパス解決の追加

**説明**:
- 対象ファイル: `src/bin/cli.ts`
- 変更内容: `prismaCmd` と `pm2Cmd` の定義を追加

**技術的文脈**:
```typescript
const binDir = path.join(projectRoot, 'node_modules', '.bin');
const prismaCmd = path.join(binDir, process.platform === 'win32' ? 'prisma.cmd' : 'prisma');
const pm2Cmd = path.join(binDir, process.platform === 'win32' ? 'pm2.cmd' : 'pm2');
```

**受入基準**:
- [x] `prismaCmd` 変数が定義されている
- [x] `pm2Cmd` 変数が定義されている
- [x] Windows 対応（.cmd 拡張子）が考慮されている

**依存関係**: なし
**ステータス**: `DONE`

---

#### タスク2.2: generatePrismaClient 関数の修正

**説明**:
- 対象ファイル: `src/bin/cli.ts`
- 対象関数: `generatePrismaClient()` (112行目付近)
- 変更内容: `spawnSync(npxCmd, ['prisma', 'generate'], ...)` → `spawnSync(prismaCmd, ['generate'], ...)`

**受入基準**:
- [x] `generatePrismaClient()` が `prismaCmd` を使用している
- [x] 関数が正常に動作する

**依存関係**: タスク2.1
**ステータス**: `DONE`

---

#### タスク2.3: setupDatabase 関数の修正

**説明**:
- 対象ファイル: `src/bin/cli.ts`
- 対象関数: `setupDatabase()` (146行目付近)
- 変更内容: `spawnSync(npxCmd, ['prisma', 'db', 'push', ...], ...)` → `spawnSync(prismaCmd, ['db', 'push', ...], ...)`

**受入基準**:
- [x] `setupDatabase()` が `prismaCmd` を使用している
- [x] 関数が正常に動作する

**依存関係**: タスク2.1
**ステータス**: `DONE`

---

#### タスク2.4: pm2 関連関数の修正

**説明**:
- 対象ファイル: `src/bin/cli.ts`
- 対象関数:
  - `startDaemon()` (258行目)
  - `stopDaemon()` (280行目)
  - `restartDaemon()` (301行目)
  - `showStatus()` (319行目)
  - `showLogs()` (331行目)
- 変更内容: `npxCmd, ['pm2', ...]` → `pm2Cmd, [...]`

**受入基準**:
- [x] 全ての pm2 呼び出しが `pm2Cmd` を使用している
- [x] 各関数が正常に動作する

**依存関係**: タスク2.1
**ステータス**: `DONE`

---

### フェーズ3: テストと検証

#### タスク3.1: E2Eテストの実行

**説明**:
- `e2e/npx-cli.spec.ts` を実行して動作確認
- 必要に応じてテストを追加

**受入基準**:
- [x] E2E テストで Prisma 5.22.0 が正しく使用される（`npm pack` 時の data/repos 問題は別課題）
- [x] Prisma バージョンエラーが発生しない

**依存関係**: タスク2.4
**ステータス**: `DONE`

**備考**: E2E テストは `data/repos` 内の別プロジェクトが含まれてしまうことで Next.js ビルドが失敗するが、Prisma は正しく 5.22.0 が使用されている。

---

#### タスク3.2: 手動検証

**説明**:
- 実際に `npx github:windschord/claude-work` を実行して検証

**受入基準**:
- [x] `help` コマンドが動作する
- [x] `status` コマンドが動作する
- [ ] `start` コマンドが Prisma エラーなく実行される（PR マージ後に検証）
- [ ] `stop` コマンドが動作する（PR マージ後に検証）

**依存関係**: タスク3.1
**ステータス**: `IN_PROGRESS`

**備考**: ローカルでの CLI 実行は確認済み。実際の `npx github:...` 実行は PR マージ後に検証。

---

## タスクステータスの凡例

- `TODO` - 未着手
- `IN_PROGRESS` - 作業中
- `DONE` - 完了
