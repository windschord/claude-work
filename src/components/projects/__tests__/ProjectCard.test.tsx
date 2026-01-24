import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Project } from '@/store';

// next/navigationのモック
const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// useEnvironmentsのモック
vi.mock('@/hooks/useEnvironments', () => ({
  useEnvironments: () => ({
    environments: [
      { id: 'host-default', name: 'Local Host', type: 'HOST', is_default: true },
    ],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

import { ProjectCard } from '../ProjectCard';

describe('ProjectCard', () => {
  const mockProject: Project = {
    id: 'test-project-id',
    name: 'Test Project',
    path: '/path/to/project',
    run_scripts: [],
    session_count: 5,
    created_at: '2024-01-01T00:00:00Z',
  };

  const mockOnDelete = vi.fn();
  const mockOnSettings = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('「新規セッション」ボタンをクリックすると、モーダルが開く', async () => {
    render(<ProjectCard project={mockProject} onDelete={mockOnDelete} onSettings={mockOnSettings} />);

    const newSessionButton = screen.getByText('新規セッション');
    fireEvent.click(newSessionButton);

    await waitFor(() => {
      expect(screen.getByText('新規セッション作成')).toBeInTheDocument();
    });
  });

  it('「新規セッション」ボタンをクリックしても、onDeleteは呼ばれない', () => {
    render(<ProjectCard project={mockProject} onDelete={mockOnDelete} onSettings={mockOnSettings} />);

    const newSessionButton = screen.getByText('新規セッション');
    fireEvent.click(newSessionButton);

    expect(mockOnDelete).not.toHaveBeenCalled();
  });

  it('プロジェクト名とパスが表示される', () => {
    render(<ProjectCard project={mockProject} onDelete={mockOnDelete} onSettings={mockOnSettings} />);

    expect(screen.getByText('Test Project')).toBeInTheDocument();
    expect(screen.getByText('/path/to/project')).toBeInTheDocument();
  });

  it('「削除」ボタンをクリックすると、onDeleteが呼ばれる', () => {
    render(<ProjectCard project={mockProject} onDelete={mockOnDelete} onSettings={mockOnSettings} />);

    const deleteButton = screen.getByText('削除');
    fireEvent.click(deleteButton);

    expect(mockOnDelete).toHaveBeenCalledTimes(1);
    expect(mockOnDelete).toHaveBeenCalledWith(mockProject);
  });

  it('「設定」ボタンをクリックすると、onSettingsが呼ばれる', () => {
    render(<ProjectCard project={mockProject} onDelete={mockOnDelete} onSettings={mockOnSettings} />);

    const settingsButton = screen.getByText('設定');
    fireEvent.click(settingsButton);

    expect(mockOnSettings).toHaveBeenCalledTimes(1);
    expect(mockOnSettings).toHaveBeenCalledWith(mockProject);
  });

  it('「新規セッション」ボタンのクリックイベントが親要素に伝播しない', () => {
    const parentOnClick = vi.fn();
    render(
      <div onClick={parentOnClick}>
        <ProjectCard project={mockProject} onDelete={mockOnDelete} onSettings={mockOnSettings} />
      </div>
    );

    const newSessionButton = screen.getByText('新規セッション');
    fireEvent.click(newSessionButton);

    // 「新規セッション」ボタンがクリックされた時、親要素のonClickは呼ばれない
    expect(parentOnClick).not.toHaveBeenCalled();
  });

  it('「新規セッション」ボタンにtype="button"が設定されている', () => {
    render(<ProjectCard project={mockProject} onDelete={mockOnDelete} onSettings={mockOnSettings} />);

    const newSessionButton = screen.getByText('新規セッション');
    expect(newSessionButton).toHaveAttribute('type', 'button');
  });

  it('セッション数バッジが表示される', () => {
    render(<ProjectCard project={mockProject} onDelete={mockOnDelete} onSettings={mockOnSettings} />);

    expect(screen.getByText('5')).toBeInTheDocument();
  });
});
