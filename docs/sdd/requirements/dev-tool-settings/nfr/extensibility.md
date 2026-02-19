# 拡張性要件

> 非機能要件カテゴリ: 拡張性

## 概要

開発ツール設定管理機能は、将来的に他の開発ツール設定（npm、Python pip、環境変数など）を追加できるように、拡張可能な設計を採用する必要があります。

## 要件一覧

### NFR-EXT-001: 設定タイプの拡張可能性

**EARS記法**: システムは Git 設定と SSH 鍵以外の設定タイプを追加する際、既存コードへの影響を最小限に抑えた拡張ができなければならない

**測定基準**:
- 指標: 新しい設定タイプ追加時の変更範囲
- 目標値: 5 ファイル以内の変更で新しい設定タイプを追加できること
- 測定方法:
  - コードレビューで変更ファイル数を確認
  - 拡張性テスト（仮想的な npm 設定追加）

**関連する機能要件**: なし（アーキテクチャレベルの要件）

**優先度**: 中

**検証方法**:
- [ ] DeveloperSettings テーブルに新しいカラム（例: `npm_registry`）を追加し、既存機能が影響を受けないことを確認
- [ ] 新しい設定カテゴリ用のサブスキーマを追加しても、既存の Git 設定と SSH 鍵が正常動作することを確認
- [ ] 設定適用ロジック（`DockerAdapter.injectDeveloperSettings`）が新しい設定タイプに対応できることを確認

**拡張可能な設計ポイント**:
1. **柔軟なデータベーススキーマ**:
   - JSON カラムの使用（オプション設定の格納）
   - 設定タイプごとのサブテーブル（必要に応じて）

2. **プラグイン的な設定適用ロジック**:
   - 各設定タイプの適用処理を独立した関数/クラスに分離
   - 新しい設定タイプは新しい適用関数を追加するだけ

3. **UI のモジュール化**:
   - 設定カテゴリごとにコンポーネントを分離
   - 新しいタブやセクションを追加しやすい構造

---

### NFR-EXT-002: 環境別設定の拡張可能性

**EARS記法**: もし将来的に ExecutionEnvironment ごとの設定を追加する場合、システムは現在のグローバル/プロジェクト設定構造を維持したまま拡張できなければならない

**測定基準**:
- 指標: 環境別設定追加時のデータマイグレーションの複雑さ
- 目標値: 既存データの移行なしで環境別設定を追加できること
- 測定方法:
  - データベーススキーマ設計レビュー
  - マイグレーション戦略の文書化

**関連する機能要件**: なし（将来の拡張）

**優先度**: 低

**検証方法**:
- [ ] DeveloperSettings テーブルに `environment_id` カラムを追加する設計をレビュー
- [ ] 既存のグローバル/プロジェクト設定が、環境別設定追加後も動作することを確認
- [ ] 優先順位ロジック（環境別 > プロジェクト別 > グローバル）が実装可能であることを確認

**将来の拡張イメージ**:

現在の優先順位:
```
プロジェクト設定 > グローバル設定
```

将来の拡張後:
```
環境別プロジェクト設定 > プロジェクト設定 > 環境別グローバル設定 > グローバル設定
```

**スキーマ拡張案**:
```prisma
model DeveloperSettings {
  id             String   @id @default(uuid())
  scope          Scope    // GLOBAL, PROJECT, ENVIRONMENT_GLOBAL, ENVIRONMENT_PROJECT
  project_id     String?  // プロジェクトID（PROJECT/ENVIRONMENT_PROJECT の場合）
  environment_id String?  // 環境ID（ENVIRONMENT_* の場合）
  git_username   String?
  git_email      String?
  // ... 他のフィールド
}
```

---

## 拡張性維持のための推奨事項

### コードの分離

- **設定の読み取りロジック**: `DeveloperSettingsService` に集約
- **設定の適用ロジック**: `DockerAdapter` と `HostAdapter` に実装
- **UI コンポーネント**: 設定カテゴリごとに独立したコンポーネント

### インターフェースの定義

```typescript
interface SettingApplier {
  apply(settings: DeveloperSettings, context: ExecutionContext): Promise<void>;
}

class GitSettingApplier implements SettingApplier { /* ... */ }
class SshKeyApplier implements SettingApplier { /* ... */ }
// 将来的な拡張:
// class NpmSettingApplier implements SettingApplier { /* ... */ }
```

### ドキュメント化

- 拡張ポイントを明確に文書化（README, 設計ドキュメント）
- 新しい設定タイプ追加手順のガイド作成
