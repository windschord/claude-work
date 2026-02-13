# 非機能要件: 保守性

## 概要

ハイブリッド設計の導入により、ホスト環境とDocker環境の2つの実装パスが存在する。コードの保守性を高め、将来の拡張や修正を容易にするための要件を定義する。

## 保守性要件

### NFR-MAINT-001: 既存実装との互換性
**Given** 既存のプロジェクトとセッションが存在する時、
**When** ハイブリッド設計が導入される時、
**Then** システムは以下を遵守しなければならない:
- 既存プロジェクトが引き続き動作する
- 既存セッションが引き続き動作する
- データベースマイグレーションが不要
- 既存のGitService実装を最大限活用

**根拠**: 既存ユーザーへの影響を最小限に抑え、スムーズな移行を実現する

### NFR-MAINT-002: コードの一貫性
**Given** ホスト環境とDocker環境の2つの実装パスが存在する時、
**When** 新しい機能を追加または修正する時、
**Then** システムは以下を遵守しなければならない:
- 共通ロジックは共通モジュールに実装
- 環境固有のロジックは明確に分離
- 同じ命名規則とコーディングスタイルを使用

**実装例**:
```typescript
// 共通インターフェース
interface GitOperations {
  cloneRepository(url: string, projectId: string): Promise<void>;
  createWorktree(projectId: string, sessionName: string): Promise<void>;
}

// ホスト環境実装
class HostGitOperations implements GitOperations {
  async cloneRepository(url: string, projectId: string): Promise<void> {
    // ホスト環境固有の実装
  }
}

// Docker環境実装
class DockerGitOperations implements GitOperations {
  async cloneRepository(url: string, projectId: string): Promise<void> {
    // Docker環境固有の実装
  }
}
```

**根拠**: コードの可読性を高め、バグの混入を防ぐ

### NFR-MAINT-003: エラーハンドリングの統一
**Given** git cloneまたはworktree作成が失敗する時、
**When** エラーハンドリングを実装する時、
**Then** システムは以下を遵守しなければならない:
- ホスト環境とDocker環境で同じエラー型を使用
- エラーメッセージの形式を統一
- エラーログの形式を統一
- クリーンアップ処理を必ず実行

**実装例**:
```typescript
class GitOperationError extends Error {
  constructor(
    message: string,
    public environment: 'host' | 'docker',
    public operation: 'clone' | 'worktree',
    public cause?: Error
  ) {
    super(message);
  }
}

// 使用例
try {
  await gitOperations.cloneRepository(url, projectId);
} catch (error) {
  throw new GitOperationError(
    'Failed to clone repository',
    'docker',
    'clone',
    error
  );
} finally {
  await cleanup();
}
```

**根拠**: エラーハンドリングの一貫性を保ち、デバッグを容易にする

### NFR-MAINT-004: ログ出力の統一
**Given** git cloneまたはworktree作成を実行する時、
**When** ログを出力する時、
**Then** システムは以下を遵守しなければならない:
- ログレベル（info, warn, error）を適切に使用
- 環境（host/docker）を明示
- 操作（clone/worktree）を明示
- 処理時間を記録

**実装例**:
```typescript
logger.info(`[${environment}] Starting ${operation}`, {
  projectId,
  url: sanitizeUrl(url),
  startTime: Date.now()
});

logger.info(`[${environment}] Completed ${operation}`, {
  projectId,
  duration: Date.now() - startTime
});

logger.error(`[${environment}] Failed ${operation}`, {
  projectId,
  error: error.message,
  duration: Date.now() - startTime
});
```

**根拠**: ログの可読性を高め、トラブルシューティングを容易にする

### NFR-MAINT-005: テストカバレッジ
**Given** 新しい機能を実装する時、
**When** テストを作成する時、
**Then** システムは以下を遵守しなければならない:
- ユニットテストカバレッジ: 80%以上
- E2Eテスト: 主要なユーザーフローをカバー
- ホスト環境とDocker環境の両方をテスト

**テスト対象**:
- プロジェクト登録（ホスト環境）
- プロジェクト登録（Docker環境）
- セッション作成（ホスト環境）
- セッション作成（Docker環境）
- エラーハンドリング（両環境）
- タイムアウト処理（両環境）

**根拠**: リグレッションを防ぎ、品質を維持する

### NFR-MAINT-006: ドキュメントの整備
**Given** 新しい機能を実装する時、
**When** ドキュメントを更新する時、
**Then** システムは以下を遵守しなければならない:
- CLAUDE.mdの更新（アーキテクチャ概要）
- コードコメントの追加（複雑なロジック）
- API仕様の更新（docs/API.md）
- 環境変数の文書化（docs/ENV_VARS.md）

**根拠**: 新しいメンバーのオンボーディングを容易にする

### NFR-MAINT-007: 設定の外部化
**Given** タイムアウト値やデバッグモード設定が存在する時、
**When** 設定を管理する時、
**Then** システムは以下を遵守しなければならない:
- ハードコーディングを避ける
- 設定ファイルまたは環境変数で管理
- デフォルト値を明示
- 設定の変更が即座に反映される

**実装例**:
```typescript
// 設定管理
class ConfigService {
  private config: Config;

  async load(): Promise<void> {
    // 設定ファイルから読み込み
    this.config = await readConfigFile();
  }

  getGitCloneTimeoutMinutes(): number {
    return this.config.git_clone_timeout_minutes ?? 5;
  }

  getDebugModeKeepVolumes(): boolean {
    return this.config.debug_mode_keep_volumes ?? false;
  }
}
```

**根拠**: 環境ごとの設定変更を容易にする

### NFR-MAINT-008: Dockerコマンドの抽象化
**Given** Docker環境でGit操作を実行する時、
**When** Dockerコマンドを実行する時、
**Then** システムは以下を遵守しなければならない:
- Dockerコマンドを専用のユーティリティクラスに集約
- コマンド生成ロジックとビジネスロジックを分離
- テスト可能な実装

**実装例**:
```typescript
class DockerCommandBuilder {
  buildGitCloneCommand(
    volumeId: string,
    url: string,
    authMounts: AuthMounts
  ): string[] {
    return [
      'docker', 'run', '--rm',
      '-v', `${volumeId}:/repo`,
      '-v', `${authMounts.sshDir}:/root/.ssh:ro`,
      '-v', `${authMounts.sshAuthSock}:/ssh-agent`,
      '-v', `${authMounts.gitconfig}:/root/.gitconfig:ro`,
      '-v', `${authMounts.ghConfig}:/root/.config/gh:ro`,
      '-e', 'SSH_AUTH_SOCK=/ssh-agent',
      'alpine/git', 'clone', url, '/repo'
    ];
  }
}
```

**根拠**: Dockerコマンドの再利用性を高め、テストを容易にする

### NFR-MAINT-009: データベーススキーマのバージョン管理
**Given** データベーススキーマに変更を加える時、
**When** スキーマを更新する時、
**Then** システムは以下を遵守しなければならない:
- Prismaマイグレーションファイルを作成
- スキーマ変更の目的をコメントに記載
- 既存データとの互換性を考慮

**実装例**:
```prisma
model Project {
  id             String   @id @default(uuid())
  name           String
  repository_url String

  // ハイブリッド設計: リポジトリの保存場所
  // 'host': ホスト環境（data/repos/）
  // 'docker': Docker環境（Dockerボリューム）
  // 既存プロジェクトはnullの場合、'host'として扱う
  cloneLocation  String?  @default("docker")

  // Docker環境の場合のボリューム名
  // 形式: claude-repo-<project-id>
  dockerVolumeId String?

  // ... 他のフィールド
}
```

**根拠**: スキーマ変更の意図を明確にし、保守性を高める

### NFR-MAINT-010: Git Worktreeの一貫した扱い
**Given** ホスト環境とDocker環境の両方でworktreeを使用する時、
**When** worktree構造を設計する時、
**Then** システムは以下を遵守しなければならない:
- 両方の環境で同じディレクトリ構造（.worktrees/）
- 同じブランチ命名規則（session/<session-name>）
- 同じworktree削除ロジック

**根拠**: 環境間の一貫性を保ち、混乱を避ける

## コード品質指標

### 目標指標

| 指標 | 目標値 |
|-----|-------|
| ユニットテストカバレッジ | 80%以上 |
| E2Eテストカバレッジ | 主要フロー100% |
| Lintエラー | 0 |
| TypeScript型エラー | 0 |
| コードコメント率 | 20%以上（複雑なロジックのみ） |

### 品質チェック

以下を継続的に実施：
- GitHub ActionsでのCI/CDテスト
- ESLintによる静的解析
- TypeScript型チェック
- Vitestによるユニットテスト
- Playwrightによるe2eテスト

## リファクタリング方針

### 優先的にリファクタリングすべき項目
1. 重複コード（ホスト環境とDocker環境）の共通化
2. 長すぎる関数（100行以上）の分割
3. 複雑すぎる条件分岐の簡素化
4. ハードコーディングされた値の設定外部化

### リファクタリング時の原則
- 既存のテストが通ることを確認
- 小さな変更を積み重ねる
- コミットメッセージに理由を明記
- レビューを必須とする

## 技術的負債の管理

### 現在の技術的負債
- ホスト環境とDocker環境のロジックが一部重複
- エラーハンドリングが統一されていない箇所
- テストカバレッジが不十分な箇所

### 負債返済計画
- Phase 1（実装時）: 新機能のテストカバレッジ80%以上
- Phase 2（リファクタリング）: 重複コードの共通化
- Phase 3（改善）: エラーハンドリングの完全統一

## 将来の拡張性

### 予想される拡張
- SSH環境のサポート
- プロジェクトごとのタイムアウト設定
- 保存場所の事後変更機能
- 並列clone処理

### 拡張のための設計
- 環境タイプの抽象化（HostGitOperations、DockerGitOperations）
- 設定の柔軟な管理（ConfigService）
- Dockerコマンドの抽象化（DockerCommandBuilder）

## ドキュメンテーション要件

### 必須ドキュメント
- [x] 要件定義（docs/requirements/）
- [ ] 技術設計（docs/design/）
- [ ] タスク分解（docs/tasks/）
- [ ] API仕様更新（docs/API.md）
- [ ] 環境変数文書化（docs/ENV_VARS.md）
- [ ] CLAUDE.md更新（アーキテクチャ概要）

### ドキュメント更新タイミング
- 設計変更時: 即座に更新
- 実装完了時: ドキュメントと実装の同期確認
- リリース前: 最終レビューと更新

## 保守性テスト

### テストシナリオ1: コードの可読性
1. 新しいメンバーにコードレビューを依頼
2. 理解できない箇所を指摘してもらう
3. コメントやドキュメントを改善

### テストシナリオ2: エラーハンドリングの一貫性
1. 各環境でエラーを発生させる
2. エラーメッセージとログ出力を確認
3. 一貫性を検証

### テストシナリオ3: テストカバレッジ
1. テストカバレッジレポートを生成
2. カバレッジが80%未満の箇所を特定
3. テストを追加

## 参考資料

- Clean Code by Robert C. Martin
- Refactoring by Martin Fowler
- TypeScript Best Practices
- Docker Best Practices
