# 保守性要件: Docker名前付きVolume

## 非機能要件（EARS記法）

### 後方互換性

- **NFR-M-001**: 既存のバインドマウント環境が存在する間、システムはバインドマウントと名前付きVolumeの両方をサポートしなければならない

### 命名一貫性

- **NFR-M-002**: 設定用Volume名は`claude-config-claude-{env-id}`および`claude-config-configclaude-{env-id}`パターンに従わなければならない

### テスト容易性

- **NFR-M-003**: DockerClient（dockerode）への依存はモック可能でなければならない
