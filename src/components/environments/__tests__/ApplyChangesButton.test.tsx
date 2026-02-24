import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ApplyChangesButton } from '../ApplyChangesButton';

// fetchをモック
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ApplyChangesButton', () => {
  const defaultProps = {
    environmentId: 'env-123',
    onApplied: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  // ヘルパー: セッション一覧APIのモックレスポンスを作成
  const mockSessionsResponse = (sessions: Array<{ id: string; name: string }>) => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sessions,
        count: sessions.length,
      }),
    });
  };

  // ヘルパー: 適用APIのモックレスポンスを作成
  const mockApplyResponse = (applied: number, failed: number, sessions: Array<{ id: string; name: string; status: string }> = []) => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        applied,
        failed,
        sessions,
      }),
    });
  };

  describe('実行中セッションがない場合', () => {
    it('ボタンが非表示になること', async () => {
      mockSessionsResponse([]);

      render(<ApplyChangesButton {...defaultProps} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/environments/env-123/sessions',
          expect.any(Object)
        );
      });

      expect(screen.queryByRole('button', { name: /今すぐ適用/ })).not.toBeInTheDocument();
      expect(screen.getByText('実行中のセッションはありません')).toBeInTheDocument();
    });
  });

  describe('セッション取得に失敗した場合', () => {
    it('APIがエラーを返した場合にエラーメッセージが表示されること', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      render(<ApplyChangesButton {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('セッション一覧の取得に失敗しました')).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /今すぐ適用/ })).not.toBeInTheDocument();
    });

    it('ネットワークエラーの場合にエラーメッセージが表示されること', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      render(<ApplyChangesButton {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('セッション一覧の取得に失敗しました')).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /今すぐ適用/ })).not.toBeInTheDocument();
    });
  });

  describe('実行中セッションがある場合', () => {
    it('「今すぐ適用」ボタンとセッション数バッジが表示されること', async () => {
      mockSessionsResponse([
        { id: 'session-1', name: 'Session 1' },
        { id: 'session-2', name: 'Session 2' },
        { id: 'session-3', name: 'Session 3' },
      ]);

      render(<ApplyChangesButton {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /今すぐ適用/ })).toBeInTheDocument();
      });

      // セッション数バッジが表示される
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  describe('確認ダイアログ', () => {
    it('ボタンクリックで確認ダイアログが表示されること', async () => {
      mockSessionsResponse([
        { id: 'session-1', name: 'Session 1' },
        { id: 'session-2', name: 'Session 2' },
      ]);

      render(<ApplyChangesButton {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /今すぐ適用/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /今すぐ適用/ }));

      // 確認ダイアログに影響を受けるセッション一覧が表示される
      expect(screen.getByText('Session 1')).toBeInTheDocument();
      expect(screen.getByText('Session 2')).toBeInTheDocument();
    });

    it('確認ダイアログでキャンセルするとダイアログが閉じること', async () => {
      mockSessionsResponse([
        { id: 'session-1', name: 'Session 1' },
      ]);

      render(<ApplyChangesButton {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /今すぐ適用/ })).toBeInTheDocument();
      });

      // ダイアログを開く
      fireEvent.click(screen.getByRole('button', { name: /今すぐ適用/ }));
      expect(screen.getByText('Session 1')).toBeInTheDocument();

      // キャンセルボタンをクリック
      fireEvent.click(screen.getByRole('button', { name: /キャンセル/ }));

      // ダイアログが閉じてセッション名が非表示になる
      await waitFor(() => {
        expect(screen.queryByText('Session 1')).not.toBeInTheDocument();
      });

      // 適用APIは呼ばれない
      const applyCalls = mockFetch.mock.calls.filter(
        (call) => call[0] === '/api/environments/env-123/apply'
      );
      expect(applyCalls).toHaveLength(0);
    });
  });

  describe('適用実行', () => {
    it('成功した場合、結果が表示されonAppliedが呼ばれること', async () => {
      // 1. セッション一覧取得
      mockSessionsResponse([
        { id: 'session-1', name: 'Session 1' },
        { id: 'session-2', name: 'Session 2' },
      ]);

      const onApplied = vi.fn();
      render(<ApplyChangesButton environmentId="env-123" onApplied={onApplied} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /今すぐ適用/ })).toBeInTheDocument();
      });

      // ダイアログを開く
      fireEvent.click(screen.getByRole('button', { name: /今すぐ適用/ }));

      // 2. 適用API呼び出し
      mockApplyResponse(2, 0, [
        { id: 'session-1', name: 'Session 1', status: 'applied' },
        { id: 'session-2', name: 'Session 2', status: 'applied' },
      ]);

      // 確認ボタンをクリック
      fireEvent.click(screen.getByRole('button', { name: /適用する/ }));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/environments/env-123/apply',
          expect.objectContaining({
            method: 'POST',
          })
        );
      });

      // 成功結果が表示される
      await waitFor(() => {
        expect(screen.getByText(/2/)).toBeInTheDocument();
      });

      // onAppliedコールバックが呼ばれる
      expect(onApplied).toHaveBeenCalled();
    });

    it('一部失敗した場合、失敗数が表示されること', async () => {
      // 1. セッション一覧取得
      mockSessionsResponse([
        { id: 'session-1', name: 'Session 1' },
        { id: 'session-2', name: 'Session 2' },
        { id: 'session-3', name: 'Session 3' },
      ]);

      render(<ApplyChangesButton {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /今すぐ適用/ })).toBeInTheDocument();
      });

      // ダイアログを開く
      fireEvent.click(screen.getByRole('button', { name: /今すぐ適用/ }));

      // 2. 適用API呼び出し（一部失敗）
      mockApplyResponse(2, 1, [
        { id: 'session-1', name: 'Session 1', status: 'applied' },
        { id: 'session-2', name: 'Session 2', status: 'applied' },
        { id: 'session-3', name: 'Session 3', status: 'failed' },
      ]);

      // 確認ボタンをクリック
      fireEvent.click(screen.getByRole('button', { name: /適用する/ }));

      // 失敗数が表示される
      await waitFor(() => {
        expect(screen.getByText(/失敗.*1/)).toBeInTheDocument();
      });
    });
  });

  describe('ローディング状態', () => {
    it('API呼び出し中はローディング状態が表示されること', async () => {
      // 1. セッション一覧取得
      mockSessionsResponse([
        { id: 'session-1', name: 'Session 1' },
      ]);

      render(<ApplyChangesButton {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /今すぐ適用/ })).toBeInTheDocument();
      });

      // ダイアログを開く
      fireEvent.click(screen.getByRole('button', { name: /今すぐ適用/ }));

      // 2. 適用APIを遅延させる
      let resolveApply: (value: unknown) => void;
      const applyPromise = new Promise((resolve) => {
        resolveApply = resolve;
      });
      mockFetch.mockImplementationOnce(() => applyPromise);

      // 確認ボタンをクリック
      const confirmButton = screen.getByRole('button', { name: /適用する/ });
      fireEvent.click(confirmButton);

      // ローディング中はボタンが無効化される
      expect(confirmButton).toBeDisabled();

      // Promiseをresolve
      resolveApply!({
        ok: true,
        json: async () => ({
          applied: 1,
          failed: 0,
          sessions: [{ id: 'session-1', name: 'Session 1', status: 'applied' }],
        }),
      });

      // 完了後に有効化される
      await waitFor(() => {
        expect(confirmButton).not.toBeDisabled();
      });
    });
  });
});
