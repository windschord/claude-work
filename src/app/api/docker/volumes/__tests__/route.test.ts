import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockDockerClient } = vi.hoisted(() => ({
  mockDockerClient: {
    listVolumes: vi.fn(),
  },
}));

vi.mock('@/services/docker-client', () => ({
  DockerClient: {
    getInstance: () => mockDockerClient,
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { GET } from '../route';

describe('GET /api/docker/volumes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('Volume一覧を正常に返す', async () => {
    mockDockerClient.listVolumes.mockResolvedValue({
      Volumes: [
        {
          Name: 'cw-repo-my-project',
          Driver: 'local',
          Mountpoint: '/var/lib/docker/volumes/cw-repo-my-project/_data',
          CreatedAt: '2026-01-01T00:00:00Z',
          Labels: {},
          Scope: 'local',
        },
        {
          Name: 'cw-config-dev',
          Driver: 'local',
          Mountpoint: '/var/lib/docker/volumes/cw-config-dev/_data',
          CreatedAt: '2026-01-02T00:00:00Z',
          Labels: {},
          Scope: 'local',
        },
      ],
      Warnings: [],
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.volumes).toHaveLength(2);
    expect(data.volumes[0]).toEqual({
      name: 'cw-repo-my-project',
      driver: 'local',
      createdAt: '2026-01-01T00:00:00Z',
    });
    expect(data.volumes[1]).toEqual({
      name: 'cw-config-dev',
      driver: 'local',
      createdAt: '2026-01-02T00:00:00Z',
    });
  });

  it('Volume一覧が空の場合は空配列を返す', async () => {
    mockDockerClient.listVolumes.mockResolvedValue({
      Volumes: [],
      Warnings: [],
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.volumes).toHaveLength(0);
  });

  it('Volumes が null の場合は空配列を返す', async () => {
    mockDockerClient.listVolumes.mockResolvedValue({
      Volumes: null,
      Warnings: [],
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.volumes).toHaveLength(0);
  });

  it('Docker daemon接続エラー時は503を返す', async () => {
    mockDockerClient.listVolumes.mockRejectedValue(
      new Error('Cannot connect to the Docker daemon')
    );

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.error).toBe('Cannot connect to the Docker daemon');
  });
});
