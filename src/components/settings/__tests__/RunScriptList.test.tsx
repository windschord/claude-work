import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RunScriptList } from '../RunScriptList';
import { useRunScriptStore } from '@/store/run-scripts';

// Zustandストアのモック
vi.mock('@/store/run-scripts', () => ({
  useRunScriptStore: vi.fn(),
}));

describe('RunScriptList', () => {
  const mockFetchScripts = vi.fn();
  const mockDeleteScript = vi.fn();
  const mockScripts = [
    {
      id: 'script-1',
      project_id: 'project-1',
      name: 'Test',
      description: 'Run unit tests',
      command: 'npm test',
      created_at: '2025-12-08T10:00:00Z',
      updated_at: '2025-12-08T10:00:00Z',
    },
    {
      id: 'script-2',
      project_id: 'project-1',
      name: 'Build',
      description: 'Build the project',
      command: 'npm run build',
      created_at: '2025-12-08T10:00:00Z',
      updated_at: '2025-12-08T10:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchScripts.mockResolvedValue(undefined);
    mockDeleteScript.mockResolvedValue(undefined);
    (useRunScriptStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      scripts: mockScripts,
      isLoading: false,
      error: null,
      fetchScripts: mockFetchScripts,
      deleteScript: mockDeleteScript,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('スクリプト一覧が表示される', () => {
    render(<RunScriptList projectId="project-1" />);

    expect(screen.getByText('Test')).toBeInTheDocument();
    expect(screen.getByText('Run unit tests')).toBeInTheDocument();
    expect(screen.getByText('npm test')).toBeInTheDocument();

    expect(screen.getByText('Build')).toBeInTheDocument();
    expect(screen.getByText('Build the project')).toBeInTheDocument();
    expect(screen.getByText('npm run build')).toBeInTheDocument();
  });

  it('「スクリプト追加」ボタンが表示される', () => {
    render(<RunScriptList projectId="project-1" />);

    expect(screen.getByRole('button', { name: 'スクリプト追加' })).toBeInTheDocument();
  });

  it('「スクリプト追加」ボタンをクリックするとモーダルが表示される', () => {
    render(<RunScriptList projectId="project-1" />);

    const addButton = screen.getByRole('button', { name: 'スクリプト追加' });
    fireEvent.click(addButton);

    expect(screen.getByText('ランスクリプトを追加')).toBeInTheDocument();
  });

  it('編集ボタンが表示される', () => {
    render(<RunScriptList projectId="project-1" />);

    const editButtons = screen.getAllByRole('button', { name: '編集' });
    expect(editButtons).toHaveLength(2);
  });

  it('削除ボタンが表示される', () => {
    render(<RunScriptList projectId="project-1" />);

    const deleteButtons = screen.getAllByRole('button', { name: '削除' });
    expect(deleteButtons).toHaveLength(2);
  });

  it('スクリプトが空の場合、メッセージが表示される', () => {
    (useRunScriptStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      scripts: [],
      isLoading: false,
      error: null,
      fetchScripts: mockFetchScripts,
      deleteScript: mockDeleteScript,
    });

    render(<RunScriptList projectId="project-1" />);

    expect(screen.getByText('スクリプトが登録されていません')).toBeInTheDocument();
  });

  it('ローディング中はスピナーが表示される', () => {
    (useRunScriptStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      scripts: [],
      isLoading: true,
      error: null,
      fetchScripts: mockFetchScripts,
      deleteScript: mockDeleteScript,
    });

    render(<RunScriptList projectId="project-1" />);

    expect(screen.getByText('読み込み中...')).toBeInTheDocument();
  });

  it('コンポーネントマウント時にスクリプトを取得する', () => {
    render(<RunScriptList projectId="project-1" />);

    expect(mockFetchScripts).toHaveBeenCalledWith('project-1');
  });
});
