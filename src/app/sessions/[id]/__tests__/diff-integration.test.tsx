/**
 * BUG-002統合テスト: Diffタブの読み込み問題
 *
 * このテストは実際のユーザーフローを再現して問題を特定します
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAppStore } from '@/store';

// fetchをモック
global.fetch = vi.fn();

describe('BUG-002統合テスト: DiffタブのfetchDiff動作', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // ストアをリセット
    useAppStore.getState().reset();
  });

  it('正常ケース: APIが正しいdiffを返す', async () => {
    // Setup: APIが正常なレスポンスを返す
    const mockDiffResponse = {
      diff: {
        files: [
          {
            path: 'test.ts',
            status: 'modified',
            additions: 5,
            deletions: 3,
            oldContent: 'old',
            newContent: 'new',
          },
        ],
        totalAdditions: 5,
        totalDeletions: 3,
      },
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockDiffResponse,
    } as Response);

    // Execute: fetchDiffを実行
    const { result } = renderHook(() => useAppStore());

    await result.current.fetchDiff('test-session-id');

    // Verify: diffが正しく設定される
    await waitFor(() => {
      expect(result.current.diff).not.toBeNull();
    });

    expect(result.current.diff).toEqual(mockDiffResponse.diff);
  });

  it('BUG-002再現ケース1: APIが空のdiffを返す', async () => {
    // Setup: APIが空のfilesを返す（変更がない場合）
    const emptyDiffResponse = {
      diff: {
        files: [],
        totalAdditions: 0,
        totalDeletions: 0,
      },
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => emptyDiffResponse,
    } as Response);

    // Execute
    const { result } = renderHook(() => useAppStore());

    await result.current.fetchDiff('test-session-id');

    // Verify: diffは設定されるが、filesが空
    await waitFor(() => {
      expect(result.current.diff).not.toBeNull();
    });

    expect(result.current.diff?.files).toEqual([]);

    /**
     * この場合、DiffViewerは:
     * 1. diff !== null なので「差分を読み込み中...」は表示されない
     * 2. selectedFile === null なので「ファイルを選択してください」が表示される
     *
     * これは正しい動作
     */
  });

  it('BUG-002修正: APIがエラーを返す場合、エラー状態を設定', async () => {
    // Setup: APIが401を返す（認証エラー）
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Unauthorized' }),
    } as Response);

    // Execute
    const { result } = renderHook(() => useAppStore());

    // fetchDiffは例外を投げるべき
    await expect(result.current.fetchDiff('test-session-id')).rejects.toThrow('認証エラーが発生しました');

    // Verify: diffはnullのまま、但しエラー状態が設定される（修正後）
    expect(result.current.diff).toBeNull();
    expect(result.current.isDiffLoading).toBe(false);
    expect(result.current.diffError).toBe('認証エラーが発生しました');
  });

  it('BUG-002修正: APIが404を返す場合、エラー状態を設定', async () => {
    // Setup: APIが404を返す
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Session not found' }),
    } as Response);

    // Execute
    const { result } = renderHook(() => useAppStore());

    await expect(result.current.fetchDiff('non-existent-session')).rejects.toThrow('セッションが見つかりません');

    // Verify: diffはnullのまま、エラー状態が設定される
    expect(result.current.diff).toBeNull();
    expect(result.current.isDiffLoading).toBe(false);
    expect(result.current.diffError).toBe('セッションが見つかりません');
  });

  it('BUG-002修正: ネットワークエラーの場合、エラー状態を設定', async () => {
    // Setup: fetchが失敗する
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Failed to fetch'));

    // Execute
    const { result } = renderHook(() => useAppStore());

    await expect(result.current.fetchDiff('test-session-id')).rejects.toThrow('ネットワークエラーが発生しました');

    // Verify: diffはnullのまま、エラー状態が設定される
    expect(result.current.diff).toBeNull();
    expect(result.current.isDiffLoading).toBe(false);
    expect(result.current.diffError).toBe('ネットワークエラーが発生しました');
  });

  it('BUG-002修正: JSON解析エラーの場合、エラー状態を設定', async () => {
    // Setup: APIが不正なJSONを返す
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('Invalid JSON');
      },
    } as Response);

    // Execute
    const { result } = renderHook(() => useAppStore());

    await expect(result.current.fetchDiff('test-session-id')).rejects.toThrow();

    // Verify: diffはnullのまま、エラー状態が設定される
    expect(result.current.diff).toBeNull();
    expect(result.current.isDiffLoading).toBe(false);
    expect(result.current.diffError).toBe('差分の取得に失敗しました');
  });

  it('BUG-002修正: APIが不正な形式を返す場合、エラー状態を設定', async () => {
    // Setup: APIが期待と異なる形式を返す（diffプロパティがない）
    const invalidResponse = {
      // diffプロパティがない！
      files: [],
      totalAdditions: 0,
      totalDeletions: 0,
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => invalidResponse,
    } as Response);

    // Execute
    const { result } = renderHook(() => useAppStore());

    await expect(result.current.fetchDiff('test-session-id')).rejects.toThrow('APIレスポンスの形式が不正です');

    // Verify: diffはnullのまま、エラー状態が設定される（修正後）
    expect(result.current.diff).toBeNull();
    expect(result.current.isDiffLoading).toBe(false);
    expect(result.current.diffError).toBe('APIレスポンスの形式が不正です');

    /**
     * BUG-002の根本原因と修正:
     *
     * 【問題】APIレスポンスに'diff'プロパティがない場合、
     *       set({ diff: data.diff }) で undefined が設定され、
     *       DiffViewerは if (!diff) でチェックするので、
     *       「差分を読み込み中...」が永遠に表示される
     *
     * 【修正】fetchDiff内でdata.diffがundefinedの場合をガードし、
     *       エラー状態を設定してエラーメッセージを表示する
     */
  });
});
