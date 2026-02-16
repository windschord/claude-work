# SDD Documentation Skill 実行問題のフィードバック

## 報告日時

2026-02-14

## 問題の概要

`sdd-documentation:requirements-defining` スキルが実行中にハングアップし、40分以上経過しても応答がありませんでした。

## 発生状況

### コンテキスト

- **タスク**: Docker環境プロジェクトのworktree管理問題修正のためのSDD作成
- **使用スキル**: sdd-documentation:requirements-defining
- **引数**: 問題の詳細説明（約500文字）

### 実行結果

- スキル起動後、40分以上経過しても進捗なし
- 進捗表示なし、中間出力なし
- ユーザーによる中断が必要になった

## 根本原因分析

### 1. タイムアウト制御の欠如

**問題**:
- スキル実行に明示的なタイムアウトが設定されていない
- 長時間実行時のタイムアウト警告がない

**影響**:
- ユーザーはスキルが動作しているのか、ハングしているのか判断できない
- 無駄な待ち時間が発生

### 2. 進捗モニタリングの不足

**問題**:
- スキル内部の処理ステップが可視化されていない
- 「どの段階で止まっているのか」が不明

**影響**:
- デバッグが困難
- ユーザーの不安が増大

### 3. 明示/不明情報の分類処理

**問題**:
- スキルは「明示された情報」と「不明な情報」を分類し、不明点をユーザーに確認する設計
- しかし、この分類処理自体が複雑すぎる可能性
- 大量の文脈を処理する際に応答が停止

**影響**:
- 長文の要件説明で問題が顕在化
- スキルの使いやすさが低下

### 4. フォールバック戦略の不在

**問題**:
- スキルが失敗した場合の代替手段が明確でない
- エージェント自身が判断してフォールバックする仕組みがない

**影響**:
- ユーザーが手動介入を余儀なくされる

## 改善提案

### 優先度: 高

#### 1. タイムアウト制御の実装

```typescript
// スキル実行時のタイムアウト設定例
const SKILL_TIMEOUT = 5 * 60 * 1000; // 5分

// タイムアウト警告
const WARNING_THRESHOLD = 3 * 60 * 1000; // 3分

if (executionTime > WARNING_THRESHOLD) {
  console.warn(`Skill execution taking longer than expected: ${executionTime}ms`);
}

if (executionTime > SKILL_TIMEOUT) {
  throw new SkillTimeoutError('Skill execution timeout');
}
```

#### 2. 進捗モニタリングの追加

スキル内部で処理ステップを出力：

```text
[requirements-defining] Step 1/5: Reading input requirements...
[requirements-defining] Step 2/5: Classifying information (explicit vs unknown)...
[requirements-defining] Step 3/5: Generating EARS notation requirements...
[requirements-defining] Step 4/5: Creating user stories...
[requirements-defining] Step 5/5: Writing index.md...
[requirements-defining] Complete! Files created: 5
```

### 優先度: 中

#### 3. 情報分類処理の最適化

**現状の問題点**:
- 長文の要件説明を一度に全て分類しようとする
- LLMへの単一リクエストが重すぎる

**改善案**:
- 段階的な分類処理（チャンク分割）
- 必須情報のみを先に確認
- オプション情報は後回し

```text
Phase 1: 必須情報の確認（プロジェクト名、目的など）
  ↓
Phase 2: 機能要件の整理
  ↓
Phase 3: 非機能要件の整理
```

#### 4. フォールバック戦略の実装

```typescript
// スキルがタイムアウトした場合
if (skillTimeout) {
  console.log('Skill timeout detected. Falling back to manual document creation...');

  // テンプレートベースの簡易作成
  await createFromTemplate({
    type: 'requirements',
    mode: 'minimal', // 最小限の情報のみ
  });

  console.log('✓ Minimal requirements document created. You can enhance it manually.');
}
```

### 優先度: 低

#### 5. スキル実行ログの改善

- スキル開始/終了のログ
- 各ステップの処理時間ログ
- エラー発生時の詳細ログ

## 回避策（現在の運用）

スキルがハングした場合は、以下の手順で手動作成：

1. スキル実行を中断
2. テンプレートを参照して手動でMarkdownファイルを作成
3. Writeツールを使用してファイルを保存

**実績**:
- 手動作成時間: 約5分
- スキル待機時間: 40分以上
- **手動作成の方が8倍以上高速**

## 検証結果

### 成功した代替アプローチ

以下のドキュメントを手動作成し、正常に完了：

- `docs/sdd/requirements/docker-worktree-fix/index.md`
- `docs/sdd/requirements/docker-worktree-fix/stories/US-001.md`
- `docs/sdd/requirements/docker-worktree-fix/stories/US-002.md`
- `docs/sdd/requirements/docker-worktree-fix/nfr/reliability.md`
- `docs/sdd/requirements/docker-worktree-fix/nfr/compatibility.md`
- `docs/sdd/design/docker-worktree-fix/index.md`
- `docs/sdd/design/docker-worktree-fix/components/docker-adapter.md`
- `docs/sdd/tasks/docker-worktree-fix/index.md`
- `docs/sdd/tasks/docker-worktree-fix/phase-1/TASK-001.md`
- `docs/sdd/tasks/docker-worktree-fix/phase-1/TASK-002.md`
- `docs/sdd/tasks/docker-worktree-fix/phase-1/TASK-003.md`

すべてEARS記法に準拠し、要件・設計・タスクの整合性も確保されています。

## 推奨アクション

### スキル開発チームへ

1. **即座に実装**: タイムアウト制御（5分）
2. **優先実装**: 進捗モニタリング
3. **中期実装**: 情報分類処理の最適化
4. **検討**: フォールバック戦略

### エージェント運用への提案

- スキル実行は最大10分でタイムアウト
- タイムアウト時は自動的に手動作成にフォールバック
- ユーザーに状況を明確に報告

## まとめ

`sdd-documentation` スキルは有用なコンセプトですが、現状では実行信頼性に課題があります。特に長文の要件処理において、タイムアウトと進捗可視化の改善が急務です。

短期的には手動作成の方が効率的であり、スキルは補助ツールとして位置づけるべきです。

---

**報告者**: Claude Code セッション (claude-work プロジェクト)
**関連Issue**: なし（新規フィードバック）
**添付ログ**: なし（実行ログが出力されなかったため）
