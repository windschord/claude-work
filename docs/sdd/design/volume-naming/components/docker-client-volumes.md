# コンポーネント設計: DockerClient Volume拡張

## 概要

既存の `DockerClient` クラスに Volume一覧取得とVolume詳細取得のメソッドを追加する。

## ファイルパス

`src/services/docker-client.ts` (既存ファイル修正)

## 追加メソッド

```typescript
/**
 * Docker Volume一覧を取得する
 * dockerode の listVolumes() をラップ
 */
public async listVolumes(): Promise<{
  Volumes: Array<{
    Name: string;
    Driver: string;
    CreatedAt: string;
    Labels: Record<string, string>;
    Mountpoint: string;
    Scope: string;
  }>;
}> {
  try {
    return await this.docker.listVolumes();
  } catch (error) {
    logger.error('Failed to list volumes', { error });
    throw error;
  }
}

/**
 * 指定されたVolume名の詳細情報を取得する
 */
public async inspectVolume(name: string): Promise<{
  Name: string;
  Driver: string;
  CreatedAt: string;
  Labels: Record<string, string>;
  Mountpoint: string;
  Scope: string;
}> {
  try {
    const volume = this.docker.getVolume(name);
    return await volume.inspect();
  } catch (error) {
    logger.error(`Failed to inspect volume: ${name}`, { error });
    throw error;
  }
}
```

## テスト方針

- DockerClientのモックを使用してテスト
- テストファイル: `src/services/__tests__/docker-client.test.ts` (既存に追加)

## 関連要件

- REQ-002-001
