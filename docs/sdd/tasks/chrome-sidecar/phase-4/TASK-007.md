# TASK-007: 環境設定UI拡張 (Chrome Sidecarセクション)

## 説明

環境設定画面 (`/settings/environments`) のDocker環境編集フォームにChrome Sidecar設定セクションを追加する。トグルスイッチでサイドカーの有効/無効を切り替え、イメージ名・タグのカスタマイズを可能にする。

**対象ファイル**:
- `src/components/environments/` - 環境フォームコンポーネント（既存を拡張）
- `src/app/settings/environments/` - 環境設定ページ（必要に応じて拡張）

**設計書**: `docs/sdd/design/chrome-sidecar/components/environment-ui.md`

## 技術的文脈

- Docker環境 (`type === 'DOCKER'`) の場合のみセクションを表示
- トグルOFF時は image/tag フィールドを無効化
- トグルOFF時は config JSON から chromeSidecar キーを除外（後方互換性）
- Chrome Tag に "latest" が入力された場合は即時バリデーションエラーを表示
- デフォルト値: image = `ghcr.io/windschord/claude-work-sandbox`, tag = `chrome-devtools`

## TDD手順

### テストファイル

`src/components/environments/__tests__/chrome-sidecar-form.test.ts`

### テストケース

1. **Docker環境でChrome Sidecarセクションが表示されること**
   - type=DOCKERの環境編集時にセクションが存在すること

2. **HOST環境でChrome Sidecarセクションが非表示であること**
   - type=HOSTの環境編集時にセクションが存在しないこと

3. **トグルOFF時にimage/tagフィールドが無効化されること**
   - デフォルト状態（OFF）でフィールドがdisabledであること

4. **トグルON時にimage/tagフィールドが有効化されること**
   - トグルをONにするとフィールドが入力可能になること
   - デフォルト値が表示されること

5. **tag に "latest" を入力するとバリデーションエラーが表示されること**
   - "latest" 入力時に即座にエラーメッセージが表示されること
   - エラーメッセージ: "再現性のためバージョンを固定してください（latestは使用できません）"

6. **トグルOFF時にconfig JSONからchromeSidecarが除外されること**
   - トグルをONにしてからOFFに戻した場合、送信されるconfigにchromeSidecarキーが含まれないこと

7. **既存のchromeSidecar設定がフォームに正しく反映されること**
   - config内にchromeSidecarがある環境を編集する際、値がフィールドに表示されること

### 実装手順

1. テストファイル作成・テスト実行（RED確認）
2. 環境フォームコンポーネントにChrome Sidecarセクションを追加
   - トグルスイッチ (Enable Chrome Sidecar)
   - テキスト入力 (Chrome Image, Chrome Tag)
   - バリデーションロジック
3. フォーム送信時のconfig JSON構築ロジックを拡張
4. テスト実行（GREEN確認）

## 受入基準

- [ ] Docker環境のみセクションが表示されること
- [ ] トグルON/OFFでフィールドの有効/無効が切り替わること
- [ ] tag: "latest" がフロントエンドバリデーションで拒否されること
- [ ] トグルOFF時にchromeSidecarキーが送信データから除外されること
- [ ] 既存の環境設定が正しく読み込まれること
- [ ] 全テストケースがパスすること

**依存関係**: TASK-002 (型定義), TASK-004 (APIバリデーション)
**推定工数**: 35分
**ステータス**: `TODO`
