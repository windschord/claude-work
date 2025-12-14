import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { CommitHistory } from '../CommitHistory';

// Mock fetch
global.fetch = vi.fn();

describe('CommitHistory', () => {
  const mockCommits = [
    {
      hash: 'abc123def456789012345678901234567890abcd',
      shortHash: 'abc123d',
      message: 'Add authentication',
      author: 'Claude',
      email: 'claude@anthropic.com',
      date: '2025-12-08T10:05:00Z',
      filesChanged: 3,
    },
    {
      hash: 'def456abc123789012345678901234567890abcd',
      shortHash: 'def456a',
      message: 'Fix bug in login',
      author: 'Claude',
      email: 'claude@anthropic.com',
      date: '2025-12-07T15:30:00Z',
      filesChanged: 1,
    },
    {
      hash: 'ghi789def456123456789012345678901234abcd',
      shortHash: 'ghi789d',
      message: 'Initial commit',
      author: 'Test User',
      email: 'test@example.com',
      date: '2025-12-01T09:00:00Z',
      filesChanged: 5,
    },
  ];

  const mockSessionId = 'test-session-id';

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ commits: mockCommits }),
    } as Response);
  });

  afterEach(() => {
    cleanup();
  });

  it('コミット履歴を取得して表示する', async () => {
    render(<CommitHistory sessionId={mockSessionId} />);

    await waitFor(() => {
      expect(screen.getByText('Add authentication')).toBeInTheDocument();
    });

    expect(screen.getByText('Fix bug in login')).toBeInTheDocument();
    expect(screen.getByText('Initial commit')).toBeInTheDocument();
  });

  it('コミットハッシュ（短縮版）を表示する', async () => {
    render(<CommitHistory sessionId={mockSessionId} />);

    await waitFor(() => {
      expect(screen.getByText('abc123d')).toBeInTheDocument();
    });

    expect(screen.getByText('def456a')).toBeInTheDocument();
    expect(screen.getByText('ghi789d')).toBeInTheDocument();
  });

  it('作成者名を表示する', async () => {
    render(<CommitHistory sessionId={mockSessionId} />);

    await waitFor(() => {
      expect(screen.getAllByText('Claude').length).toBeGreaterThan(0);
    });

    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  it('日時を表示する', async () => {
    render(<CommitHistory sessionId={mockSessionId} />);

    await waitFor(() => {
      // ISO形式の日時が表示されることを確認
      expect(screen.getByText(/2025-12-08/)).toBeInTheDocument();
    });

    expect(screen.getByText(/2025-12-07/)).toBeInTheDocument();
    expect(screen.getByText(/2025-12-01/)).toBeInTheDocument();
  });

  it('変更ファイル数を表示する', async () => {
    render(<CommitHistory sessionId={mockSessionId} />);

    await waitFor(() => {
      expect(screen.getByText(/3.*ファイル/)).toBeInTheDocument();
    });

    expect(screen.getByText(/1.*ファイル/)).toBeInTheDocument();
    expect(screen.getByText(/5.*ファイル/)).toBeInTheDocument();
  });

  it('各コミットにリセットボタンを表示する', async () => {
    render(<CommitHistory sessionId={mockSessionId} />);

    await waitFor(() => {
      const resetButtons = screen.getAllByRole('button', { name: /リセット/i });
      expect(resetButtons.length).toBe(mockCommits.length);
    });
  });

  it('リセットボタンをクリックすると確認ダイアログが表示される', async () => {
    render(<CommitHistory sessionId={mockSessionId} />);

    await waitFor(() => {
      expect(screen.getByText('Add authentication')).toBeInTheDocument();
    });

    const resetButtons = screen.getAllByRole('button', { name: /リセット/i });
    fireEvent.click(resetButtons[0]);

    // 確認ダイアログが表示されることを確認
    await waitFor(() => {
      expect(screen.getByText(/コミットにリセット/)).toBeInTheDocument();
    });

    expect(screen.getByText(/abc123d/)).toBeInTheDocument();
    expect(screen.getByText(/それ以降の変更は失われます/)).toBeInTheDocument();
  });

  it('確認ダイアログでリセットを実行する', async () => {
    const mockResetFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/reset')) {
        return mockResetFetch();
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ commits: mockCommits }),
      } as Response);
    });

    render(<CommitHistory sessionId={mockSessionId} />);

    await waitFor(() => {
      expect(screen.getByText('Add authentication')).toBeInTheDocument();
    });

    const resetButtons = screen.getAllByRole('button', { name: /リセット/i });
    fireEvent.click(resetButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/コミットにリセット/)).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole('button', { name: /リセット/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/reset'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining(mockCommits[0].hash),
        })
      );
    });
  });

  it('確認ダイアログでキャンセルできる', async () => {
    render(<CommitHistory sessionId={mockSessionId} />);

    await waitFor(() => {
      expect(screen.getByText('Add authentication')).toBeInTheDocument();
    });

    const resetButtons = screen.getAllByRole('button', { name: /リセット/i });
    fireEvent.click(resetButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/コミットにリセット/)).toBeInTheDocument();
    });

    const cancelButton = screen.getByRole('button', { name: /キャンセル/i });
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByText(/コミットにリセット/)).not.toBeInTheDocument();
    });
  });

  it('コミット履歴の取得に失敗した場合、エラーメッセージを表示する', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      statusText: 'Internal Server Error',
    } as Response);

    render(<CommitHistory sessionId={mockSessionId} />);

    await waitFor(() => {
      expect(screen.getByText(/コミット履歴の取得に失敗しました/)).toBeInTheDocument();
    });
  });

  it('コミット履歴が空の場合、メッセージを表示する', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ commits: [] }),
    } as Response);

    render(<CommitHistory sessionId={mockSessionId} />);

    await waitFor(() => {
      expect(screen.getByText(/コミット履歴がありません/)).toBeInTheDocument();
    });
  });

  it('読み込み中のインジケーターを表示する', () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => ({ commits: mockCommits }),
              } as Response),
            1000
          );
        })
    );

    render(<CommitHistory sessionId={mockSessionId} />);

    expect(screen.getByText(/読み込み中/)).toBeInTheDocument();
  });

  it('コミット行をホバーするとハイライトされる', async () => {
    render(<CommitHistory sessionId={mockSessionId} />);

    await waitFor(() => {
      expect(screen.getByText('Add authentication')).toBeInTheDocument();
    });

    const commitRow = screen.getByText('Add authentication').closest('tr');
    expect(commitRow).toHaveClass('hover:bg-gray-50');
  });

  it('リセット後にコミット履歴を再取得する', async () => {
    const fetchSpy = vi.fn();
    let fetchCallCount = 0;

    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      fetchSpy(url);
      fetchCallCount++;

      if (url.includes('/reset')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        } as Response);
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({ commits: mockCommits }),
      } as Response);
    });

    render(<CommitHistory sessionId={mockSessionId} />);

    await waitFor(() => {
      expect(screen.getByText('Add authentication')).toBeInTheDocument();
    });

    const initialFetchCount = fetchCallCount;

    const resetButtons = screen.getAllByRole('button', { name: /リセット/i });
    fireEvent.click(resetButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/コミットにリセット/)).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole('button', { name: /リセット/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(fetchCallCount).toBeGreaterThan(initialFetchCount);
    });
  });

  it('テーブルヘッダーが正しく表示される', async () => {
    render(<CommitHistory sessionId={mockSessionId} />);

    await waitFor(() => {
      expect(screen.getByText('ハッシュ')).toBeInTheDocument();
    });

    expect(screen.getByText('メッセージ')).toBeInTheDocument();
    expect(screen.getByText('作成者')).toBeInTheDocument();
    expect(screen.getByText('日時')).toBeInTheDocument();
    expect(screen.getByText('変更ファイル数')).toBeInTheDocument();
    expect(screen.getByText('操作')).toBeInTheDocument();
  });
});
