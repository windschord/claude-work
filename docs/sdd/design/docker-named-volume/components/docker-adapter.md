# コンポーネント設計: DockerAdapter

## 変更箇所

- DockerAdapterConfig.authDirPath をオプショナルに変更
- getConfigVolumeNames() 静的ヘルパー関数を追加
- constructor() のバリデーションを条件付きに変更
- buildContainerOptions() の認証マウント部分を名前付きVolume対応に変更

## 対応要件

REQ-001-003, REQ-001-004, REQ-001-010, REQ-001-011, NFR-M-002
