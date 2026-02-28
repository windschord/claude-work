# TASK-001: PortCheckerサービスのテスト作成・実装

## 説明

ポート使用状況をチェックするバックエンドサービスを新規作成する。

- 対象ファイル:
  - テスト: `src/services/__tests__/port-checker.test.ts`
  - 実装: `src/services/port-checker.ts`
- 設計書: `docs/sdd/design/port-check/components/port-checker.md`

## 技術的文脈

- フレームワーク: Node.js
- 使用モジュール: `net`（ポートバインド試行）、Drizzle ORM（DB検索）
- テストフレームワーク: Vitest
- 参照すべき既存コード: `src/services/environment-service.ts`（DB操作パターン）

## 実装手順（TDD）

### 1. テスト作成: `src/services/__tests__/port-checker.test.ts`

テストケース:
1. **checkHostPort - ポートが空いている場合**: net.createServerのモックでlisten成功 → `available` を返す
2. **checkHostPort - ポートが使用中の場合**: EADDRINUSEエラー → `in_use` (source: 'os') を返す
3. **checkHostPort - 権限不足の場合**: EACCESエラー → `unknown` を返す
4. **checkHostPort - タイムアウトの場合**: 500ms超過 → `unknown` を返す
5. **checkClaudeWorkPorts - 他環境で使用中のポート検出**: DB に他環境の設定あり → `in_use` (source: 'claudework', usedBy: 環境名) を返す
6. **checkClaudeWorkPorts - excludeEnvironmentIdで自環境を除外**: 自環境IDを除外 → 競合なし
7. **checkClaudeWorkPorts - 他環境にポートマッピングなし**: → `available` を返す
8. **checkPorts - 複数ポートの一括チェック**: 3ポート指定 → 3件の結果を返す
9. **checkPorts - OS使用中とClaudeWork使用中の優先度**: 両方で検出 → `in_use`

### 2. テスト実行: 失敗を確認

```bash
npx vitest run src/services/__tests__/port-checker.test.ts
```

### 3. テストコミット

### 4. 実装: `src/services/port-checker.ts`

インターフェース:
```typescript
export type PortCheckStatus = 'available' | 'in_use' | 'unknown';

export interface PortCheckResult {
  port: number;
  status: PortCheckStatus;
  usedBy?: string;
  source?: 'os' | 'claudework';
}

export interface PortCheckRequest {
  ports: number[];
  excludeEnvironmentId?: string;
}

export class PortChecker {
  async checkPorts(request: PortCheckRequest): Promise<PortCheckResult[]>;
  private checkHostPort(port: number): Promise<PortCheckResult>;
  private checkClaudeWorkPorts(ports: number[], excludeEnvironmentId?: string): Promise<Map<number, PortCheckResult>>;
  private checkSinglePort(port: number, excludeEnvironmentId?: string): Promise<PortCheckResult>;
}
```

モック方針:
- `net.createServer` → `vi.mock('net')` でモック
- DB操作 → `vi.mock('@/lib/db')` でモック
- タイムアウト → `vi.useFakeTimers()` でテスト

### 5. テスト通過を確認、実装コミット

## 受入基準

- [ ] `src/services/__tests__/port-checker.test.ts` に9つ以上のテストケース
- [ ] `src/services/port-checker.ts` が存在する
- [ ] 全テストがパスする: `npx vitest run src/services/__tests__/port-checker.test.ts`
- [ ] ESLintエラーがゼロ
- [ ] PortCheckResult型が正しく定義されている

## 依存関係

なし

## 推定工数

40分

## ステータス

TODO
