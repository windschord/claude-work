/**
 * QuickCreateButtonのテスト
 * Task 43.12: ワンクリックでセッションを作成するボタン
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QuickCreateButton } from '../QuickCreateButton';

// fetchをモック
const mockFetch = vi.fn();
global.fetch = mockFetch;

// useRouterをモック
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('QuickCreateButton', () => {
  const mockOnSuccess = vi.fn();
  const defaultProps = {
    projectId: 'project-123',
    onSuccess: mockOnSuccess,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it('ボタンが正しくレンダリングされる', () => {
    render(<QuickCreateButton {...defaultProps} />);

    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('クリック時にcreateSession APIが呼ばれる', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        session: {
          id: 'session-new',
          name: 'auto-generated-name',
          status: 'initializing',
        },
      }),
    });

    render(<QuickCreateButton {...defaultProps} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/projects/project-123/sessions',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.any(String),
        })
      );
    });
  });

  it('作成中はローディング表示される', async () => {
    // 遅延を持つPromiseを返す
    mockFetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: async () => ({
                session: { id: 'session-new' },
              }),
            });
          }, 100);
        })
    );

    render(<QuickCreateButton {...defaultProps} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    // ローディング状態を確認
    expect(button).toBeDisabled();

    await waitFor(() => {
      expect(button).not.toBeDisabled();
    });
  });

  it('成功時にonSuccessが呼ばれる', async () => {
    const newSession = {
      id: 'session-new',
      name: 'auto-generated-name',
      status: 'initializing',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ session: newSession }),
    });

    render(<QuickCreateButton {...defaultProps} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalledWith(newSession);
    });
  });

  it('成功時にセッション詳細ページに遷移する', async () => {
    const newSession = {
      id: 'session-new',
      name: 'auto-generated-name',
      status: 'initializing',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ session: newSession }),
    });

    render(<QuickCreateButton {...defaultProps} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/sessions/session-new');
    });
  });

  it('エラー時にonErrorが呼ばれる', async () => {
    const mockOnError = vi.fn();

    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Failed to create session' }),
    });

    render(<QuickCreateButton {...defaultProps} onError={mockOnError} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith('Failed to create session');
    });
  });

  it('作成中にボタンが再度クリックされても重複リクエストされない', async () => {
    mockFetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: async () => ({
                session: { id: 'session-new' },
              }),
            });
          }, 100);
        })
    );

    render(<QuickCreateButton {...defaultProps} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  it('プロンプトなしでセッションが作成される', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        session: {
          id: 'session-new',
          name: 'auto-generated-name',
          status: 'initializing',
        },
      }),
    });

    render(<QuickCreateButton {...defaultProps} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      // プロンプトは空文字列または未定義
      expect(body.prompt).toBeFalsy();
    });
  });

  it('カスタムラベルを表示できる', () => {
    render(<QuickCreateButton {...defaultProps} label="新規セッション" />);

    expect(screen.getByText('新規セッション')).toBeInTheDocument();
  });
});
