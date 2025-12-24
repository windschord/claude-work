import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Session } from '@/store';
import { SessionCard } from '../SessionCard';

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

    const card = container.querySelector('.hover\\:shadow-md');
    expect(card).toBeInTheDocument();
    expect(card).toHaveClass('hover:shadow-md');
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
});
