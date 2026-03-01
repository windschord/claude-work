# 設計: Docker Volumeの読みやすい自動命名と既存Volume選択機能

## 概要

Docker Volumeの命名規則を `claude-repo-{uuid}` から `cw-{種別}-{識別名スラッグ}` に改善し、`docker volume ls` での視認性を向上させる。既存Volume選択機能により、環境設定時にDocker Volumeを再利用できるようにする。

## アーキテクチャ概要

```
+---------------------------+     +---------------------------+
|   VolumeMountList (UI)    |     |   Clone API (route.ts)    |
|   - ソース種別選択        |     |   - Volume名生成          |
|   - Docker Volume一覧     |     +-------------+-------------+
+--------+------------------+                   |
         |                                      v
         v                        +---------------------------+
+---------------------------+     |   DockerGitService        |
| GET /api/docker/volumes   |     |   - generateVolumeName()  |
+--------+------------------+     +-------------+-------------+
         |                                      |
         v                                      v
+---------------------------+     +---------------------------+
|   DockerClient            |     |   volume-naming.ts        |
|   - listVolumes()         |     |   - generateSlug()        |
|   - inspectVolume()       |     |   - generateVolumeName()  |
+---------------------------+     |   - generateUniqueVolume() |
                                  |   - validateVolumeName()   |
                                  +---------------------------+
```

## コンポーネント一覧

| コンポーネント | 種別 | 詳細リンク |
|---------------|------|------------|
| volume-naming | 新規ユーティリティ | [詳細](components/volume-naming.md) @components/volume-naming.md |
| docker-client-volumes | 既存拡張 | [詳細](components/docker-client-volumes.md) @components/docker-client-volumes.md |
| volume-mount-list-ui | 既存拡張 | [詳細](components/volume-mount-list-ui.md) @components/volume-mount-list-ui.md |

## API一覧

| エンドポイント | メソッド | 詳細リンク |
|---------------|---------|------------|
| /api/docker/volumes | GET | [詳細](api/docker-volumes.md) @api/docker-volumes.md |

## 要件トレーサビリティ

| 要件ID | 設計要素 |
|--------|---------|
| REQ-001-001 | volume-naming.ts: `generateSlug()` |
| REQ-001-002 | volume-naming.ts: `generateVolumeName('repo', name)` |
| REQ-001-003 | volume-naming.ts: `generateVolumeName('config', name)` |
| REQ-001-004 | volume-naming.ts: `generateUniqueVolumeName()` |
| REQ-001-005 | volume-naming.ts: `validateVolumeName()` |
| REQ-002-001 | docker-client.ts: `listVolumes()`, `inspectVolume()` |
| REQ-002-002 | api/docker/volumes/route.ts: `GET` |
| REQ-002-003 | VolumeMountList.tsx: ソース種別選択UI |
| REQ-002-004 | docker-config-validator.ts: `validateVolumeName()` |
| REQ-003-001 | DockerGitService: 既存`docker_volume_id`の優先使用 |
| REQ-003-002 | clone API: `docker_volume_id`未設定時の新命名規則適用 |
| NFR-COMPAT-001 | 後方互換: 既存Volume名をそのまま認識 |
| NFR-COMPAT-002 | 後方互換: DBレコード変更なし |
