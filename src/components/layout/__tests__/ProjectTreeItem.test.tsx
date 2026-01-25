/**
 * ProjectTreeItemコンポーネントのテスト
 * Task 43.8: プロジェクト名と展開/折りたたみ機能を持つツリーノード
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectTreeItem } from '../ProjectTreeItem';

describe('ProjectTreeItem', () => {
  const mockProject = {
    id: 'project-1',
    name: 'テストプロジェクト',
    path: '/path/to/project',
    run_scripts: [],
    session_count: 3,
    created_at: '2024-01-01T00:00:00Z',
  };

  const mockSessions = [
    {
      id: 'session-1',
      name: 'セッション1',
      status: 'running' as const,
      project_id: 'project-1',
      worktree_path: '/path/to/worktree1',
      branch_name: 'feature/test1',
      created_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'session-2',
      name: 'セッション2',
      status: 'completed' as const,
      project_id: 'project-1',
      worktree_path: '/path/to/worktree2',
      branch_name: 'feature/test2',
      created_at: '2024-01-02T00:00:00Z',
    },
  ];

  it('プロジェクト名が表示される', () => {
    render(
      <ProjectTreeItem
        project={mockProject}
        sessions={mockSessions}
        isExpanded={false}
        currentSessionId={null}
        onToggle={() => {}}
        onSessionClick={() => {}}
        onAddSession={() => {}}
      />
    );

    expect(screen.getByText('テストプロジェクト')).toBeInTheDocument();
  });

  it('isExpanded=trueでセッションリストが表示される', () => {
    render(
      <ProjectTreeItem
        project={mockProject}
        sessions={mockSessions}
        isExpanded={true}
        currentSessionId={null}
        onToggle={() => {}}
        onSessionClick={() => {}}
        onAddSession={() => {}}
      />
    );

    expect(screen.getByText('セッション1')).toBeInTheDocument();
    expect(screen.getByText('セッション2')).toBeInTheDocument();
  });

  it('isExpanded=falseでセッションリストが非表示', () => {
    render(
      <ProjectTreeItem
        project={mockProject}
        sessions={mockSessions}
        isExpanded={false}
        currentSessionId={null}
        onToggle={() => {}}
        onSessionClick={() => {}}
        onAddSession={() => {}}
      />
    );

    expect(screen.queryByText('セッション1')).not.toBeInTheDocument();
    expect(screen.queryByText('セッション2')).not.toBeInTheDocument();
  });

  it('クリック時にonToggleが呼ばれる', () => {
    const handleToggle = vi.fn();
    render(
      <ProjectTreeItem
        project={mockProject}
        sessions={mockSessions}
        isExpanded={false}
        currentSessionId={null}
        onToggle={handleToggle}
        onSessionClick={() => {}}
        onAddSession={() => {}}
      />
    );

    fireEvent.click(screen.getByTestId('project-toggle'));

    expect(handleToggle).toHaveBeenCalledTimes(1);
  });

  it('「+」ボタンが表示される', () => {
    render(
      <ProjectTreeItem
        project={mockProject}
        sessions={mockSessions}
        isExpanded={false}
        currentSessionId={null}
        onToggle={() => {}}
        onSessionClick={() => {}}
        onAddSession={() => {}}
      />
    );

    expect(screen.getByTestId('add-session-button')).toBeInTheDocument();
  });

  it('「+」ボタンクリック時にonAddSessionが呼ばれる', () => {
    const handleAddSession = vi.fn();
    render(
      <ProjectTreeItem
        project={mockProject}
        sessions={mockSessions}
        isExpanded={false}
        currentSessionId={null}
        onToggle={() => {}}
        onSessionClick={() => {}}
        onAddSession={handleAddSession}
      />
    );

    fireEvent.click(screen.getByTestId('add-session-button'));

    expect(handleAddSession).toHaveBeenCalledTimes(1);
  });

  it('セッションクリック時にonSessionClickが呼ばれる', () => {
    const handleSessionClick = vi.fn();
    render(
      <ProjectTreeItem
        project={mockProject}
        sessions={mockSessions}
        isExpanded={true}
        currentSessionId={null}
        onToggle={() => {}}
        onSessionClick={handleSessionClick}
        onAddSession={() => {}}
      />
    );

    fireEvent.click(screen.getByText('セッション1'));

    expect(handleSessionClick).toHaveBeenCalledWith('session-1');
  });

  it('currentSessionIdに一致するセッションがハイライトされる', () => {
    render(
      <ProjectTreeItem
        project={mockProject}
        sessions={mockSessions}
        isExpanded={true}
        currentSessionId="session-1"
        onToggle={() => {}}
        onSessionClick={() => {}}
        onAddSession={() => {}}
      />
    );

    // セッション1のボタンがハイライトされていることを確認
    const sessionButtons = screen.getAllByRole('button');
    const session1Button = sessionButtons.find(btn => btn.textContent?.includes('セッション1'));
    expect(session1Button).toHaveClass('bg-blue-50');
  });

  it('展開アイコンがisExpandedに応じて変わる', () => {
    const { rerender } = render(
      <ProjectTreeItem
        project={mockProject}
        sessions={mockSessions}
        isExpanded={false}
        currentSessionId={null}
        onToggle={() => {}}
        onSessionClick={() => {}}
        onAddSession={() => {}}
      />
    );

    // 折りたたみ時はChevronRightアイコン
    expect(screen.getByTestId('chevron-right-icon')).toBeInTheDocument();

    rerender(
      <ProjectTreeItem
        project={mockProject}
        sessions={mockSessions}
        isExpanded={true}
        currentSessionId={null}
        onToggle={() => {}}
        onSessionClick={() => {}}
        onAddSession={() => {}}
      />
    );

    // 展開時はChevronDownアイコン
    expect(screen.getByTestId('chevron-down-icon')).toBeInTheDocument();
  });

  // コンテキストメニュー関連のテスト
  describe('コンテキストメニュー', () => {
    it('右クリックでコンテキストメニューが表示される', () => {
      render(
        <ProjectTreeItem
          project={mockProject}
          sessions={mockSessions}
          isExpanded={false}
          currentSessionId={null}
          onToggle={() => {}}
          onSessionClick={() => {}}
          onAddSession={() => {}}
        />
      );

      const projectToggle = screen.getByTestId('project-toggle');
      fireEvent.contextMenu(projectToggle);

      expect(screen.getByTestId('context-menu')).toBeInTheDocument();
    });

    it('コンテキストメニューに「設定」オプションがある', () => {
      render(
        <ProjectTreeItem
          project={mockProject}
          sessions={mockSessions}
          isExpanded={false}
          currentSessionId={null}
          onToggle={() => {}}
          onSessionClick={() => {}}
          onAddSession={() => {}}
        />
      );

      const projectToggle = screen.getByTestId('project-toggle');
      fireEvent.contextMenu(projectToggle);

      expect(screen.getByText('設定')).toBeInTheDocument();
    });

    it('コンテキストメニューに「削除」オプションがある', () => {
      render(
        <ProjectTreeItem
          project={mockProject}
          sessions={mockSessions}
          isExpanded={false}
          currentSessionId={null}
          onToggle={() => {}}
          onSessionClick={() => {}}
          onAddSession={() => {}}
        />
      );

      const projectToggle = screen.getByTestId('project-toggle');
      fireEvent.contextMenu(projectToggle);

      expect(screen.getByText('削除')).toBeInTheDocument();
    });

    it('「設定」クリックでonSettingsが呼ばれる', () => {
      const handleSettings = vi.fn();
      render(
        <ProjectTreeItem
          project={mockProject}
          sessions={mockSessions}
          isExpanded={false}
          currentSessionId={null}
          onToggle={() => {}}
          onSessionClick={() => {}}
          onAddSession={() => {}}
          onSettings={handleSettings}
        />
      );

      const projectToggle = screen.getByTestId('project-toggle');
      fireEvent.contextMenu(projectToggle);
      fireEvent.click(screen.getByText('設定'));

      expect(handleSettings).toHaveBeenCalledTimes(1);
    });

    it('「削除」クリックでonDeleteが呼ばれる', () => {
      const handleDelete = vi.fn();
      render(
        <ProjectTreeItem
          project={mockProject}
          sessions={mockSessions}
          isExpanded={false}
          currentSessionId={null}
          onToggle={() => {}}
          onSessionClick={() => {}}
          onAddSession={() => {}}
          onDelete={handleDelete}
        />
      );

      const projectToggle = screen.getByTestId('project-toggle');
      fireEvent.contextMenu(projectToggle);
      fireEvent.click(screen.getByText('削除'));

      expect(handleDelete).toHaveBeenCalledTimes(1);
    });
  });
});
