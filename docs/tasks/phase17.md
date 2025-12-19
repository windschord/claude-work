# Phase 17: テストコード修正と改善

## 概要

Phase 16実装後の動作確認で発見されたテストコードの問題を修正します。すべての機能APIは実装済みですが、テストコードにNext.js 15のApp Router対応やモックの不備があり、一部のテストが失敗しています。

## 実装計画

### フェーズ17.1: RunScriptManagerテストの修正

#### タスク17.1.1: spawnイベントモックの修正

**説明**:
`src/services/__tests__/run-script-manager.test.ts`のモックを修正し、`spawn`イベントを正しく発火させる。

**現在の問題**:
- すべてのテストが10秒でタイムアウト
- モックの`spawn`イベントが発火していないため、`runScript()`メソッドのPromiseが解決されない

**実装手順（TDD）**:
1. モックコードの確認: `beforeEach`内のモック設定を確認
2. `spawn`イベントの追加: `mockSpawn`が呼ばれた時に`spawn`イベントを発火するよう修正
3. テスト実行: すべてのRunScriptManagerテストが通過することを確認
4. コミット: 修正内容をコミット

**技術的文脈**:
- テストフレームワーク: Vitest
- モック対象: Node.js child_process.spawn
- 既存のモックパターン: `vi.hoisted()`, `vi.mock()`

**受入基準**:
- [ ] `spawn`イベントが正しく発火するようモックが修正されている
- [ ] `pid`が設定されたモックプロセスが返される
- [ ] すべてのRunScriptManagerテスト（10個）が通過する
- [ ] テストのタイムアウトが発生しない
- [ ] コミットメッセージが変更内容を明確に説明している

**依存関係**: なし

**推定工数**: 30分（AIエージェント作業時間）

**ステータス**: `TODO`

---

#### タスク17.1.2: プロセスイベントハンドラーのテスト追加

**説明**:
RunScriptManagerの新しい機能（errorリスナーのクリーンアップ、タイムアウトクリーンアップ、stopping状態）のテストを追加する。

**実装手順（TDD）**:
1. テスト作成: Phase 16で追加された機能のテストケースを作成
   - errorリスナーがspawn後に削除されることを確認
   - killTimeoutがプロセス終了時にクリアされることを確認
   - stop()呼び出し時にstatus='stopping'になることを確認
2. テスト実行: すべてのテストが通過することを確認
3. コミット: テストコードをコミット

**技術的文脈**:
- Phase 16で追加された機能を参照
- src/services/run-script-manager.ts:107-115（errorリスナークリーンアップ）
- src/services/run-script-manager.ts:183-185（タイムアウトクリーンアップ）
- src/services/run-script-manager.ts:220（stopping状態）

**受入基準**:
- [ ] errorリスナークリーンアップのテストが追加されている
- [ ] タイムアウトクリーンアップのテストが追加されている
- [ ] stopping状態のテストが追加されている
- [ ] すべてのテストが通過する
- [ ] テストカバレッジが向上している

**依存関係**: タスク17.1.1が完了していること

**推定工数**: 40分（AIエージェント作業時間）

**ステータス**: `TODO`

---

### フェーズ17.2: Scripts APIテストの修正

#### タスク17.2.1: paramsモックの修正（POST）

**説明**:
`src/app/api/projects/[project_id]/scripts/__tests__/route.test.ts`のPOSTテストで、Next.js 15のPromise型`params`を正しくモックする。

**現在の問題**:
```
Invalid `prisma.project.findUnique()` invocation:
{
  where: {
    id: undefined,
    ...
  }
}
```
`project_id`が正しく渡されていない。

**実装手順（TDD）**:
1. 既存テストコードの確認: POSTリクエストのテストを確認
2. paramsモックの修正: `params`を`Promise.resolve({ project_id: 'test-id' })`として渡す
3. テスト実行: POSTテストが通過することを確認
4. コミット: 修正内容をコミット

**技術的文脈**:
- Next.js 15 App Router: `params`は`Promise<{ project_id: string }>`型
- テストで使用しているモックライブラリ: Vitest
- 参考実装: 他のAPIルートのテストコード

**受入基準**:
- [ ] POSTテストで`params`が正しくモックされている
- [ ] `project_id`がundefinedにならない
- [ ] "should create run script successfully"テストが通過する
- [ ] "should create run script without description"テストが通過する
- [ ] Prismaのエラーが発生しない

**依存関係**: なし

**推定工数**: 20分（AIエージェント作業時間）

**ステータス**: `TODO`

---

#### タスク17.2.2: paramsモックの修正（GET）

**説明**:
`src/app/api/projects/[project_id]/scripts/__tests__/route.test.ts`のGETテストで、`params`を正しくモックする。

**実装手順（TDD）**:
1. 既存テストコードの確認: GETリクエストのテストを確認
2. paramsモックの修正: タスク17.2.1と同様に修正
3. テスト実行: GETテストが通過することを確認
4. コミット: 修正内容をコミット

**受入基準**:
- [ ] GETテストで`params`が正しくモックされている
- [ ] "should return 200 and list of run scripts"テストが通過する
- [ ] "should return empty array when no scripts exist"テストが通過する
- [ ] すべてのScripts APIテスト（8個）が通過する

**依存関係**: タスク17.2.1が完了していること

**推定工数**: 15分（AIエージェント作業時間）

**ステータス**: `TODO`

---

### フェーズ17.3: Scripts Update APIテストの修正

#### タスク17.3.1: PUT paramsモックの修正

**説明**:
`src/app/api/projects/[project_id]/scripts/[scriptId]/__tests__/route.test.ts`のPUTテストで、`params`を正しくモックする。

**実装手順（TDD）**:
1. 既存テストコードの確認: PUTリクエストのテストを確認
2. paramsモックの修正: `params`を`Promise.resolve({ project_id: 'test-id', scriptId: 'test-script-id' })`として渡す
3. テスト実行: PUTテストが通過することを確認
4. コミット: 修正内容をコミット

**技術的文脈**:
- Next.js 15 App Router: `params`は`Promise<{ project_id: string; scriptId: string }>`型
- 複数のパラメータを含むため、両方を正しくモックする必要がある

**受入基準**:
- [ ] PUTテストで`params`が正しくモックされている
- [ ] `project_id`と`scriptId`の両方が正しく渡される
- [ ] "should update run script successfully"テストが通過する
- [ ] "should update only specified fields"テストが通過する
- [ ] すべてのScripts Update APIテスト（7個）が通過する

**依存関係**: なし

**推定工数**: 20分（AIエージェント作業時間）

**ステータス**: `TODO`

---

### フェーズ17.4: Diff APIテストの修正

#### タスク17.4.1: Diffアサーションの確認と修正

**説明**:
`src/app/api/sessions/[id]/diff/__tests__/route.test.ts`の"should return diff with added, modified, and deleted files"テストを修正する。

**現在の問題**:
- テストが失敗しているが、エラーの詳細は不明
- タイムアウトではないため、アサーションの失敗と推測される

**実装手順**:
1. テスト実行: 失敗の詳細を確認
2. 期待値の確認: テストの期待値とAPIレスポンスを比較
3. テスト修正: アサーションを修正
4. テスト実行: テストが通過することを確認
5. コミット: 修正内容をコミット

**技術的文脈**:
- Git diff形式の理解が必要
- APIレスポンス形式: `{ diff: { files: [...], totalAdditions, totalDeletions } }`
- テストで使用されるGitコマンドの出力形式を確認

**受入基準**:
- [ ] テスト失敗の原因が特定されている
- [ ] アサーションが正しい期待値に修正されている
- [ ] "should return diff with added, modified, and deleted files"テストが通過する
- [ ] すべてのDiff APIテスト（3個）が通過する

**依存関係**: なし

**推定工数**: 30分（AIエージェント作業時間）

**ステータス**: `TODO`

---

### フェーズ17.5: 新規実装APIのテスト追加

#### タスク17.5.1: プロンプト履歴APIテストの作成

**説明**:
Phase 16で実装されたプロンプト履歴API（GET /api/prompts, POST /api/prompts, DELETE /api/prompts/{id}）のテストを作成する。

**実装手順（TDD）**:
1. テストファイル作成: `src/app/api/prompts/__tests__/route.test.ts`を作成
2. テストケース作成:
   - GET: プロンプト履歴一覧取得
   - POST: プロンプト保存
   - 認証エラー（401）
3. テスト実行: すべてのテストが通過することを確認
4. コミット: テストコードをコミット

**技術的文脈**:
- 実装コード: `src/app/api/prompts/route.ts`
- 認証が必要なAPI
- レスポンス形式: `{ prompts: [...] }`, `{ prompt: {...} }`

**受入基準**:
- [ ] GETエンドポイントのテストが3つ以上ある
- [ ] POSTエンドポイントのテストが3つ以上ある
- [ ] 認証チェックのテストが含まれている
- [ ] すべてのテストが通過する
- [ ] ESLintエラーがない

**依存関係**: なし

**推定工数**: 40分（AIエージェント作業時間）

**ステータス**: `TODO`

---

#### タスク17.5.2: プロンプト削除APIテストの作成

**説明**:
`DELETE /api/prompts/{id}`エンドポイントのテストを作成する。

**実装手順（TDD）**:
1. テストファイル作成: `src/app/api/prompts/[id]/__tests__/route.test.ts`を作成
2. テストケース作成:
   - DELETE: プロンプト削除成功
   - DELETE: 存在しないプロンプト（404）
   - 認証エラー（401）
3. テスト実行: すべてのテストが通過することを確認
4. コミット: テストコードをコミット

**受入基準**:
- [ ] DELETEエンドポイントのテストが3つ以上ある
- [ ] 認証チェックのテストが含まれている
- [ ] すべてのテストが通過する
- [ ] ESLintエラーがない

**依存関係**: タスク17.5.1が完了していること

**推定工数**: 30分（AIエージェント作業時間）

**ステータス**: `TODO`

---

#### タスク17.5.3: ランスクリプト実行APIテストの作成

**説明**:
Phase 16で実装されたランスクリプト実行API（POST /api/sessions/{id}/run）のテストを作成する。

**実装手順（TDD）**:
1. テストファイル確認: `src/app/api/sessions/[id]/run/__tests__/route.test.ts`が存在するか確認
2. テストケース作成:
   - POST: スクリプト実行成功（202レスポンス、run_id返却）
   - POST: 存在しないスクリプト（404）
   - POST: 認証エラー（401）
   - POST: 所有権エラー（403）
3. モック設定: RunScriptManagerをモック
4. テスト実行: すべてのテストが通過することを確認
5. コミット: テストコードをコミット

**技術的文脈**:
- 実装コード: `src/app/api/sessions/[id]/run/route.ts`
- 依存サービス: RunScriptManager
- レスポンス形式: `{ run_id: "uuid" }`（202 Accepted）

**受入基準**:
- [ ] POSTエンドポイントのテストが4つ以上ある
- [ ] RunScriptManagerが正しくモックされている
- [ ] 認証と所有権チェックのテストが含まれている
- [ ] すべてのテストが通過する
- [ ] ESLintエラーがない

**依存関係**: タスク17.1.1が完了していること（RunScriptManagerのモックが必要）

**推定工数**: 50分（AIエージェント作業時間）

**ステータス**: `TODO`

---

#### タスク17.5.4: ランスクリプト停止APIテストの作成

**説明**:
Phase 16で実装されたランスクリプト停止API（POST /api/sessions/{id}/run/{run_id}/stop）のテストを作成する。

**実装手順（TDD）**:
1. テストファイル確認: `src/app/api/sessions/[id]/run/[run_id]/stop/__tests__/route.test.ts`が存在するか確認
2. テストケース作成:
   - POST: スクリプト停止成功
   - POST: 存在しないrun_id（404）
   - POST: 認証エラー（401）
   - POST: 所有権エラー（403）
3. モック設定: RunScriptManagerをモック
4. テスト実行: すべてのテストが通過することを確認
5. コミット: テストコードをコミット

**受入基準**:
- [ ] POSTエンドポイントのテストが4つ以上ある
- [ ] RunScriptManagerが正しくモックされている
- [ ] 認証と所有権チェックのテストが含まれている
- [ ] すべてのテストが通過する
- [ ] ESLintエラーがない

**依存関係**: タスク17.5.3が完了していること

**推定工数**: 40分（AIエージェント作業時間）

**ステータス**: `TODO`

---

#### タスク17.5.5: コミットリセットAPIテストの作成

**説明**:
Phase 16で実装されたコミットリセットAPI（POST /api/sessions/{id}/reset）のテストを作成する。

**実装手順（TDD）**:
1. テストファイル確認: `src/app/api/sessions/[id]/reset/__tests__/route.test.ts`が存在するか確認
2. テストケース作成:
   - POST: リセット成功
   - POST: 無効なcommit_hash形式（400）
   - POST: 認証エラー（401）
   - POST: 所有権エラー（403）
3. モック設定: GitServiceをモック
4. テスト実行: すべてのテストが通過することを確認
5. コミット: テストコードをコミット

**技術的文脈**:
- 実装コード: `src/app/api/sessions/[id]/reset/route.ts`
- 依存サービス: GitService.reset()
- リクエスト形式: `{ commit_hash: "abc123" }`
- commit_hashバリデーション: `/^[0-9a-f]{4,40}$/i`

**受入基準**:
- [ ] POSTエンドポイントのテストが4つ以上ある
- [ ] GitServiceが正しくモックされている
- [ ] commit_hashバリデーションのテストが含まれている
- [ ] 認証と所有権チェックのテストが含まれている
- [ ] すべてのテストが通過する
- [ ] ESLintエラーがない

**依存関係**: なし

**推定工数**: 45分（AIエージェント作業時間）

**ステータス**: `TODO`

---

### フェーズ17.6: Reactテスト警告の解消

#### タスク17.6.1: act()警告の解消

**説明**:
複数のコンポーネントテストで発生している`act(...)`警告を解消する。

**現在の警告**:
```
An update to TestComponent inside a test was not wrapped in act(...).

When testing, code that causes React state updates should be wrapped into act(...):

act(() => {
  /* fire events that update state */
});
```

**実装手順**:
1. 警告箇所の特定: 警告が発生しているテストファイルを特定
   - `src/hooks/__tests__/useTerminal.test.ts`
   - `src/components/settings/__tests__/AddRunScriptModal.test.tsx`
2. act()でラップ: 状態更新を引き起こすコードを`act()`でラップ
3. テスト実行: 警告が消えることを確認
4. コミット: 修正内容をコミット

**技術的文脈**:
- Testing Library: `@testing-library/react`
- act()のインポート: `import { act } from '@testing-library/react'`
- 状態更新のタイミング: 非同期操作、イベントハンドラー

**受入基準**:
- [ ] useTerminalテストのact()警告が解消されている
- [ ] AddRunScriptModalテストのact()警告が解消されている
- [ ] すべてのテストが通過する
- [ ] テスト実行時に警告が表示されない

**依存関係**: なし

**推定工数**: 30分（AIエージェント作業時間）

**ステータス**: `TODO`

---

## 検証基準

### テスト実行

```bash
npm test
```

すべてのテストが通過することを確認：
- RunScriptManagerテスト: 10/10通過
- Scripts APIテスト: 8/8通過
- Scripts Update APIテスト: 7/7通過
- Diff APIテスト: 3/3通過
- 新規APIテスト（追加分）: すべて通過
- 警告: なし

### ESLint

```bash
npx eslint src/
```

エラー: 0

### TypeScript

```bash
npx tsc --noEmit
```

既存のエラーは許容（今回の修正範囲外）

---

## 総推定工数

約5時間30分（AIエージェント作業時間）

---

## 補足事項

### 優先度

- 🔴 高: フェーズ17.1, 17.2, 17.3（既存テストの修正）
- 🟡 中: フェーズ17.4, 17.5（Diff修正、新規APIテスト）
- 🟢 低: フェーズ17.6（警告解消）

### 注意事項

1. **実装コードは修正しない**
   - すべての機能は実装済み
   - テストコードのみを修正する

2. **Next.js 15対応**
   - `params`は`Promise`型になっている
   - テストで`await params`または`Promise.resolve()`を使用

3. **モックの一貫性**
   - 他のテストファイルのモックパターンを参考にする
   - RunScriptManagerやGitServiceのモックは既存パターンを踏襲

4. **TDD原則**
   - 新規テストは必ずTDDサイクルで作成
   - テスト → 実装 → リファクタリング

---

## 参考資料

- [Vitest公式ドキュメント](https://vitest.dev/)
- [Next.js 15 App Router](https://nextjs.org/docs/app)
- [Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- 検証レポート: `docs/verification-report-phase16-issues.md`
