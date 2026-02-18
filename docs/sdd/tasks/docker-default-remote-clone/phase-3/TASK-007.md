# TASK-007: RemoteRepoFormコンポーネントの実装

## 説明

- 対象ファイル: `src/components/projects/RemoteRepoForm.tsx`（新規作成）
- リモートリポジトリからクローンするためのフォームコンポーネントを実装
- Clone API (`POST /api/projects/clone`) を呼び出してプロジェクトを登録
- URL入力、プロジェクト名、clone先選択機能を含む

## 技術的文脈

- フレームワーク: React（関数コンポーネント、hooks使用）
- UI: Tailwind CSS、Headless UI
- バリデーション: RemoteRepoServiceのvalidateRemoteUrl()を活用
- 状態管理: useState、useEffectを使用
- 参照すべき既存コード: `src/components/projects/AddProjectModal.tsx`

## 実装手順（TDD）

1. テスト作成: `src/components/projects/__tests__/RemoteRepoForm.test.tsx`
2. テスト実行: 失敗を確認
3. テストコミット
4. 実装: RemoteRepoFormコンポーネントを作成
5. テスト実行: 通過を確認
6. 実装コミット

## コンポーネント仕様

### Props

```typescript
interface RemoteRepoFormProps {
  onSuccess?: (project: Project) => void;
  onCancel?: () => void;
}
```

### フォームフィールド

1. **URL入力** (必須)
   - プレースホルダー: `git@github.com:user/repo.git または https://github.com/user/repo.git`
   - バリデーション: SSH/HTTPS形式をチェック
   - エラー表示: 無効な形式の場合

2. **プロジェクト名** (任意)
   - プレースホルダー: `リポジトリ名（未入力の場合はURLから自動抽出）`
   - 初期値: 空欄（APIがURLから自動抽出）

3. **Clone先** (必須)
   - デフォルト: `docker`
   - 選択肢: `docker` / `host`
   - ラジオボタンまたはセレクトボックス

4. **送信ボタン**
   - ラベル: `クローン`
   - ローディング中は無効化
   - スピナー表示

5. **キャンセルボタン**
   - ラベル: `キャンセル`
   - onCancel()を呼び出し

### 動作フロー

1. URLを入力
2. プロジェクト名を入力（任意）
3. Clone先を選択（docker/host）
4. 「クローン」ボタンをクリック
5. Clone API (`POST /api/projects/clone`) を呼び出し
6. 成功: onSuccess()を呼び出し
7. 失敗: エラーメッセージを表示

## テスト仕様

### 必須テストケース

1. **フォーム表示**
   - URLフィールドが表示される
   - プロジェクト名フィールドが表示される
   - Clone先選択が表示される
   - クローンボタンが表示される

2. **URL検証**
   - 有効なSSH URLを受け付ける
   - 有効なHTTPS URLを受け付ける
   - 無効なURLでエラー表示

3. **API呼び出し**
   - 送信時にPOST /api/projects/cloneを呼び出す
   - 正しいリクエストボディ（url, name, cloneLocation）を送信
   - 成功時にonSuccess()を呼び出す

4. **エラー処理**
   - API失敗時にエラーメッセージを表示
   - 重複エラー（409）で適切なメッセージ表示

## 受入基準

- [ ] `src/components/projects/RemoteRepoForm.tsx`が存在する
- [ ] URLフィールドが実装されている
- [ ] プロジェクト名フィールドが実装されている
- [ ] Clone先選択が実装されている
- [ ] Clone API呼び出しが実装されている
- [ ] エラー処理が実装されている
- [ ] テストが8件以上ある
- [ ] `npm test`で全テスト通過
- [ ] ESLintエラーがゼロ
- [ ] TypeScriptの型エラーがゼロ

## 依存関係

- TASK-004（Clone API）

## 推定工数

40分

## ステータス

`TODO`

## 備考

- 既存のAddProjectModalを参考にUIを統一
- Clone先のデフォルトは`docker`（Docker主体への移行）
- ローディング状態を適切に管理
