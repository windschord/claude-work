# TASK-008: セッションUI拡張 (デバッグポート表示・Chromeバッジ)

## 説明

セッション詳細画面にChromeデバッグポート情報を表示し、セッションリストにChromeバッジを追加する。

**対象ファイル**:
- `src/components/` - セッション詳細コンポーネント
- `src/components/` - セッションリストコンポーネント

**設計書**: `docs/sdd/design/chrome-sidecar/components/environment-ui.md` (セッション情報表示部分)

## 技術的文脈

- chrome_container_id が NULL でないセッションにのみ情報表示
- セッション詳細: "Chrome DevTools Debug" セクション (Status + Debug URL)
- セッションリスト: "Chrome" バッジ (オレンジ色)
- chrome_debug_port が NULL の場合: "Running (debug port unavailable)"
- chrome_debug_port が存在する場合: "Running - localhost:<port>"

## TDD手順

### テストファイル

`src/components/__tests__/session-chrome-info.test.ts`

### テストケース

#### セッション詳細画面

1. **サイドカーあり・ポートあり: デバッグ情報が表示されること**
   - "Chrome DevTools Debug" セクションが表示されること
   - "Running" ステータスが表示されること
   - "localhost:<port>" が表示されること

2. **サイドカーあり・ポートなし: ポート不明表示**
   - "Running (debug port unavailable)" が表示されること

3. **サイドカーなし: セクション非表示**
   - chrome_container_id が null のセッションでセクションが表示されないこと

#### セッションリスト

4. **サイドカーあり: Chromeバッジ表示**
   - "Chrome" バッジがオレンジ色で表示されること

5. **サイドカーなし: バッジ非表示**
   - Chromeバッジが表示されないこと

6. **混在リスト: 正しいバッジ表示**
   - サイドカーありセッションのみにバッジが表示されること

### 実装手順

1. テストファイル作成・テスト実行（RED確認）
2. セッション詳細コンポーネントに "Chrome DevTools Debug" セクションを追加
   - chrome_container_id の有無で表示/非表示を制御
   - chrome_debug_port の有無でURL表示を分岐
3. セッションリストコンポーネントにChromeバッジを追加
   - 既存の環境バッジ（HOST=green, DOCKER=blue）と同列に配置
4. テスト実行（GREEN確認）

## 受入基準

- [ ] サイドカー付きセッションの詳細にデバッグ情報が表示されること
- [ ] ポート不明時のフォールバック表示が正しいこと
- [ ] サイドカーなしセッションでは情報セクションが非表示であること
- [ ] セッションリストにChromeバッジが正しく表示されること
- [ ] 全テストケースがパスすること

**依存関係**: TASK-006 (Session API: chrome_container_id, chrome_debug_port レスポンス)
**推定工数**: 30分
**ステータス**: `TODO`
