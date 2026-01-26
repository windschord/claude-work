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

  // 削除アイコン関連のテスト
  describe('削除アイコン', () => {
    it('ホバー時に削除アイコンが表示される', () => {
      render(
        <SessionTreeItem
          session={mockSession}
          isActive={false}
          onClick={() => {}}
          onDelete={() => {}}
        />
      );

      const container = screen.getByTestId('session-tree-item');
      fireEvent.mouseEnter(container);

      expect(screen.getByTestId('delete-icon')).toBeInTheDocument();
    });

    it('非ホバー時は削除アイコンが表示されない', () => {
      render(
        <SessionTreeItem
          session={mockSession}
          isActive={false}
          onClick={() => {}}
          onDelete={() => {}}
        />
      );

      expect(screen.queryByTestId('delete-icon')).not.toBeInTheDocument();
    });

    it('削除アイコンクリックでonDeleteが呼ばれる', () => {
      const handleDelete = vi.fn();
      render(
        <SessionTreeItem
          session={mockSession}
          isActive={false}
          onClick={() => {}}
          onDelete={handleDelete}
        />
      );

      const container = screen.getByTestId('session-tree-item');
      fireEvent.mouseEnter(container);

      const deleteIcon = screen.getByTestId('delete-icon');
      fireEvent.click(deleteIcon);

      expect(handleDelete).toHaveBeenCalledTimes(1);
    });

    it('削除アイコンクリック時にセッションクリックは伝播しない', () => {
      const handleClick = vi.fn();
      const handleDelete = vi.fn();
      render(
        <SessionTreeItem
          session={mockSession}
          isActive={false}
          onClick={handleClick}
          onDelete={handleDelete}
        />
      );

      const container = screen.getByTestId('session-tree-item');
      fireEvent.mouseEnter(container);

      const deleteIcon = screen.getByTestId('delete-icon');
      fireEvent.click(deleteIcon);

      expect(handleDelete).toHaveBeenCalledTimes(1);
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  // PR番号表示関連のテスト
  describe('PR番号表示', () => {
    const sessionWithPR = {
      ...mockSession,
      pr_number: 123,
      pr_url: 'https://github.com/owner/repo/pull/123',
      pr_status: 'open' as const,
    };

    it('PRがある場合、PR番号が表示される', () => {
      render(
        <SessionTreeItem
          session={sessionWithPR}
          isActive={false}
          onClick={() => {}}
        />
      );

      expect(screen.getByText('#123')).toBeInTheDocument();
    });

    it('PRがない場合、PR番号は表示されない', () => {
      render(
        <SessionTreeItem
          session={mockSession}
          isActive={false}
          onClick={() => {}}
        />
      );

      expect(screen.queryByText(/#\d+/)).not.toBeInTheDocument();
    });

    it('ステータスがopenの場合、緑色のバッジが表示される', () => {
      render(
        <SessionTreeItem
          session={{ ...sessionWithPR, pr_status: 'open' }}
          isActive={false}
          onClick={() => {}}
        />
      );

      const badge = screen.getByTestId('pr-badge');
      expect(badge).toHaveClass('text-green-600');
    });

    it('ステータスがmergedの場合、紫色のバッジが表示される', () => {
      render(
        <SessionTreeItem
          session={{ ...sessionWithPR, pr_status: 'merged' }}
          isActive={false}
          onClick={() => {}}
        />
      );

      const badge = screen.getByTestId('pr-badge');
      expect(badge).toHaveClass('text-purple-600');
    });

    it('ステータスがclosedの場合、赤色のバッジが表示される', () => {
      render(
        <SessionTreeItem
          session={{ ...sessionWithPR, pr_status: 'closed' }}
          isActive={false}
          onClick={() => {}}
        />
      );

      const badge = screen.getByTestId('pr-badge');
      expect(badge).toHaveClass('text-red-600');
    });

    it('PRバッジクリックでセッションクリックは伝播しない', () => {
      const handleClick = vi.fn();
      // window.openをモック
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      render(
        <SessionTreeItem
          session={sessionWithPR}
          isActive={false}
          onClick={handleClick}
        />
      );

      const badge = screen.getByTestId('pr-badge');
      fireEvent.click(badge);

      expect(handleClick).not.toHaveBeenCalled();
      expect(openSpy).toHaveBeenCalledWith('https://github.com/owner/repo/pull/123', '_blank', 'noopener,noreferrer');

      openSpy.mockRestore();
    });
  });

  // 動作環境バッジ関連のテスト
  describe('動作環境バッジ', () => {
    it('環境タイプがHOSTの場合、緑色のHバッジが表示される', () => {
      const sessionWithHost = {
        ...mockSession,
        environment_type: 'HOST' as const,
        environment_name: 'Default Host',
      };

      render(
        <SessionTreeItem
          session={sessionWithHost}
          isActive={false}
          onClick={() => {}}
        />
      );

      const badge = screen.getByTestId('environment-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('H');
      expect(badge).toHaveClass('bg-green-100');
      expect(badge).toHaveAttribute('title', 'Default Host');
    });

    it('環境タイプがDOCKERの場合、青色のDバッジが表示される', () => {
      const sessionWithDocker = {
        ...mockSession,
        environment_type: 'DOCKER' as const,
        environment_name: 'Docker Dev',
      };

      render(
        <SessionTreeItem
          session={sessionWithDocker}
          isActive={false}
          onClick={() => {}}
        />
      );

      const badge = screen.getByTestId('environment-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('D');
      expect(badge).toHaveClass('bg-blue-100');
      expect(badge).toHaveAttribute('title', 'Docker Dev');
    });

    it('環境タイプがSSHの場合、紫色のSバッジが表示される', () => {
      const sessionWithSSH = {
        ...mockSession,
        environment_type: 'SSH' as const,
        environment_name: 'Remote Server',
      };

      render(
        <SessionTreeItem
          session={sessionWithSSH}
          isActive={false}
          onClick={() => {}}
        />
      );

      const badge = screen.getByTestId('environment-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('S');
      expect(badge).toHaveClass('bg-purple-100');
      expect(badge).toHaveAttribute('title', 'Remote Server');
    });

    it('環境タイプがnullの場合、バッジは表示されない', () => {
      const sessionWithoutEnv = {
        ...mockSession,
        environment_type: null,
        environment_name: null,
      };

      render(
        <SessionTreeItem
          session={sessionWithoutEnv}
          isActive={false}
          onClick={() => {}}
        />
      );

      expect(screen.queryByTestId('environment-badge')).not.toBeInTheDocument();
    });

    it('環境タイプが未定義の場合、バッジは表示されない', () => {
      render(
        <SessionTreeItem
          session={mockSession}
          isActive={false}
          onClick={() => {}}
        />
      );

      expect(screen.queryByTestId('environment-badge')).not.toBeInTheDocument();
    });

    it('環境名がnullの場合、環境タイプがツールチップに表示される', () => {
      const sessionWithTypeOnly = {
        ...mockSession,
        environment_type: 'DOCKER' as const,
        environment_name: null,
      };

      render(
        <SessionTreeItem
          session={sessionWithTypeOnly}
          isActive={false}
          onClick={() => {}}
        />
      );

      const badge = screen.getByTestId('environment-badge');
      expect(badge).toHaveAttribute('title', 'DOCKER');
    });
  });
});
