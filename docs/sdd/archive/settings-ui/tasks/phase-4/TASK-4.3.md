# タスク4.3: /settings/appページでのBackButtonとUnsavedChangesDialogの統合

## 情報の明確性チェック

### ユーザーから明示された情報

- [x] 対象ページ: `/settings/app`
- [x] 追加機能1: BackButtonをページ上部に配置
- [x] 追加機能2: フォーム変更検知（useState）
- [x] 追加機能3: 未保存変更時の警告ダイアログ表示
- [x] 保存時の処理: 変更フラグをリセット

### 不明/要確認の情報

なし（設計書で全て明確化済み）

---

## 説明

`/settings/app` ページに BackButton と UnsavedChangesDialog を統合し、フォーム変更検知機能を実装します。

**対象ファイル**:
- 修正: `src/app/settings/app/page.tsx`
- 修正: `src/app/settings/app/__tests__/page.test.tsx`（テスト追加）

**技術的文脈**:
- フレームワーク: Next.js 15 (App Router)
- TypeScript: 型安全な実装
- React: useState for change tracking
- 既存コンポーネント: BackButton, UnsavedChangesDialog

**参照すべき設計書**:
- `docs/sdd/design/settings-ui/index.md` - コンポーネント6: AppSettingsPage（拡張）

## 実装手順（TDD）

### 1. テスト追加

`src/app/settings/app/__tests__/page.test.tsx` に以下のテストケースを追加：

```typescript
describe('AppSettingsPage - BackButton統合', () => {
  it('BackButtonが表示される', () => {
    render(<AppSettingsPage />);
    expect(screen.getByText('設定に戻る')).toBeInTheDocument();
  });

  it('フォーム変更時にhasUnsavedChangesフラグが立つ', async () => {
    render(<AppSettingsPage />);
    await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());

    const timeoutInput = screen.getByLabelText(/タイムアウト時間/);
    fireEvent.change(timeoutInput, { target: { value: '10' } });

    // 変更フラグが立っていることを間接的に確認（戻るボタンクリック時の挙動）
    const backButton = screen.getByText('設定に戻る');
    fireEvent.click(backButton);

    // ダイアログが表示される
    expect(screen.getByText('未保存の変更があります')).toBeInTheDocument();
  });

  it('保存後にhasUnsavedChangesフラグがリセットされる', async () => {
    // API mockを設定
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ config: { git_clone_timeout_minutes: 5, debug_mode_keep_volumes: false } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ config: { git_clone_timeout_minutes: 10, debug_mode_keep_volumes: false } }),
      });

    render(<AppSettingsPage />);
    await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());

    const timeoutInput = screen.getByLabelText(/タイムアウト時間/);
    fireEvent.change(timeoutInput, { target: { value: '10' } });

    const saveButton = screen.getByText('保存');
    fireEvent.click(saveButton);

    await waitFor(() => expect(screen.queryByText('保存中...')).not.toBeInTheDocument());

    // 保存後、戻るボタンをクリックしてもダイアログが表示されない
    const backButton = screen.getByText('設定に戻る');
    fireEvent.click(backButton);

    expect(screen.queryByText('未保存の変更があります')).not.toBeInTheDocument();
    expect(mockPush).toHaveBeenCalledWith('/settings');
  });

  it('ダイアログで「キャンセル」を選択すると現在のページに留まる', async () => {
    render(<AppSettingsPage />);
    await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());

    const timeoutInput = screen.getByLabelText(/タイムアウト時間/);
    fireEvent.change(timeoutInput, { target: { value: '10' } });

    const backButton = screen.getByText('設定に戻る');
    fireEvent.click(backButton);

    const cancelButton = screen.getByText('キャンセル');
    fireEvent.click(cancelButton);

    expect(screen.queryByText('未保存の変更があります')).not.toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('ダイアログで「破棄して戻る」を選択すると/settingsに遷移する', async () => {
    render(<AppSettingsPage />);
    await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());

    const timeoutInput = screen.getByLabelText(/タイムアウト時間/);
    fireEvent.change(timeoutInput, { target: { value: '10' } });

    const backButton = screen.getByText('設定に戻る');
    fireEvent.click(backButton);

    const discardButton = screen.getByText('破棄して戻る');
    fireEvent.click(discardButton);

    expect(mockPush).toHaveBeenCalledWith('/settings');
  });
});
```

### 2. テスト実行（失敗確認）

```bash
npm test -- src/app/settings/app/__tests__/page.test.tsx
```

### 3. テストコミット

```bash
git add src/app/settings/app/__tests__/page.test.tsx
git commit -m "test: AppSettingsPageにBackButtonとUnsavedChangesDialogのテストを追加"
```

### 4. 実装

`src/app/settings/app/page.tsx` を修正：

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { BackButton } from '@/components/settings/BackButton';
import { UnsavedChangesDialog } from '@/components/settings/UnsavedChangesDialog';

interface AppConfig {
  git_clone_timeout_minutes: number;
  debug_mode_keep_volumes: boolean;
}

export default function AppSettingsPage() {
  const router = useRouter();
  const [_config, setConfig] = useState<AppConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [timeoutMinutes, setTimeoutMinutes] = useState(5);
  const [keepVolumes, setKeepVolumes] = useState(false);

  // 新規追加: 未保存変更の管理
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/settings/config');

        if (!response.ok) {
          throw new Error('設定の取得に失敗しました');
        }

        const data = await response.json();
        const config = data.config;
        if (!config) {
          throw new Error('設定の取得に失敗しました');
        }
        setConfig(config);
        setTimeoutMinutes(config.git_clone_timeout_minutes ?? 5);
        setKeepVolumes(config.debug_mode_keep_volumes ?? false);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '設定の取得に失敗しました';
        toast.error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchConfig();
  }, []);

  // 新規追加: タイムアウト値変更時の処理
  const handleTimeoutChange = (value: number) => {
    setTimeoutMinutes(value);
    setHasUnsavedChanges(true);
  };

  // 新規追加: デバッグモード変更時の処理
  const handleKeepVolumesChange = (checked: boolean) => {
    setKeepVolumes(checked);
    setHasUnsavedChanges(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isLoading || _config === null) {
      toast.error('設定の読み込みが完了していません');
      return;
    }

    if (!Number.isInteger(timeoutMinutes) || timeoutMinutes < 1 || timeoutMinutes > 30) {
      toast.error('タイムアウト時間は1から30の整数で指定してください');
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch('/api/settings/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          git_clone_timeout_minutes: timeoutMinutes,
          debug_mode_keep_volumes: keepVolumes,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || '設定の保存に失敗しました');
      }

      const data = await response.json();
      setConfig(data.config);
      setHasUnsavedChanges(false); // 新規追加: 保存後にフラグをリセット
      toast.success('設定を保存しました');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '設定の保存に失敗しました';
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  // 新規追加: 戻るボタンの前処理
  const handleBeforeNavigate = () => {
    if (hasUnsavedChanges) {
      setShowUnsavedDialog(true);
      return false; // ナビゲーション中断
    }
    return true; // ナビゲーション許可
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* 新規追加: 戻るボタン */}
      <div className="mb-4">
        <BackButton onBeforeNavigate={handleBeforeNavigate} />
      </div>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">アプリケーション設定</h1>

      <form onSubmit={handleSave} className="max-w-2xl">
        {/* Git Clone タイムアウト設定 */}
        <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Git Clone タイムアウト
          </h2>
          <div className="mb-4">
            <label
              htmlFor="timeout"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              タイムアウト時間（分）
            </label>
            <input
              id="timeout"
              type="number"
              min="1"
              max="30"
              value={timeoutMinutes}
              onChange={(e) => handleTimeoutChange(Number(e.target.value))} // 修正
              className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
              disabled={isSaving}
            />
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              リモートリポジトリのclone時のタイムアウト時間を設定します（1-30分）。
            </p>
          </div>
        </div>

        {/* デバッグモード設定 */}
        <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            デバッグモード
          </h2>
          <div className="mb-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={keepVolumes}
                onChange={(e) => handleKeepVolumesChange(e.target.checked)} // 修正
                className="w-4 h-4 text-blue-600 focus:ring-blue-500 rounded"
                disabled={isSaving}
              />
              <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                Dockerボリュームを保持する
              </span>
            </label>
            <p className="mt-2 ml-6 text-sm text-gray-500 dark:text-gray-400">
              エラー時やプロジェクト削除時にDockerボリュームを自動削除せず保持します。
              <br />
              デバッグやトラブルシューティング時に有効にしてください。
            </p>
          </div>
        </div>

        {/* 保存ボタン */}
        <div className="flex gap-3">
          <button
            type="submit"
            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            disabled={isSaving || isLoading || _config === null}
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSaving ? '保存中...' : '保存'}
          </button>
        </div>
      </form>

      {/* 新規追加: 未保存変更警告ダイアログ */}
      <UnsavedChangesDialog
        isOpen={showUnsavedDialog}
        onDiscard={() => {
          setShowUnsavedDialog(false);
          router.push('/settings');
        }}
        onCancel={() => setShowUnsavedDialog(false)}
      />
    </div>
  );
}
```

### 5. テスト実行（成功確認）

```bash
npm test -- src/app/settings/app/__tests__/page.test.tsx
```

### 6. 実装コミット

```bash
git add src/app/settings/app/page.tsx
git commit -m "feat: AppSettingsPageにBackButtonとUnsavedChangesDialogを統合

- BackButtonをページ上部に配置
- フォーム変更検知（hasUnsavedChanges）の実装
- 未保存変更時の警告ダイアログ表示
- 保存後の変更フラグリセット
- テスト追加

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

## 受入基準

- [ ] `src/app/settings/app/page.tsx` が修正されている
- [ ] BackButtonがページ上部に表示される
- [ ] フォーム変更時に `hasUnsavedChanges` フラグが立つ
- [ ] 未保存変更がある状態で戻るボタンをクリックするとダイアログが表示される
- [ ] ダイアログで「キャンセル」を選択すると現在のページに留まる
- [ ] ダイアログで「破棄して戻る」を選択すると `/settings` に遷移する
- [ ] 保存後に `hasUnsavedChanges` フラグがリセットされる
- [ ] テストが5つ以上追加されている
- [ ] `npm test`で全テスト通過
- [ ] ESLintエラーがゼロ

## 依存関係

- タスク4.1（BackButtonコンポーネント）
- タスク4.2（UnsavedChangesDialogコンポーネント）

## 推定工数

40分（AIエージェント作業時間）

## ステータス

`TODO`
