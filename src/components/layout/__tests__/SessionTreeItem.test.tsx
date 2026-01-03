/**
 * SessionTreeItemコンポーネントのテスト
 * Task 43.7: セッション名とステータスアイコンを表示するツリーノード
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SessionTreeItem } from '../SessionTreeItem';

describe('SessionTreeItem', () => {
  const mockSession = {
    id: 'session-1',
    name: 'テストセッション',
    status: 'running' as const,
    project_id: 'project-1',
    worktree_path: '/path/to/worktree',
    branch_name: 'feature/test',
    created_at: '2024-01-01T00:00:00Z',
  };

  it('セッション名が表示される', () => {
    render(
      <SessionTreeItem
        session={mockSession}
        isActive={false}
        onClick={() => {}}
      />
    );

    expect(screen.getByText('テストセッション')).toBeInTheDocument();
  });

  it('ステータスアイコンが表示される', () => {
    render(
      <SessionTreeItem
        session={mockSession}
        isActive={false}
        onClick={() => {}}
      />
    );

    expect(screen.getByTestId('status-icon-running')).toBeInTheDocument();
  });

  it('isActive=trueでハイライトされる', () => {
    render(
      <SessionTreeItem
        session={mockSession}
        isActive={true}
        onClick={() => {}}
      />
    );

    const item = screen.getByRole('button');
    expect(item).toHaveClass('bg-blue-50');
  });

  it('isActive=falseでハイライトされない', () => {
    render(
      <SessionTreeItem
        session={mockSession}
        isActive={false}
        onClick={() => {}}
      />
    );

    const item = screen.getByRole('button');
    expect(item).not.toHaveClass('bg-blue-50');
  });

  it('クリック時にonClickが呼ばれる', () => {
    const handleClick = vi.fn();
    render(
      <SessionTreeItem
        session={mockSession}
        isActive={false}
        onClick={handleClick}
      />
    );

    fireEvent.click(screen.getByRole('button'));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('各ステータスに対応したアイコンが表示される', () => {
    const statuses = ['initializing', 'running', 'waiting_input', 'completed', 'error', 'stopped'] as const;

    statuses.forEach((status) => {
      const { unmount } = render(
        <SessionTreeItem
          session={{ ...mockSession, status }}
          isActive={false}
          onClick={() => {}}
        />
      );

      expect(screen.getByTestId(`status-icon-${status}`)).toBeInTheDocument();
      unmount();
    });
  });
});
