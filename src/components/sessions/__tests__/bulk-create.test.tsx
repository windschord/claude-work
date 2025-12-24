import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CreateSessionForm } from '../CreateSessionForm';
import { useAppStore } from '@/store';

// Zustandストアのモック
vi.mock('@/store', () => ({
  useAppStore: vi.fn(),
}));

describe('CreateSessionForm - Bulk Create', () => {
  const mockOnCreate = vi.fn();
  const mockOnError = vi.fn();
  const mockCreateSession = vi.fn();
  const mockCreateBulkSessions = vi.fn();
  const mockProjects = [
    {
      id: 'project-1',
      name: 'Test Project',
      path: '/path/to/project',
      default_model: 'sonnet',
      run_scripts: [],
      session_count: 0,
      created_at: '2024-01-01T00:00:00.000Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateSession.mockResolvedValue(undefined);
    mockCreateBulkSessions.mockResolvedValue(undefined);
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector) =>
      selector({
        createSession: mockCreateSession,
        createBulkSessions: mockCreateBulkSessions,
        projects: mockProjects,
      })
    );
  });

  afterEach(() => {
    cleanup();
  });

  it('セッション数選択ドロップダウンが表示される', () => {
    render(<CreateSessionForm projectId="project-1" onSuccess={mockOnCreate} />);

    const countSelect = screen.getByLabelText(/作成するセッション数/);
    expect(countSelect).toBeInTheDocument();
  });

  it('セッション数選択に1〜10のオプションがある', () => {
    render(<CreateSessionForm projectId="project-1" onSuccess={mockOnCreate} />);

    const countSelect = screen.getByLabelText(/作成するセッション数/) as HTMLSelectElement;
    const options = Array.from(countSelect.options).map((opt) => opt.value);

    expect(options).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
  });

  it('セッション数のデフォルト値が1である', () => {
    render(<CreateSessionForm projectId="project-1" onSuccess={mockOnCreate} />);

    const countSelect = screen.getByLabelText(/作成するセッション数/) as HTMLSelectElement;
    expect(countSelect.value).toBe('1');
  });

  it('セッション数を変更できる', () => {
    render(<CreateSessionForm projectId="project-1" onSuccess={mockOnCreate} />);

    const countSelect = screen.getByLabelText(/作成するセッション数/) as HTMLSelectElement;
    fireEvent.change(countSelect, { target: { value: '5' } });

    expect(countSelect.value).toBe('5');
  });

  it('count=1で単一セッション作成（createSession呼び出し）', async () => {
    render(<CreateSessionForm projectId="project-1" onSuccess={mockOnCreate} />);

    const nameInput = screen.getByPlaceholderText(/セッション名/);
    const promptInput = screen.getByPlaceholderText(/プロンプト/);
    const countSelect = screen.getByLabelText(/作成するセッション数/);
    const createButton = screen.getByRole('button', { name: /作成|セッション作成/ });

    fireEvent.change(nameInput, { target: { value: 'Test Session' } });
    fireEvent.change(promptInput, { target: { value: 'Test prompt' } });
    fireEvent.change(countSelect, { target: { value: '1' } });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalledWith('project-1', {
        name: 'Test Session',
        prompt: 'Test prompt',
        model: expect.any(String),
      });
      expect(mockCreateBulkSessions).not.toHaveBeenCalled();
      expect(mockOnCreate).toHaveBeenCalled();
    });
  });

  it('count>1で一括セッション作成（createBulkSessions呼び出し）', async () => {
    render(<CreateSessionForm projectId="project-1" onSuccess={mockOnCreate} />);

    const nameInput = screen.getByPlaceholderText(/セッション名/);
    const promptInput = screen.getByPlaceholderText(/プロンプト/);
    const countSelect = screen.getByLabelText(/作成するセッション数/);
    const createButton = screen.getByRole('button', { name: /作成|セッション作成/ });

    fireEvent.change(nameInput, { target: { value: 'Feature' } });
    fireEvent.change(promptInput, { target: { value: 'Test prompt' } });
    fireEvent.change(countSelect, { target: { value: '3' } });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockCreateBulkSessions).toHaveBeenCalledWith('project-1', {
        name: 'Feature',
        prompt: 'Test prompt',
        model: expect.any(String),
        count: 3,
      });
      expect(mockCreateSession).not.toHaveBeenCalled();
      expect(mockOnCreate).toHaveBeenCalled();
    });
  });

  it('count=10で最大数の一括作成', async () => {
    render(<CreateSessionForm projectId="project-1" onSuccess={mockOnCreate} />);

    const nameInput = screen.getByPlaceholderText(/セッション名/);
    const promptInput = screen.getByPlaceholderText(/プロンプト/);
    const countSelect = screen.getByLabelText(/作成するセッション数/);
    const createButton = screen.getByRole('button', { name: /作成|セッション作成/ });

    fireEvent.change(nameInput, { target: { value: 'Feature' } });
    fireEvent.change(promptInput, { target: { value: 'Test prompt' } });
    fireEvent.change(countSelect, { target: { value: '10' } });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockCreateBulkSessions).toHaveBeenCalledWith('project-1', {
        name: 'Feature',
        prompt: 'Test prompt',
        model: expect.any(String),
        count: 10,
      });
    });
  });

  it('一括作成後、フォームがクリアされる', async () => {
    render(<CreateSessionForm projectId="project-1" onSuccess={mockOnCreate} />);

    const nameInput = screen.getByPlaceholderText(/セッション名/) as HTMLInputElement;
    const promptInput = screen.getByPlaceholderText(/プロンプト/) as HTMLTextAreaElement;
    const countSelect = screen.getByLabelText(/作成するセッション数/) as HTMLSelectElement;
    const createButton = screen.getByRole('button', { name: /作成|セッション作成/ });

    fireEvent.change(nameInput, { target: { value: 'Feature' } });
    fireEvent.change(promptInput, { target: { value: 'Test prompt' } });
    fireEvent.change(countSelect, { target: { value: '5' } });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(nameInput.value).toBe('');
      expect(promptInput.value).toBe('');
      expect(countSelect.value).toBe('1');
    });
  });

  it('一括作成失敗時にエラーメッセージが表示される', async () => {
    mockCreateBulkSessions.mockRejectedValueOnce(
      new Error('一括セッションの作成に失敗しました')
    );

    render(
      <CreateSessionForm
        projectId="project-1"
        onSuccess={mockOnCreate}
        onError={mockOnError}
      />
    );

    const nameInput = screen.getByPlaceholderText(/セッション名/);
    const promptInput = screen.getByPlaceholderText(/プロンプト/);
    const countSelect = screen.getByLabelText(/作成するセッション数/);
    const createButton = screen.getByRole('button', { name: /作成|セッション作成/ });

    fireEvent.change(nameInput, { target: { value: 'Feature' } });
    fireEvent.change(promptInput, { target: { value: 'Test prompt' } });
    fireEvent.change(countSelect, { target: { value: '3' } });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('一括セッションの作成に失敗しました')).toBeInTheDocument();
      expect(mockOnError).toHaveBeenCalled();
    });
  });

  it('一括作成中は作成ボタンが無効化される', async () => {
    let _resolveCreateBulkSessions: () => void;
    const createBulkSessionsPromise = new Promise<void>((resolve) => {
      _resolveCreateBulkSessions = resolve;
    });
    mockCreateBulkSessions.mockReturnValue(createBulkSessionsPromise);

    render(<CreateSessionForm projectId="project-1" onSuccess={mockOnCreate} />);

    const nameInput = screen.getByPlaceholderText(/セッション名/);
    const promptInput = screen.getByPlaceholderText(/プロンプト/);
    const countSelect = screen.getByLabelText(/作成するセッション数/);
    const createButton = screen.getByRole('button', { name: /作成|セッション作成/ });

    fireEvent.change(nameInput, { target: { value: 'Feature' } });
    fireEvent.change(promptInput, { target: { value: 'Test prompt' } });
    fireEvent.change(countSelect, { target: { value: '3' } });

    expect(createButton).not.toBeDisabled();

    fireEvent.click(createButton);

    await waitFor(() => {
      expect(createButton).toBeDisabled();
    });
  });
});
