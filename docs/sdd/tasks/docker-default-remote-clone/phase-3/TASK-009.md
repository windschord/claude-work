# TASK-009: ProjectCardにリモートバッジと更新ボタンを追加

## 説明

- 対象ファイル: `src/components/projects/ProjectCard.tsx`（既存を拡張）
- リモートリポジトリから登録されたプロジェクトに「リモート」バッジを表示
- Pull API (`POST /api/projects/[id]/pull`) を呼び出す更新ボタンを追加
- 更新中の状態表示とエラー処理を実装

## 技術的文脈

- フレームワーク: React（関数コンポーネント、hooks使用）
- UI: Tailwind CSS、Lucide icons
- 参照すべき既存コード: `src/components/projects/ProjectCard.tsx`（既存）

## 実装手順（TDD）

1. テスト追加: `src/components/projects/__tests__/ProjectCard.test.tsx`（既存を拡張）
2. テスト実行: 失敗を確認
3. テストコミット
4. 実装: ProjectCardコンポーネントを拡張
5. テスト実行: 通過を確認
6. 実装コミット

## 実装仕様

### 1. リモートバッジの表示

**表示条件:**
- `project.remote_url`が存在する場合のみ表示

**デザイン:**
- アイコン: Lucide `GitBranch`
- テキスト: "リモート"
- 色: 青系（bg-blue-100、text-blue-800）
- 位置: プロジェクト名の横

**例:**
```tsx
{project.remote_url && (
  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-800 bg-blue-100 rounded">
    <GitBranch className="w-3 h-3" />
    リモート
  </span>
)}
```

### 2. 更新ボタンの追加

**表示条件:**
- `project.remote_url`が存在する場合のみ表示

**デザイン:**
- アイコン: Lucide `RefreshCw`
- ラベル: "更新"
- 色: グレー系（hover時にblue）
- ツールチップ: "リモートから最新の変更を取得"

**動作:**
1. ボタンクリック
2. `POST /api/projects/[id]/pull` を呼び出し
3. ローディング中: スピナーアイコンを回転
4. 成功: 緑の通知「プロジェクトを更新しました」
5. 失敗: 赤の通知「更新に失敗しました: [エラーメッセージ]」

**例:**
```tsx
<button
  onClick={handlePull}
  disabled={isPulling}
  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded"
>
  <RefreshCw className={cn("w-4 h-4", isPulling && "animate-spin")} />
  {isPulling ? '更新中...' : '更新'}
</button>
```

### 3. Pull API呼び出し

```typescript
const handlePull = async () => {
  setIsPulling(true);
  setError(null);

  try {
    const response = await fetch(`/api/projects/${project.id}/pull`, {
      method: 'POST',
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Pull failed');
    }

    const result = await response.json();

    if (result.updated) {
      // 成功通知（toast等）
      showSuccess('プロジェクトを更新しました');
    } else {
      showSuccess('既に最新の状態です');
    }
  } catch (error) {
    setError(error instanceof Error ? error.message : '更新に失敗しました');
    showError(error instanceof Error ? error.message : '更新に失敗しました');
  } finally {
    setIsPulling(false);
  }
};
```

## テスト仕様

### 追加テストケース

1. **リモートバッジ表示**
   - remote_url有りの場合に「リモート」バッジが表示される
   - remote_url無しの場合にバッジが表示されない

2. **更新ボタン表示**
   - remote_url有りの場合に「更新」ボタンが表示される
   - remote_url無しの場合にボタンが表示されない

3. **Pull API呼び出し**
   - 更新ボタンクリック時にPOST /api/projects/[id]/pullを呼び出す
   - 成功時に成功メッセージを表示
   - 失敗時にエラーメッセージを表示
   - 更新中はボタンが無効化される

## 受入基準

- [ ] `src/components/projects/ProjectCard.tsx`が拡張されている
- [ ] リモートバッジが実装されている
- [ ] 更新ボタンが実装されている
- [ ] Pull API呼び出しが実装されている
- [ ] ローディング状態が実装されている
- [ ] エラー処理が実装されている
- [ ] テストが追加されている（既存+5件以上）
- [ ] `npm test`で全テスト通過
- [ ] ESLintエラーがゼロ
- [ ] TypeScriptの型エラーがゼロ

## 依存関係

- TASK-005（Pull API）

## 推定工数

30分

## ステータス

`TODO`

## 備考

- 既存のProjectCardコンポーネントを拡張
- 通知はtoastライブラリ（react-hot-toast等）を使用
- アイコンはLucide Reactを使用
