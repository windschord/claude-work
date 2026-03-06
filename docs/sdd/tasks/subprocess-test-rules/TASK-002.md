# TASK-002: cli.tsのspawnSync呼び出しテストを追加

## 概要

`src/bin/cli.ts`のspawnSync呼び出しを行う関数に対して、`cwd`と`env`オプションを検証するユニットテストを新規作成する。

## 関連ドキュメント

- 要件: [US-001](../../requirements/subprocess-test-rules/stories/US-001.md) @../../requirements/subprocess-test-rules/stories/US-001.md
- 設計: [cli-test](../../design/subprocess-test-rules/components/cli-test.md) @../../design/subprocess-test-rules/components/cli-test.md
- 決定: [DEC-001](../../design/subprocess-test-rules/decisions/DEC-001.md)

## 実装対象ファイル

- **変更**: `src/bin/cli.ts` - テスト対象関数をexport
- **新規**: `src/bin/__tests__/cli.test.ts` - テストファイル

## テスト対象関数

| 関数名 | spawnSyncの用途 | 検証するcwd | 検証するenv |
|--------|----------------|-------------|------------|
| `buildNext()` | npm run build:next | projectRoot | NODE_ENV=production |
| `startDaemon()` | pm2 start | projectRoot | NODE_ENV=production, PORT |
| `stopDaemon()` | pm2 stop | projectRoot | - |
| `restartDaemon()` | pm2 restart | projectRoot | NODE_ENV=production |
| `showStatus()` | pm2 status | projectRoot | - |

## 実装手順（TDD）

### 1. cli.tsの関数をexport

`src/bin/cli.ts`の以下の関数に`export`を追加:
- `buildNext`
- `startDaemon`
- `stopDaemon`
- `restartDaemon`
- `showStatus`

また、`projectRoot`もexportする（テストでの検証用）。

### 2. テスト作成

`src/bin/__tests__/cli.test.ts`を新規作成:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// child_processをモック
vi.mock('child_process', () => ({
  spawnSync: vi.fn(() => ({ status: 0 })),
  spawn: vi.fn(() => ({ on: vi.fn() })),
}));

// fsをモック（resolvePm2Cmd用）
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: vi.fn(() => false),
      readFileSync: actual.readFileSync,
    },
    existsSync: vi.fn(() => false),
  };
});

// cli-utilsをモック
vi.mock('../cli-utils', () => ({
  checkNextBuild: vi.fn(() => true),
  checkDatabase: vi.fn(() => true),
  migrateDatabase: vi.fn(() => true),
}));

// dotenvをモック
vi.mock('dotenv', () => ({
  default: { config: vi.fn() },
  config: vi.fn(),
}));

import { spawnSync } from 'child_process';

describe('cli.ts spawnSync cwd/env検証', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buildNext', () => {
    it('spawnSyncにprojectRootをcwdとして渡す', async () => {
      const { buildNext, projectRoot } = await import('../cli');
      buildNext();
      expect(spawnSync).toHaveBeenCalledWith(
        expect.any(String),
        ['run', 'build:next'],
        expect.objectContaining({
          cwd: projectRoot,
          stdio: 'inherit',
          env: expect.objectContaining({ NODE_ENV: 'production' }),
        })
      );
    });

    it('cwdがprocess.cwd()ではなくprojectRootである', async () => {
      const { buildNext } = await import('../cli');
      buildNext();
      const options = vi.mocked(spawnSync).mock.calls[0][2] as { cwd?: string };
      expect(options?.cwd).toBeDefined();
      expect(options?.cwd).not.toBe(process.cwd());
    });
  });

  // startDaemon, stopDaemon, restartDaemon, showStatus も同様のパターン
});
```

### 3. テスト実行（失敗確認）

```bash
npx vitest run src/bin/__tests__/cli.test.ts
```

### 4. テストコミット

### 5. 実装（cli.tsにexport追加）

### 6. テスト実行（成功確認）

```bash
npx vitest run src/bin/__tests__/cli.test.ts
```

### 7. 実装コミット

## 受入基準

- [x] `src/bin/__tests__/cli.test.ts`が存在する
- [x] buildNext()のテストでcwdとenvが検証されている
- [x] startDaemon()のテストでcwdとenvが検証されている
- [x] stopDaemon()のテストでcwdが検証されている
- [x] restartDaemon()のテストでcwdとenvが検証されている
- [x] showStatus()のテストでcwdが検証されている
- [x] cwdがprocess.cwd()ではないことを検証するテストがある
- [x] `npx vitest run src/bin/__tests__/cli.test.ts`で全テスト通過
- [x] 既存テスト（`npm test`）に影響がない

## 情報の明確性

| 分類 | 内容 |
|------|------|
| 明示された情報 | テスト対象関数、検証項目、モック戦略 |
| 不明/要確認の情報 | cli.tsのモジュール副作用をどの程度モックする必要があるか（実装時に調整） |

## 推定工数

30分

## ステータス

DONE
