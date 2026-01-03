import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { SessionList } from '../SessionList';
import type { Session } from '@/store';

describe('SessionList - Mobile Responsive Layout', () => {
  afterEach(() => {
    cleanup();
  });

  const mockSessions: Session[] = [
    {
      id: 'session-1',
      project_id: 'project-1',
      name: 'Session 1',
      status: 'running',
      branch_name: 'feature/test-1',
      worktree_path: '/path/to/worktree-1',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    },
    {
      id: 'session-2',
      project_id: 'project-1',
      name: 'Session 2',
      status: 'completed',
      branch_name: 'feature/test-2',
      worktree_path: '/path/to/worktree-2',
      created_at: '2025-01-02T00:00:00Z',
      updated_at: '2025-01-02T00:00:00Z',
    },
  ];

  const mockOnClick = () => {};

  it('グリッドレイアウトが適用されている', () => {
    const { container } = render(<SessionList sessions={mockSessions} onSessionClick={mockOnClick} />);
    const grid = container.querySelector('.grid');
    expect(grid).toBeInTheDocument();
  });

  it('モバイル向けに1カラムが設定されている', () => {
    const { container } = render(<SessionList sessions={mockSessions} onSessionClick={mockOnClick} />);
    const grid = container.querySelector('.grid');
    expect(grid).toHaveClass('grid-cols-1');
  });

  it('タブレット向けに2カラムが設定されている', () => {
    const { container } = render(<SessionList sessions={mockSessions} onSessionClick={mockOnClick} />);
    const grid = container.querySelector('.grid');
    expect(grid).toHaveClass('md:grid-cols-2');
  });

  it('デスクトップ向けに3カラムが設定されている', () => {
    const { container } = render(<SessionList sessions={mockSessions} onSessionClick={mockOnClick} />);
    const grid = container.querySelector('.grid');
    expect(grid).toHaveClass('lg:grid-cols-3');
  });

  it('グリッドアイテム間のギャップが設定されている', () => {
    const { container } = render(<SessionList sessions={mockSessions} onSessionClick={mockOnClick} />);
    const grid = container.querySelector('.grid');
    expect(grid).toHaveClass('gap-4');
  });

  it('セッションが0件の場合、空の状態メッセージが表示される', () => {
    render(<SessionList sessions={[]} onSessionClick={mockOnClick} />);
    expect(screen.getByText('セッションがありません')).toBeInTheDocument();
  });

  it('複数のセッションが表示される', () => {
    render(<SessionList sessions={mockSessions} onSessionClick={mockOnClick} />);
    expect(screen.getByText('Session 1')).toBeInTheDocument();
    expect(screen.getByText('Session 2')).toBeInTheDocument();
  });
});
