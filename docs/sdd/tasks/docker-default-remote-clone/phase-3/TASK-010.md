# TASK-010: CreateSessionModalの環境選択をDocker優先に変更

## 説明

- 対象ファイル: `src/components/sessions/CreateSessionModal.tsx`（既存を拡張）
- セッション作成時の環境選択でDockerをデフォルトに変更
- `is_default=true`の環境を優先的に選択
- 環境一覧の表示順をDocker→Host→SSHに変更

## 技術的文脈

- フレームワーク: React（関数コンポーネント、hooks使用）
- UI: Tailwind CSS
- 環境データ取得: `useEnvironments` hook
- 参照すべき既存コード: `src/components/sessions/CreateSessionModal.tsx`

## 実装手順（TDD）

1. テスト拡張: `src/components/sessions/__tests__/CreateSessionModal.test.tsx`
2. テスト実行: 失敗を確認
3. テストコミット
4. 実装: 環境選択のデフォルト値とソート順を変更
5. テスト実行: 通過を確認
6. 実装コミット

## 実装仕様

### 1. デフォルト環境の選択

**現状の動作:**
- 環境が選択されていない、または最初のHOST環境を選択

**変更後の動作:**
- `is_default=true`の環境を優先的に選択
- デフォルト環境がない場合は最初のDocker環境を選択
- Dockerもない場合は最初の環境を選択

**実装例:**
```typescript
useEffect(() => {
  if (environments.length > 0 && !selectedEnvironmentId) {
    // is_default=trueの環境を探す
    const defaultEnv = environments.find(env => env.is_default);

    if (defaultEnv) {
      setSelectedEnvironmentId(defaultEnv.id);
    } else {
      // デフォルトがない場合は最初のDocker環境
      const dockerEnv = environments.find(env => env.type === 'DOCKER');
      setSelectedEnvironmentId(dockerEnv?.id || environments[0].id);
    }
  }
}, [environments, selectedEnvironmentId]);
```

### 2. 環境一覧の表示順

**現状の動作:**
- 作成順、またはランダム

**変更後の動作:**
- Docker → Host → SSH の順に表示
- 各タイプ内では`is_default=true`を最初に表示

**実装例:**
```typescript
const sortedEnvironments = useMemo(() => {
  const typeOrder = { DOCKER: 1, HOST: 2, SSH: 3 };

  return [...environments].sort((a, b) => {
    // タイプ順でソート
    const typeCompare = (typeOrder[a.type] || 99) - (typeOrder[b.type] || 99);
    if (typeCompare !== 0) return typeCompare;

    // 同じタイプ内ではis_default=trueを優先
    if (a.is_default && !b.is_default) return -1;
    if (!a.is_default && b.is_default) return 1;

    return 0;
  });
}, [environments]);
```

### 3. UIの改善（オプション）

**デフォルト環境の視覚的表示:**
- デフォルト環境に「デフォルト」バッジを追加
- 色: 緑系（bg-green-100、text-green-800）

**例:**
```tsx
{env.is_default && (
  <span className="ml-2 px-2 py-0.5 text-xs font-medium text-green-800 bg-green-100 rounded">
    デフォルト
  </span>
)}
```

## テスト仕様

### 追加テストケース

1. **デフォルト環境の自動選択**
   - is_default=trueの環境が存在する場合、それが選択される
   - デフォルトがない場合、最初のDocker環境が選択される
   - Dockerもない場合、最初の環境が選択される

2. **環境一覧のソート順**
   - Docker環境が最初に表示される
   - Host環境が2番目に表示される
   - SSH環境が最後に表示される
   - is_default=trueの環境が各タイプ内で最初に表示される

## 受入基準

- [ ] `src/components/sessions/CreateSessionModal.tsx`が拡張されている
- [ ] デフォルト環境が優先的に選択される
- [ ] 環境一覧がDocker→Host→SSHの順で表示される
- [ ] is_default=trueの環境が各タイプ内で最初に表示される
- [ ] テストが追加されている（既存+3件以上）
- [ ] `npm test`で全テスト通過
- [ ] ESLintエラーがゼロ
- [ ] TypeScriptの型エラーがゼロ

## 依存関係

- TASK-003（EnvironmentService.ensureDefaultEnvironment）

## 推定工数

30分

## ステータス

`DONE`

## 備考

- 既存のCreateSessionModalコンポーネントを拡張
- 環境データは`useEnvironments` hookから取得
- Docker主体への移行を反映したUX改善
