# TASK-004: Environment APIバリデーション

## 説明

環境APIの作成・更新エンドポイント (`POST /api/environments`, `PUT /api/environments/:id`) に `chromeSidecar` config のバリデーションロジックを追加する。

**対象ファイル**:
- `src/app/api/environments/route.ts` - POSTエンドポイントにバリデーション追加
- `src/app/api/environments/[id]/route.ts` - PUTエンドポイントにバリデーション追加
- `src/app/api/environments/__tests__/` - テスト

**設計書**: `docs/sdd/design/chrome-sidecar/api/environment-api.md`

## 技術的文脈

- chromeSidecarキーはオプション（省略時は enabled: false として扱う）
- enabled: true の場合のみ image, tag のバリデーションを実行
- image: `[-a-z0-9._/]+` パターンに適合する文字列
- tag: 空文字不可、`latest` 不可（再現性のためバージョン固定必須）
- HOST環境の場合は chromeSidecar が含まれていても無視（エラーにはしない）

## TDD手順

### テストファイル

`src/app/api/environments/__tests__/chrome-sidecar-validation.test.ts`

### テストケース

1. **chromeSidecarキー省略時: バリデーション成功**
   - configにchromeSidecarがない場合、既存動作と同じく成功すること

2. **enabled: false の場合: image/tagバリデーションスキップ**
   - enabled: false であれば image, tag の内容に関わらず成功すること

3. **正常な設定: バリデーション成功**
   - `{ enabled: true, image: "ghcr.io/windschord/claude-work-sandbox", tag: "chrome-devtools" }` が成功すること

4. **enabled が boolean でない場合: 400エラー**
   - `enabled: "true"` や `enabled: 1` でエラーが返ること
   - エラーメッセージに "chromeSidecar.enabled" が含まれること

5. **image が不正な場合: 400エラー**
   - 空文字列、大文字を含む文字列、特殊文字を含む文字列でエラーが返ること
   - エラーメッセージに "chromeSidecar.image" が含まれること

6. **tag が空文字の場合: 400エラー**
   - 空文字列でエラーが返ること

7. **tag が "latest" の場合: 400エラー**
   - "latest" で専用のエラーメッセージが返ること

8. **HOST環境でchromeSidecarが含まれる場合: エラーなし**
   - HOST環境のconfig内にchromeSidecarが存在しても無視されること

9. **PUTエンドポイントでも同じバリデーションが適用されること**
   - PUT /api/environments/:id に不正なchromeSidecar設定を送信して400が返ること

### 実装手順

1. テストファイル作成・テスト実行（RED確認）
2. `validateChromeSidecarConfig` 関数を実装（設計書のロジックに従う）
3. POST/PUT エンドポイントのバリデーション処理に組み込み
4. テスト実行（GREEN確認）

## 受入基準

- [ ] chromeSidecarキー省略時にバリデーションエラーが発生しないこと
- [ ] enabled: true 時に image, tag の正規表現バリデーションが動作すること
- [ ] tag: "latest" が明確に拒否されること
- [ ] HOST環境での chromeSidecar 設定が無視されること（エラーにならない）
- [ ] POST と PUT の両エンドポイントで同じバリデーションが適用されること
- [ ] 全テストケースがパスすること

**依存関係**: TASK-002 (型定義: ChromeSidecarConfig)
**推定工数**: 25分
**ステータス**: `TODO`
