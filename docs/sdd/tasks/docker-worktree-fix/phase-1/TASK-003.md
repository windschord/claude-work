# TASK-003: 統合テストとデバッグ

## 説明

実際のDocker環境でセッションを作成し、すべての機能が正常に動作することを確認する。

## 対象ファイル

- 全体の統合テスト
- バグ修正

## 技術的文脈

- Hello-Worldプロジェクト（Docker環境）でテスト
- Shell、Diff、Commitsタブの動作確認
- Host環境への影響確認

## 実装手順

### 1. テストシナリオ準備

**テストプロジェクト**: Hello-World（Docker環境）

### 2. 統合テスト実行

#### テスト1: セッション作成

```bash
# APIでセッション作成
curl -X POST http://localhost:3000/api/projects/{project_id}/sessions \
  -H "Content-Type: application/json" \
  -d '{"source_branch": "main"}'

# レスポンス確認
# - status: "running"
# - worktree_path: "/repo/.worktrees/session-XXXXX"
```

#### テスト2: PTY接続

```bash
# WebSocket接続してコマンド実行
wscat -c ws://localhost:3000/ws/claude/{session_id}

# コマンド実行
pwd
# 期待値: /repo/.worktrees/session-XXXXX

ls
# worktree内のファイル一覧が表示される
```

#### テスト3: Shell操作

```bash
# Shellタブでコマンド実行
cd /repo/.worktrees/session-XXXXX
git status
# 正常に動作することを確認
```

#### テスト4: Diff表示

```bash
# ファイルを編集
echo "test" >> README.md

# Diff API呼び出し
curl http://localhost:3000/api/sessions/{session_id}/diff

# diffが正常に返されることを確認
```

#### テスト5: Commits表示

```bash
# Commits API呼び出し
curl http://localhost:3000/api/sessions/{session_id}/commits

# コミット履歴が返されることを確認
```

### 3. Host環境の動作確認

claude-workプロジェクト（Host環境）でセッション作成し、既存機能が正常に動作することを確認。

### 4. エラーハンドリング確認

```bash
# 存在しないworktreeパスでセッション作成
# → エラーが適切に処理され、サーバーがクラッシュしないことを確認
```

### 5. バグ修正

テスト中に発見したバグを修正。

## 受入基準

- [ ] Docker環境で新規セッションを作成できる
- [ ] Claudeタブでコマンドを実行できる
- [ ] Shellタブで操作できる
- [ ] Diffタブでdiffを表示できる
- [ ] Commitsタブでコミット履歴を表示できる
- [ ] Host環境セッションが正常に動作する
- [ ] エラー発生時もサーバーがクラッシュしない
- [ ] エラーログが適切に出力される

## 依存関係

TASK-001, TASK-002

## 推定工数

40分

## ステータス

TODO
