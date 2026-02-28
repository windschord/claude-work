# TASK-001: volume-naming.tsユーティリティのテスト・実装

## 説明

Docker Volume名を生成するユーティリティモジュールを新規作成する。

- 対象ファイル:
  - `src/lib/volume-naming.ts` (新規)
  - `src/lib/__tests__/volume-naming.test.ts` (新規)
- 設計書: `docs/sdd/design/volume-naming/components/volume-naming.md`

## 技術的文脈

- 純粋関数のみで構成（外部依存なし）
- フロントエンド・バックエンド共用
- Docker Volume名制約: `[a-zA-Z0-9][a-zA-Z0-9_.-]*`

## 実装手順（TDD）

### 1. テスト作成: `src/lib/__tests__/volume-naming.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { generateSlug, generateVolumeName, generateUniqueVolumeName, validateVolumeName } from '../volume-naming';

describe('generateSlug', () => {
  it('英数字とハイフンのみを含む文字列はそのまま小文字化', () => {});
  it('スペースをハイフンに変換', () => {});
  it('特殊文字を除去', () => {});
  it('連続ハイフンを1つに統合', () => {});
  it('先頭末尾のハイフンを除去', () => {});
  it('全て非ASCII文字の場合、空文字列を返す', () => {});
  it('空文字列を入力した場合、空文字列を返す', () => {});
});

describe('generateVolumeName', () => {
  it('repo種別でVolume名を生成', () => {});
  it('config種別でVolume名を生成', () => {});
  it('スラッグが空の場合、fallbackIdを使用', () => {});
});

describe('generateUniqueVolumeName', () => {
  it('重複がない場合、サフィックスなし', () => {});
  it('重複がある場合、-2サフィックスを追加', () => {});
  it('連続する重複の場合、次の番号を使用', () => {});
});

describe('validateVolumeName', () => {
  it('有効なVolume名を受け入れ', () => {});
  it('先頭が非英数字の場合、拒否', () => {});
  it('無効な文字を含む場合、拒否', () => {});
  it('空文字列を拒否', () => {});
});
```

### 2. テスト実行: 失敗を確認
```bash
npx vitest run src/lib/__tests__/volume-naming.test.ts
```

### 3. テストコミット

### 4. 実装: `src/lib/volume-naming.ts`
- `generateSlug(name: string): string`
- `generateVolumeName(type: 'repo' | 'config', name: string, fallbackId?: string): string`
- `generateUniqueVolumeName(type, name, existingNames, fallbackId?): string`
- `validateVolumeName(name: string): boolean`

### 5. テスト通過確認・実装コミット

## 受入基準

- [ ] `src/lib/volume-naming.ts` が存在する
- [ ] `src/lib/__tests__/volume-naming.test.ts` が存在する
- [ ] 全テストケースが通過する
- [ ] `npx vitest run src/lib/__tests__/volume-naming.test.ts` がパスする

## 依存関係

なし

## 推定工数

30分

## ステータス

TODO
