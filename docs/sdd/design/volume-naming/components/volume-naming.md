# コンポーネント設計: volume-naming

## 概要

Volume名の生成・バリデーションを担うユーティリティモジュール。フロントエンド・バックエンド共用。

## ファイルパス

`src/lib/volume-naming.ts`

## インターフェース

```typescript
/** Volume種別 */
type VolumeType = 'repo' | 'config';

/** Volume種別ごとのプレフィックス */
const VOLUME_PREFIX: Record<VolumeType, string> = {
  repo: 'cw-repo',
  config: 'cw-config',
};

/** Docker Volume名の正規表現制約 */
const DOCKER_VOLUME_NAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/;

/**
 * 入力文字列からDockerVolume名に使用可能なスラッグを生成する
 *
 * 変換ルール:
 * 1. 小文字に変換
 * 2. ASCII英数字とハイフン以外を除去
 * 3. 連続するハイフンを1つに統合
 * 4. 先頭・末尾のハイフンを除去
 * 5. 結果が空の場合、フォールバック文字列を返す（呼び出し元が短縮UUIDを指定）
 */
function generateSlug(name: string): string;

/**
 * Volume名を生成する（重複チェックなし）
 *
 * @returns `cw-{type}-{slug}` 形式の文字列
 */
function generateVolumeName(type: VolumeType, name: string, fallbackId?: string): string;

/**
 * 既存Volume名のリストを受け取り、重複しない一意なVolume名を生成する
 * 重複時は `-2`, `-3` ... のサフィックスを追加
 */
function generateUniqueVolumeName(
  type: VolumeType,
  name: string,
  existingNames: string[],
  fallbackId?: string
): string;

/**
 * Docker Volume名のバリデーション
 * @returns 有効なら true
 */
function validateVolumeName(name: string): boolean;
```

## 処理フロー

### generateSlug

```text
入力: "My Project!!"
→ 小文字: "my project!!"
→ ASCII英数字・ハイフン以外を除去: "my-project"
→ 連続ハイフン統合: "my-project"
→ 先頭末尾ハイフン除去: "my-project"
→ 出力: "my-project"
```

```text
入力: "日本語プロジェクト"
→ 小文字: "日本語プロジェクト"
→ ASCII英数字・ハイフン以外を除去: ""
→ 空のためフォールバック: fallbackId (例: "a1b2c3d4")
```

### generateUniqueVolumeName

```text
baseName = generateVolumeName('repo', 'my-project')  // "cw-repo-my-project"
if baseName not in existingNames → return baseName
suffix = 2
while `${baseName}-${suffix}` in existingNames → suffix++
return `${baseName}-${suffix}`
```

## テスト方針

- 純粋関数のため、単体テストで全パターンを網羅
- テストファイル: `src/lib/__tests__/volume-naming.test.ts`

## 関連要件

- REQ-001-001, REQ-001-002, REQ-001-003, REQ-001-004, REQ-001-005
