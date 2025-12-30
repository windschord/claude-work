import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Session } from '@/store';
import { SessionCard } from '../SessionCard';

// Zustand storeのモック
const mockDeleteSession = vi.fn();
vi.mock('@/store', async () => {
  const actual = await vi.importActual('@/store');
  return {
    ...actual,
    useAppStore: vi.fn(() => mockDeleteSession),
  };
});

describe('SessionCard', () => {
  const mockSession: Session = {
    id: 'test-session-id',
    name: 'Test Session',
    status: 'initializing',
    model: 'claude-3-sonnet',
    branch_name: 'test-branch',
    worktree_path: '/path/to/worktree',
    project_id: 'test-project-id',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockOnClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('セッションカードをクリックすると、onClickが呼ばれる', () => {
    render(<SessionCard session={mockSession} onClick={mockOnClick} />);

    const card = screen.getByTestId('session-card');
    fireEvent.click(card);

    expect(mockOnClick).toHaveBeenCalledTimes(1);
    expect(mockOnClick).toHaveBeenCalledWith('test-session-id');
  });

  it('セッション名とブランチ名が表示される', () => {
    render(<SessionCard session={mockSession} onClick={mockOnClick} />);

    expect(screen.getByText('Test Session')).toBeInTheDocument();
    expect(screen.getByText(/test-branch/)).toBeInTheDocument();
  });

  it('モデル情報が表示される', () => {
    render(<SessionCard session={mockSession} onClick={mockOnClick} />);

    expect(screen.getByText(/claude-3-sonnet/)).toBeInTheDocument();
  });

  it('作成日時が表示される', () => {
    render(<SessionCard session={mockSession} onClick={mockOnClick} />);

    // 「作成日時:」ラベルに続いて実際の日付文字列が表示されていることを確認
    // 例: "作成日時: 2024/1/1 0:00:00" や "作成日時: 1/1/2024, 12:00:00 AM"
    const dateElement = screen.getByText(/作成日時:/);
    expect(dateElement).toBeInTheDocument();

    // 実際の日付値が含まれていることを確認（数字が含まれている）
    expect(dateElement.textContent).toMatch(/作成日時:\s*\d+/);
  });

  it('カードにcursor-pointerクラスが設定されている', () => {
    const { container } = render(<SessionCard session={mockSession} onClick={mockOnClick} />);

    const card = container.querySelector('.cursor-pointer');
    expect(card).toBeInTheDocument();
    expect(card).toHaveClass('cursor-pointer');
  });

  it('カードにhover効果が設定されている', () => {
    const { container } = render(<SessionCard session={mockSession} onClick={mockOnClick} />);

    const card = container.querySelector('.hover\\:shadow-lg');
    expect(card).toBeInTheDocument();
    expect(card).toHaveClass('hover:shadow-lg');
  });

  it('子要素をクリックしても親要素のonClickが正しく呼ばれる', () => {
    render(<SessionCard session={mockSession} onClick={mockOnClick} />);

    // セッション名（子要素）をクリック
    const sessionName = screen.getByText('Test Session');
    fireEvent.click(sessionName);

    // onClickが呼ばれることを確認
    expect(mockOnClick).toHaveBeenCalledTimes(1);
    expect(mockOnClick).toHaveBeenCalledWith('test-session-id');
  });

  it('ステータスアイコン（子要素）をクリックしても親要素のonClickが正しく呼ばれる', () => {
    render(<SessionCard session={mockSession} onClick={mockOnClick} />);

    // ステータスアイコン（子要素）をクリック
    const statusIcon = screen.getByTestId('status-icon-initializing');
    fireEvent.click(statusIcon);

    // onClickが呼ばれることを確認
    expect(mockOnClick).toHaveBeenCalledTimes(1);
    expect(mockOnClick).toHaveBeenCalledWith('test-session-id');
  });

  it('Enterキーを押すとonClickが呼ばれる', () => {
    render(<SessionCard session={mockSession} onClick={mockOnClick} />);

    const card = screen.getByTestId('session-card');
    fireEvent.keyDown(card, { key: 'Enter', code: 'Enter' });

    expect(mockOnClick).toHaveBeenCalledTimes(1);
    expect(mockOnClick).toHaveBeenCalledWith('test-session-id');
  });

  it('スペースキーを押すとonClickが呼ばれる', () => {
    render(<SessionCard session={mockSession} onClick={mockOnClick} />);

    const card = screen.getByTestId('session-card');
    fireEvent.keyDown(card, { key: ' ', code: 'Space' });

    expect(mockOnClick).toHaveBeenCalledTimes(1);
    expect(mockOnClick).toHaveBeenCalledWith('test-session-id');
  });

  it('カードにrole="button"とtabIndex=0が設定されている', () => {
    render(<SessionCard session={mockSession} onClick={mockOnClick} />);

    const card = screen.getByTestId('session-card');
    expect(card).toHaveAttribute('role', 'button');
    expect(card).toHaveAttribute('tabIndex', '0');
  });

  describe('削除機能', () => {
    beforeEach(() => {
      mockDeleteSession.mockReset();
      mockDeleteSession.mockResolvedValue(undefined);
    });

    it('削除ボタンが表示される', () => {
      render(<SessionCard session={mockSession} onClick={mockOnClick} />);

      const deleteButton = screen.getByTestId('delete-session-button');
      expect(deleteButton).toBeInTheDocument();
    });

    it('削除ボタンクリックでダイアログが開く', async () => {
      render(<SessionCard session={mockSession} onClick={mockOnClick} />);

      const deleteButton = screen.getByTestId('delete-session-button');
      fireEvent.click(deleteButton);

      // ダイアログが表示される
      await waitFor(() => {
        expect(screen.getByText('セッションを削除')).toBeInTheDocument();
      });
    });

    it('削除ボタンクリック時にカードのonClickが呼ばれない', () => {
      render(<SessionCard session={mockSession} onClick={mockOnClick} />);

      const deleteButton = screen.getByTestId('delete-session-button');
      fireEvent.click(deleteButton);

      // カードのonClickは呼ばれない
      expect(mockOnClick).not.toHaveBeenCalled();
    });

    it('削除確認後にdeleteSessionが呼ばれる', async () => {
      render(<SessionCard session={mockSession} onClick={mockOnClick} />);

      // 削除ボタンクリック
      const deleteButton = screen.getByTestId('delete-session-button');
      fireEvent.click(deleteButton);

      // ダイアログの削除ボタンをクリック
      await waitFor(() => {
        expect(screen.getByText('セッションを削除')).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: '削除' });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockDeleteSession).toHaveBeenCalledWith('test-session-id');
      });
    });

    it('キャンセルでダイアログが閉じdeleteSessionが呼ばれない', async () => {
      render(<SessionCard session={mockSession} onClick={mockOnClick} />);

      // 削除ボタンクリック
      const deleteButton = screen.getByTestId('delete-session-button');
      fireEvent.click(deleteButton);

      // ダイアログのキャンセルボタンをクリック
      await waitFor(() => {
        expect(screen.getByText('セッションを削除')).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: 'キャンセル' });
      fireEvent.click(cancelButton);

      // deleteSessionは呼ばれない
      expect(mockDeleteSession).not.toHaveBeenCalled();
    });
  });
});
