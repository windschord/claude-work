import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDockerVolumes } from '../useDockerVolumes';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useDockerVolumes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Volume一覧を取得できる', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        volumes: [
          { name: 'cw-repo-my-project', driver: 'local', createdAt: '2026-01-01T00:00:00Z' },
          { name: 'cw-config-dev', driver: 'local', createdAt: '2026-01-02T00:00:00Z' },
        ],
      }),
    });

    const { result } = renderHook(() => useDockerVolumes());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.volumes).toHaveLength(2);
    expect(result.current.volumes[0].name).toBe('cw-repo-my-project');
    expect(result.current.error).toBeNull();
  });

  it('APIエラー時にerrorが設定される', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Docker daemon not available' }),
    });

    const { result } = renderHook(() => useDockerVolumes());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.volumes).toHaveLength(0);
    expect(result.current.error).toBe('Docker daemon not available');
  });

  it('fetchエラー時にerrorが設定される', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useDockerVolumes());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.volumes).toHaveLength(0);
    expect(result.current.error).toBe('Network error');
  });

  it('マウント時に1回だけフェッチする', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ volumes: [] }),
    });

    renderHook(() => useDockerVolumes());

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/docker/volumes');
  });

  it('再レンダリングで追加フェッチが発生しない', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ volumes: [] }),
    });

    const { rerender } = renderHook(() => useDockerVolumes());

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    rerender();
    rerender();
    rerender();

    // 再レンダリング後もフェッチ回数は1回のまま
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('アンマウント時にステート更新がキャンセルされる', async () => {
    let resolvePromise: (value: unknown) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    mockFetch.mockReturnValueOnce(pendingPromise);

    const { unmount } = renderHook(() => useDockerVolumes());

    // フェッチが開始されたことを確認
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // アンマウント(クリーンアップでcancelled=trueが設定される)
    unmount();

    // フェッチを完了させる
    resolvePromise!({
      ok: true,
      json: () => Promise.resolve({ volumes: [{ name: 'late-volume', driver: 'local', createdAt: '' }] }),
    });

    // アンマウント後のステート更新でエラーが発生しないことを確認
    // (React would warn about state updates on unmounted components)
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  it('refetchでデータを再取得できる', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ volumes: [] }),
    });

    const { result } = renderHook(() => useDockerVolumes());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        volumes: [{ name: 'new-volume', driver: 'local', createdAt: '' }],
      }),
    });

    result.current.refetch();

    await waitFor(() => {
      expect(result.current.volumes).toHaveLength(1);
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
