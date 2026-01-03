import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { SessionCard } from '../SessionCard';
import type { Session } from '@/store';

describe('SessionCard - Mobile Optimization', () => {
  afterEach(() => {
    cleanup();
  });

  const mockSession: Session = {
    id: 'session-1',
    project_id: 'project-1',
    name: 'Test Session',
    status: 'running',
    branch_name: 'feature/test',
    worktree_path: '/path/to/worktree',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  };

  const mockOnClick = () => {};

  it('カードの最小高さが120pxに設定されている', () => {
    const { container } = render(<SessionCard session={mockSession} onClick={mockOnClick} />);
    const card = container.firstChild as HTMLElement;
    expect(card).toHaveClass('min-h-[120px]');
  });

  it('タップ領域を確保するためにpaddingが設定されている', () => {
    const { container } = render(<SessionCard session={mockSession} onClick={mockOnClick} />);
    const card = container.firstChild as HTMLElement;
    expect(card).toHaveClass('p-4');
  });

  it('アクティブ状態のフィードバックが設定されている', () => {
    const { container } = render(<SessionCard session={mockSession} onClick={mockOnClick} />);
    const card = container.firstChild as HTMLElement;
    expect(card).toHaveClass('active:bg-gray-50');
    expect(card).toHaveClass('dark:active:bg-gray-700');
  });

  it('カーソルポインターが設定されている', () => {
    const { container } = render(<SessionCard session={mockSession} onClick={mockOnClick} />);
    const card = container.firstChild as HTMLElement;
    expect(card).toHaveClass('cursor-pointer');
  });

  it('ホバー効果が設定されている', () => {
    const { container } = render(<SessionCard session={mockSession} onClick={mockOnClick} />);
    const card = container.firstChild as HTMLElement;
    expect(card).toHaveClass('hover:shadow-lg');
  });

  it('トランジション効果が設定されている', () => {
    const { container } = render(<SessionCard session={mockSession} onClick={mockOnClick} />);
    const card = container.firstChild as HTMLElement;
    expect(card).toHaveClass('transition-all');
  });
});
