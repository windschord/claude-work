# 設計: Docker名前付きVolumeによるClaude Code設定の永続化

## 概要

Docker環境のClaude Code設定の永続化方式をバインドマウントから名前付きVolumeに変更する。

## アーキテクチャ概要

### 変更後

```text
EnvironmentService.createConfigVolumes()
  -> DockerClient.createVolume('claude-config-claude-{env-id}')
  -> DockerClient.createVolume('claude-config-configclaude-{env-id}')
  -> auth_dir_path はNULLのまま

DockerAdapter.buildContainerOptions()
  -> auth_dir_path が null: 名前付きVolume使用
  -> auth_dir_path が設定済み: 従来のバインドマウント（後方互換）
```

## コンポーネント一覧

| コンポーネント | 変更種別 | 詳細リンク |
|--------------|---------|------------|
| DockerAdapter | 修正 | [詳細](components/docker-adapter.md) |
| EnvironmentService | 修正 | [詳細](components/environment-service.md) |
| AdapterFactory | 修正 | [詳細](components/adapter-factory.md) |

## 技術的決定事項

| ID | タイトル | 詳細リンク |
|----|---------|------------|
| DEC-001 | 2つの名前付きVolumeを使用 | [詳細](decisions/DEC-001.md) |
