# 要件定義: Volume削除オプション機能

## 概要

環境削除時およびプロジェクト削除時に、関連するDocker Volumeの保持/削除をチェックボックスで個別に選択できるUIを提供する。

## ユーザーストーリー

### US-VDO-001: 環境削除時のVolume選択

**As a** ClaudeWorkの管理者
**I want to** Docker環境を削除する際に、個別のVolumeを残すか削除するか選択できる
**So that** 必要な設定データを保持しつつ不要な環境を削除できる

#### 受入基準

| # | 基準 | EARS記法 |
|---|------|----------|
| AC-1 | 名前付きVolume利用のDocker環境の削除ダイアログに、Volume削除オプションのチェックボックスが表示される | もし環境タイプがDOCKERかつauth_dir_pathが未設定ならば、システムはVolume削除オプションを表示しなければならない |
| AC-2 | チェックボックスはデフォルトで全て未チェック（=全Volume削除） | 削除ダイアログが開かれた時、システムは全てのVolume保持チェックボックスを未チェック状態で表示しなければならない |
| AC-3 | チェックされたVolumeは削除されず保持される | もしユーザーがVolumeの保持チェックボックスをチェックしたならば、システムはそのVolumeを削除せずに保持しなければならない |
| AC-4 | HOST環境の場合はVolume選択オプションが表示されない | もし環境タイプがHOSTならば、システムはVolume削除オプションを表示してはならない |

#### 対象Volume

| Volume | マウント先 | 命名規則 |
|--------|-----------|----------|
| Claude設定Volume | `/home/node/.claude` | `claude-config-claude-<envId>` |
| Config Claude Volume | `/home/node/.config/claude` | `claude-config-configclaude-<envId>` |

### US-VDO-002: プロジェクト削除時のVolume選択

**As a** ClaudeWorkの管理者
**I want to** プロジェクトを削除する際に、Git checkout Volumeを残すか削除するか選択できる
**So that** 不要なVolumeリソースをプロジェクト削除時にクリーンアップできる

#### 受入基準

| # | 基準 | EARS記法 |
|---|------|----------|
| AC-1 | Docker clone (`clone_location='docker'`) のプロジェクト削除ダイアログに、Volume削除オプションが表示される | もしプロジェクトのclone_locationがdockerならば、システムはVolume削除オプションを表示しなければならない |
| AC-2 | チェックボックスはデフォルトで未チェック（=Volume削除） | 削除ダイアログが開かれた時、システムはVolume保持チェックボックスを未チェック状態で表示しなければならない |
| AC-3 | チェックされたVolumeは削除されず保持される | もしユーザーがVolume保持チェックボックスをチェックしたならば、システムはそのVolumeを削除せずに保持しなければならない |
| AC-4 | ホストclone (`clone_location='host'`) の場合はVolume選択オプションが表示されない | もしプロジェクトのclone_locationがhostならば、システムはVolume削除オプションを表示してはならない |
| AC-5 | プロジェクト削除時にデフォルトでGit checkout Volumeが削除される（現在は未実装） | プロジェクトが削除された時、システムは関連するGit checkout Volumeを削除しなければならない |

#### 対象Volume

| Volume | マウント先 | 命名規則 |
|--------|-----------|----------|
| Git checkout Volume | `/repo` | `project.docker_volume_id`の値を使用（通常は`cw-repo-<slug>`形式） |

## 非機能要件

### NFR-VDO-001: Volume削除の信頼性

- Volume削除はベストエフォートで実施する（環境削除の既存方針を踏襲）
- Volume削除失敗時もDB削除は成功とする
- 削除失敗時は警告ログを出力する

## 影響範囲

### 変更が必要なファイル

**環境削除（フロントエンド）:**
- `src/components/environments/DeleteEnvironmentDialog.tsx` - チェックボックスUI追加
- `src/hooks/useEnvironments.ts` - deleteEnvironment にオプション引数追加

**環境削除（バックエンド）:**
- `src/app/api/environments/[id]/route.ts` - クエリパラメータでVolume保持オプション受付
- `src/services/environment-service.ts` - delete()にVolume保持オプション追加

**プロジェクト削除（フロントエンド）:**
- `src/components/projects/DeleteProjectDialog.tsx` - チェックボックスUI追加
- `src/store/index.ts` - deleteProject にオプション引数追加

**プロジェクト削除（バックエンド）:**
- `src/app/api/projects/[project_id]/route.ts` - Volume削除処理追加（DockerClient.removeVolumeを直接使用）
