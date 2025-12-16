import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Project } from '@/store';

// next/navigationのモック
const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

import { ProjectCard } from '../ProjectCard';

describe('ProjectCard', () => {
  const mockProject: Project = {
    id: 'test-project-id',
    name: 'Test Project',
    path: '/path/to/project',
    default_model: 'claude-3-sonnet',
    run_scripts: [],
    session_count: 5,
    created_at: '2024-01-01T00:00:00Z',
  };

  const mockOnDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('「開く」ボタンをクリックすると、router.pushが呼ばれる', () => {
    render(<ProjectCard project={mockProject} onDelete={mockOnDelete} />);

    const openButton = screen.getByText('開く');
    fireEvent.click(openButton);

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/projects/test-project-id');
  });

  it('「開く」ボタンをクリックしても、onDeleteは呼ばれない', () => {
    render(<ProjectCard project={mockProject} onDelete={mockOnDelete} />);

    const openButton = screen.getByText('開く');
    fireEvent.click(openButton);

    expect(mockOnDelete).not.toHaveBeenCalled();
  });

  it('プロジェクト名とパスが表示される', () => {
    render(<ProjectCard project={mockProject} onDelete={mockOnDelete} />);

    expect(screen.getByText('Test Project')).toBeInTheDocument();
    expect(screen.getByText('/path/to/project')).toBeInTheDocument();
  });

  it('「削除」ボタンをクリックすると、onDeleteが呼ばれる', () => {
    render(<ProjectCard project={mockProject} onDelete={mockOnDelete} />);

    const deleteButton = screen.getByText('削除');
    fireEvent.click(deleteButton);

    expect(mockOnDelete).toHaveBeenCalledTimes(1);
    expect(mockOnDelete).toHaveBeenCalledWith(mockProject);
  });
});
