# 設計書: サイドメニューセッション作成時のデフォルト環境バグ修正

## 概要

`CreateSessionModal`コンポーネントにおける環境選択のレースコンディションを修正する。

## 現在のアーキテクチャと問題点

### 現在のフロー

```text
モーダルオープン
├── useEnvironments() → 環境リスト取得（高速、キャッシュ可能）
├── fetchProject() → プロジェクトのenvironment_id取得（API呼び出し、遅い）
└── useEffect[選択] → 環境リスト到着時にデフォルト選択を決定
    └── !selectedEnvironmentIdガード → 一度選択されると再実行しない ← バグの原因
```

### バグの発生パターン

1. モーダルオープン
2. `useEnvironments()` が先に完了 → `sortedEnvironments` にデータあり
3. `projectEnvironmentId` はまだ `null`（fetchProject未完了）
4. useEffect が実行: `!selectedEnvironmentId`(true) かつ `projectEnvironmentId`(null) → else分岐 → HOSTのデフォルト環境を選択
5. fetchProject完了 → `projectEnvironmentId` にDocker環境IDがセット
6. useEffect が再実行: `!selectedEnvironmentId`(false) → 早期リターン、更新されない

## 修正設計

### アプローチ: プロジェクト情報取得完了を待機してから環境を選択

`isProjectFetched` 状態を追加し、環境の初期選択をプロジェクト情報の取得完了後に行うようにする。

### 変更ファイル

#### 1. `src/components/sessions/CreateSessionModal.tsx`

**変更内容**:

1. `isProjectFetched` 状態を追加（初期値: `false`）
2. fetchProjectのuseEffect内でフェッチ完了時に `isProjectFetched` を `true` に設定
3. 環境選択のuseEffectの条件に `isProjectFetched` を追加
4. `!selectedEnvironmentId` ガードを削除（代わりに `isProjectFetched` で制御）
5. モーダルが閉じた時に `isProjectFetched` と `selectedEnvironmentId` をリセット

**修正前**:
```typescript
const [projectEnvironmentId, setProjectEnvironmentId] = useState<string | null>(null);

// fetchProject useEffect
useEffect(() => {
  // ...fetchProject...
  setProjectEnvironmentId(data.project?.environment_id || null);
}, [isOpen, projectId]);

// 環境選択 useEffect
useEffect(() => {
  if (!isEnvironmentsLoading && sortedEnvironments.length > 0 && !selectedEnvironmentId) {
    if (projectEnvironmentId) {
      setSelectedEnvironmentId(projectEnvironmentId);
    } else {
      // デフォルト環境を選択
    }
  }
}, [sortedEnvironments, isEnvironmentsLoading, selectedEnvironmentId, projectEnvironmentId]);
```

**修正後**:
```typescript
const [projectEnvironmentId, setProjectEnvironmentId] = useState<string | null>(null);
const [isProjectFetched, setIsProjectFetched] = useState(false);

// fetchProject useEffect
useEffect(() => {
  if (!isOpen || !projectId) {
    return;
  }
  setIsProjectFetched(false);
  const fetchProject = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}`);
      if (response.ok) {
        const data = await response.json();
        setProjectEnvironmentId(data.project?.environment_id || null);
      }
    } catch {
      setProjectEnvironmentId(null);
    } finally {
      setIsProjectFetched(true);
    }
  };
  fetchProject();
}, [isOpen, projectId]);

// 環境選択 useEffect
useEffect(() => {
  if (!isEnvironmentsLoading && sortedEnvironments.length > 0 && isProjectFetched) {
    if (projectEnvironmentId) {
      setSelectedEnvironmentId(projectEnvironmentId);
    } else {
      const defaultEnv = sortedEnvironments.find((env) => env.is_default);
      if (defaultEnv) {
        setSelectedEnvironmentId(defaultEnv.id);
      } else {
        const dockerEnv = sortedEnvironments.find((env) => env.type === 'DOCKER');
        setSelectedEnvironmentId(dockerEnv?.id || sortedEnvironments[0].id);
      }
    }
  }
}, [sortedEnvironments, isEnvironmentsLoading, projectEnvironmentId, isProjectFetched]);

// モーダル閉じた時のリセット
useEffect(() => {
  if (!isOpen) {
    setError('');
    setClaudeOptions({});
    setCustomEnvVars({});
    setSelectedEnvironmentId('');
    setIsProjectFetched(false);
  }
}, [isOpen]);
```

#### 2. `src/components/sessions/__tests__/CreateSessionModal.test.tsx`

**追加テスト**:

1. プロジェクトにenvironment_idが設定されている場合にそのDocker環境が初期選択されることの検証
2. プロジェクトにenvironment_idが未設定の場合にis_defaultの環境が初期選択されることの検証
3. 環境リストがプロジェクト情報より先に読み込まれた場合でも正しい環境が選択されることの検証

## 技術的決定事項

| 決定事項 | 選択 | 根拠 |
|---------|------|------|
| 状態管理方式 | `isProjectFetched`フラグ追加 | 最小限の変更で問題を解決。AbortController等の複雑な仕組みは不要 |
| リセットタイミング | モーダル閉じた時 | 再オープン時に正しい環境が再選択されるようにする |
| ガード条件変更 | `!selectedEnvironmentId` → `isProjectFetched` | レースコンディションの根本原因を排除 |

## リスクと緩和策

| リスク | 影響度 | 緩和策 |
|-------|-------|--------|
| プロジェクト情報取得が遅い場合の遅延表示 | 低 | 既にローディング表示があるため影響軽微 |
| モーダル閉じた時のリセットで状態が不整合 | 低 | isOpen変更時にすべての関連状態をリセット |
