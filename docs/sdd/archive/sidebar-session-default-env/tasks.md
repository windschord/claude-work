# タスク管理: サイドメニューセッション作成時のデフォルト環境バグ修正

## タスク一覧

| ID | タスク | ステータス | 推定時間 |
|----|--------|-----------|---------|
| TASK-001 | テスト作成: レースコンディション再現テスト | completed | 20分 |
| TASK-002 | 修正実装: CreateSessionModalのレースコンディション修正 | completed | 20分 |
| TASK-003 | 全テスト実行・検証 | completed | 10分 |

---

## TASK-001: テスト作成: レースコンディション再現テスト

### 概要
CreateSessionModalのレースコンディションを再現するテストケースを作成する。

### 受入基準
- [ ] プロジェクトにenvironment_id(Docker)が設定されている場合のテストが存在する
- [ ] 環境リストがプロジェクト情報より先に読み込まれるシナリオがテストされている
- [ ] テストが修正前のコードで失敗することを確認

### TDD手順
1. `src/components/sessions/__tests__/CreateSessionModal.test.tsx` に新しいテストケースを追加
2. テスト実行 → 失敗確認
3. コミット

### 実装指示

既存の`CreateSessionModal.test.tsx`を確認し、以下のテストを追加:

```typescript
describe('デフォルト環境選択', () => {
  it('プロジェクトにenvironment_idが設定されている場合、その環境が初期選択される', async () => {
    // プロジェクトAPIがDocker環境のIDを返すようモック
    // 環境リストにHOSTとDOCKERの両方が存在
    // モーダルを開いてレンダリング
    // Docker環境が選択されていることを検証
  });
});
```

---

## TASK-002: 修正実装: CreateSessionModalのレースコンディション修正

### 概要
`CreateSessionModal.tsx` のuseEffectのレースコンディションを修正する。

### 受入基準
- [ ] `isProjectFetched` 状態が追加されている
- [ ] fetchProject完了後に `isProjectFetched` が `true` になる
- [ ] 環境選択useEffectが `isProjectFetched` を条件に含む
- [ ] `!selectedEnvironmentId` ガードが削除されている
- [ ] モーダル閉じた時に `selectedEnvironmentId` と `isProjectFetched` がリセットされる
- [ ] TASK-001のテストが全てパスする

### 実装指示

`src/components/sessions/CreateSessionModal.tsx` を以下の通り修正:

1. `isProjectFetched` 状態を追加:
   ```typescript
   const [isProjectFetched, setIsProjectFetched] = useState(false);
   ```

2. fetchProject useEffect内で完了フラグを設定:
   - `finally`ブロックで `setIsProjectFetched(true)` を呼ぶ
   - useEffect冒頭で `setIsProjectFetched(false)` をリセット

3. 環境選択useEffectの条件を変更:
   - `!selectedEnvironmentId` → `isProjectFetched`
   - 依存配列から `selectedEnvironmentId` を削除

4. モーダルリセットuseEffectに追加:
   - `setSelectedEnvironmentId('')` を追加
   - `setIsProjectFetched(false)` を追加

---

## TASK-003: 全テスト実行・検証

### 概要
全テストを実行し、修正が既存機能に影響しないことを確認する。

### 受入基準
- [ ] `npx vitest run` が全テストパス
- [ ] lint エラーなし

### 実装指示
```bash
npx vitest run
npm run lint
```
