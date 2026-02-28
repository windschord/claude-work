# 非機能要件: 互換性

## 後方互換性

- **NFR-COMPAT-001**: システムは、既存の `claude-repo-{uuid}` 形式のVolume名を認識し、正常に動作しなければならない

- **NFR-COMPAT-002**: 新しいVolume命名規則の導入において、システムは既存のデータベースレコード(`docker_volume_id`カラム)の値を変更してはならない
