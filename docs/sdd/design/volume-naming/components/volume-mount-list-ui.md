# コンポーネント設計: VolumeMountList UI拡張

## 概要

既存の `VolumeMountList` コンポーネントに、Docker Named Volume の選択機能を追加する。ホストパスバインドマウントに加え、Docker Named Volumeを選択してマウントできるようにする。

## ファイルパス

`src/components/environments/VolumeMountList.tsx` (既存ファイル修正)

## UI設計

### ソース種別の切り替え

各マウント行の先頭にソース種別セレクタを追加:

```
[ホストパス ▼] [/host/path     ] → [/container/path] [RW ▼] [X]
[Volume    ▼] [cw-repo-xxx  ▼ ] → [/container/path] [RW ▼] [X]
```

### ソース種別

| 種別 | 値 | 動作 |
|------|-----|------|
| ホストパス | `bind` | 従来のhostPathテキスト入力 |
| Docker Volume | `volume` | Volume名ドロップダウン + 手動入力オプション |

### VolumeMount型の拡張

```typescript
// src/types/environment.ts に追加
interface VolumeMount {
  hostPath: string;        // bind時のホストパス or volume名
  containerPath: string;
  accessMode: 'rw' | 'ro';
  sourceType?: 'bind' | 'volume';  // 新規追加（デフォルト: 'bind'）
}
```

### Docker Volume選択UI

`sourceType === 'volume'` 時:
1. Docker Volume一覧をAPIから取得 (`GET /api/docker/volumes`)
2. ドロップダウンで既存Volume一覧を表示
3. ドロップダウン最下部に「Volume名を入力...」オプション
4. Volume名入力時のバリデーション（`validateVolumeName()`）

### フック: useDockerVolumes

```typescript
// src/hooks/useDockerVolumes.ts (新規)
function useDockerVolumes() {
  // GET /api/docker/volumes を呼び出し
  // { volumes, loading, error, refetch } を返す
}
```

## バリデーション変更

### docker-config-validator.ts

`validateVolumeMounts()` を拡張:
- `sourceType === 'volume'` の場合:
  - `hostPath` をVolume名として扱う
  - `validateVolumeName()` でバリデーション
  - ホストパス固有のバリデーション（絶対パス、パストラバーサル等）をスキップ

## テスト方針

- VolumeMountList: sourceType切り替えのUIテスト
- useDockerVolumes: APIモックでのフェッチテスト
- docker-config-validator: sourceType='volume'時のバリデーションテスト

## 関連要件

- REQ-002-003, REQ-002-004
