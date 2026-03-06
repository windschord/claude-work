# コンポーネント設計: cli.ts spawnSyncテスト

## 概要

`src/bin/cli.ts`の各関数が`spawnSync`を呼び出す際の`cwd`/`env`オプションを検証するユニットテストを追加する。

## 対象ファイル

- **新規**: `src/bin/__tests__/cli.test.ts`
- **参照**: `src/bin/cli.ts`

## テスト対象関数

| 関数名 | spawnSyncの用途 | cwd | env |
|--------|----------------|-----|-----|
| `buildNext()` | npm run build:next | projectRoot | NODE_ENV=production |
| `startDaemon()` | pm2 start | projectRoot | NODE_ENV=production, PORT |
| `stopDaemon()` | pm2 stop | projectRoot | なし |
| `restartDaemon()` | pm2 restart | projectRoot | NODE_ENV=production |
| `showStatus()` | pm2 status | projectRoot | なし |

## モック戦略

`cli.ts`はモジュールトップレベルで`projectRoot`を計算し、各関数はモジュールスコープ変数を参照する。テストでは以下をモックする:

```typescript
// child_processをモック
vi.mock('child_process', () => ({
  spawnSync: vi.fn(() => ({ status: 0 })),
  spawn: vi.fn(() => ({ on: vi.fn() })),
}));

// fsをモック（resolvePm2Cmd用）
vi.mock('fs');

// cli-utilsをモック
vi.mock('../cli-utils');

// dotenvをモック
vi.mock('dotenv');
```

## アサーションパターン

各テストで以下を検証:

```typescript
expect(spawnSync).toHaveBeenCalledWith(
  expect.any(String),       // コマンド
  expect.any(Array),        // 引数
  expect.objectContaining({
    cwd: expect.stringContaining(''),  // cwdが文字列であること
    stdio: 'inherit',
  })
);

// envが渡される場合は追加検証
const options = vi.mocked(spawnSync).mock.calls[0][2];
expect(options?.cwd).toBeDefined();
expect(options?.cwd).not.toBe('/tmp');  // process.cwd()ではないこと
```

## 注意事項

- `cli.ts`はモジュール読み込み時にトップレベルで副作用がある（`projectRoot`計算、`process.argv`参照等）
- テストでは`process.argv`を事前に設定してからモジュールを動的importする必要がある
- `process.exit()`をモックして実際の終了を防ぐ
