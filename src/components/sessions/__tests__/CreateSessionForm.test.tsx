import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CreateSessionForm } from '../CreateSessionForm';
import { useAppStore } from '@/store';

// Zustandストアのモック
vi.mock('@/store', () => ({
  useAppStore: vi.fn(),
}));

describe('CreateSessionForm', () => {
  const mockOnCreate = vi.fn();
  const mockOnError = vi.fn();
  const mockCreateSession = vi.fn();
  const mockCreateBulkSessions = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateSession.mockResolvedValue(undefined);
    mockCreateBulkSessions.mockResolvedValue(undefined);
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector) =>
      selector({
        createSession: mockCreateSession,
        createBulkSessions: mockCreateBulkSessions,
        projects: [
          {
            id: 'project-1',
            name: 'Test Project',
            path: '/test/path',
            default_model: 'sonnet',
            run_scripts: [],
            session_count: 0,
            created_at: new Date().toISOString(),
          },
        ],
      })
    );
  });

  afterEach(() => {
    cleanup();
  });

  it('フォームが表示される', () => {
    render(<CreateSessionForm projectId="project-1" onSuccess={mockOnCreate} />);

    expect(screen.getByPlaceholderText(/セッション名/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/プロンプト/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /作成|セッション作成/ })).toBeInTheDocument();
  });

  it('名前入力フィールドが正しく動作する', () => {
    render(<CreateSessionForm projectId="project-1" onSuccess={mockOnCreate} />);

    const nameInput = screen.getByPlaceholderText(/セッション名/) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Test Session' } });

    expect(nameInput.value).toBe('Test Session');
  });

  it('プロンプト入力フィールドが正しく動作する', () => {
    render(<CreateSessionForm projectId="project-1" onSuccess={mockOnCreate} />);

    const promptInput = screen.getByPlaceholderText(/プロンプト/) as HTMLTextAreaElement;
    fireEvent.change(promptInput, { target: { value: 'Test prompt' } });

    expect(promptInput.value).toBe('Test prompt');
  });

  it('空のフィールドで送信すると名前のバリデーションエラーが表示される', async () => {
    render(<CreateSessionForm projectId="project-1" onSuccess={mockOnCreate} />);

    const createButton = screen.getByRole('button', { name: /作成|セッション作成/ });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('セッション名を入力してください')).toBeInTheDocument();
    });
  });

  it('名前のみ入力で送信するとプロンプトのバリデーションエラーが表示される', async () => {
    render(<CreateSessionForm projectId="project-1" onSuccess={mockOnCreate} />);

    const nameInput = screen.getByPlaceholderText(/セッション名/);
    const createButton = screen.getByRole('button', { name: /作成|セッション作成/ });

    fireEvent.change(nameInput, { target: { value: 'Test Session' } });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('プロンプトを入力してください')).toBeInTheDocument();
    });
  });

  it('有効な入力でセッション作成が成功する', async () => {
    render(<CreateSessionForm projectId="project-1" onSuccess={mockOnCreate} />);

    const nameInput = screen.getByPlaceholderText(/セッション名/);
    const promptInput = screen.getByPlaceholderText(/プロンプト/);
    const createButton = screen.getByRole('button', { name: /作成|セッション作成/ });

    fireEvent.change(nameInput, { target: { value: 'New Session' } });
    fireEvent.change(promptInput, { target: { value: 'Test prompt' } });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalledWith('project-1', {
        name: 'New Session',
        prompt: 'Test prompt',
        model: 'sonnet',
      });
      expect(mockOnCreate).toHaveBeenCalled();
    });
  });

  it('セッション作成後、フォームがクリアされる', async () => {
    render(<CreateSessionForm projectId="project-1" onSuccess={mockOnCreate} />);

    const nameInput = screen.getByPlaceholderText(/セッション名/) as HTMLInputElement;
    const promptInput = screen.getByPlaceholderText(/プロンプト/) as HTMLTextAreaElement;
    const createButton = screen.getByRole('button', { name: /作成|セッション作成/ });

    fireEvent.change(nameInput, { target: { value: 'New Session' } });
    fireEvent.change(promptInput, { target: { value: 'Test prompt' } });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(nameInput.value).toBe('');
      expect(promptInput.value).toBe('');
    });
  });

  it('セッション作成失敗時にエラーメッセージが表示される', async () => {
    // createSessionがエラーを返すようにモック
    mockCreateSession.mockRejectedValueOnce(new Error('セッションの作成に失敗しました'));

    render(
      <CreateSessionForm
        projectId="project-1"
        onSuccess={mockOnCreate}
        onError={mockOnError}
      />
    );

    const nameInput = screen.getByPlaceholderText(/セッション名/);
    const promptInput = screen.getByPlaceholderText(/プロンプト/);
    const createButton = screen.getByRole('button', { name: /作成|セッション作成/ });

    fireEvent.change(nameInput, { target: { value: 'New Session' } });
    fireEvent.change(promptInput, { target: { value: 'Test prompt' } });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('セッションの作成に失敗しました')).toBeInTheDocument();
    });
  });

  it('ローディング中は作成ボタンが無効化される', async () => {
    // 長時間かかる処理をシミュレート
    let _resolveCreateSession: () => void;
    const createSessionPromise = new Promise<void>((resolve) => {
      _resolveCreateSession = resolve;
    });
    mockCreateSession.mockReturnValue(createSessionPromise);

    render(<CreateSessionForm projectId="project-1" onSuccess={mockOnCreate} />);

    const nameInput = screen.getByPlaceholderText(/セッション名/);
    const promptInput = screen.getByPlaceholderText(/プロンプト/);
    const createButton = screen.getByRole('button', { name: /作成|セッション作成/ });

    fireEvent.change(nameInput, { target: { value: 'New Session' } });
    fireEvent.change(promptInput, { target: { value: 'Test prompt' } });

    // クリック前はボタンは有効
    expect(createButton).not.toBeDisabled();

    fireEvent.click(createButton);

    // クリック後はボタンが無効化される
    await waitFor(() => {
      expect(createButton).toBeDisabled();
    });
  });

  it('名前フィールドにラベルが表示される', () => {
    render(<CreateSessionForm projectId="project-1" onSuccess={mockOnCreate} />);

    expect(screen.getByText(/セッション名|名前/)).toBeInTheDocument();
  });

  it('プロンプトフィールドにラベルが表示される', () => {
    render(<CreateSessionForm projectId="project-1" onSuccess={mockOnCreate} />);

    expect(screen.getByText(/プロンプト/)).toBeInTheDocument();
  });

  it('モデル選択フィールドが表示される', () => {
    render(<CreateSessionForm projectId="project-1" onSuccess={mockOnCreate} />);

    const modelSelect = screen.getByLabelText(/モデル/);
    expect(modelSelect).toBeInTheDocument();
    expect(modelSelect).toHaveValue('sonnet'); // デフォルトモデル
  });

  it('モデル選択が正しく動作する', () => {
    render(<CreateSessionForm projectId="project-1" onSuccess={mockOnCreate} />);

    const modelSelect = screen.getByLabelText(/モデル/) as HTMLSelectElement;
    fireEvent.change(modelSelect, { target: { value: 'opus' } });

    expect(modelSelect.value).toBe('opus');
  });

  it('作成数選択フィールドが表示される', () => {
    render(<CreateSessionForm projectId="project-1" onSuccess={mockOnCreate} />);

    const countSelect = screen.getByLabelText(/作成するセッション数/);
    expect(countSelect).toBeInTheDocument();
    expect(countSelect).toHaveValue('1'); // デフォルト値
  });

  it('作成数選択が正しく動作する', () => {
    render(<CreateSessionForm projectId="project-1" onSuccess={mockOnCreate} />);

    const countSelect = screen.getByLabelText(/作成するセッション数/) as HTMLSelectElement;
    fireEvent.change(countSelect, { target: { value: '3' } });

    expect(countSelect.value).toBe('3');
  });

  it('作成数が1の場合は単一セッション作成が呼ばれる', async () => {
    render(<CreateSessionForm projectId="project-1" onSuccess={mockOnCreate} />);

    const nameInput = screen.getByPlaceholderText(/セッション名/);
    const promptInput = screen.getByPlaceholderText(/プロンプト/);
    const modelSelect = screen.getByLabelText(/モデル/);
    const countSelect = screen.getByLabelText(/作成するセッション数/);
    const createButton = screen.getByRole('button', { name: /作成|セッション作成/ });

    fireEvent.change(nameInput, { target: { value: 'New Session' } });
    fireEvent.change(promptInput, { target: { value: 'Test prompt' } });
    fireEvent.change(modelSelect, { target: { value: 'opus' } });
    fireEvent.change(countSelect, { target: { value: '1' } });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalledWith('project-1', {
        name: 'New Session',
        prompt: 'Test prompt',
        model: 'opus',
      });
      expect(mockCreateBulkSessions).not.toHaveBeenCalled();
      expect(mockOnCreate).toHaveBeenCalled();
    });
  });

  it('作成数が2以上の場合は一括セッション作成が呼ばれる', async () => {
    render(<CreateSessionForm projectId="project-1" onSuccess={mockOnCreate} />);

    const nameInput = screen.getByPlaceholderText(/セッション名/);
    const promptInput = screen.getByPlaceholderText(/プロンプト/);
    const modelSelect = screen.getByLabelText(/モデル/);
    const countSelect = screen.getByLabelText(/作成するセッション数/);
    const createButton = screen.getByRole('button', { name: /作成|セッション作成/ });

    fireEvent.change(nameInput, { target: { value: 'Bulk Session' } });
    fireEvent.change(promptInput, { target: { value: 'Test prompt' } });
    fireEvent.change(modelSelect, { target: { value: 'haiku' } });
    fireEvent.change(countSelect, { target: { value: '5' } });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockCreateBulkSessions).toHaveBeenCalledWith('project-1', {
        name: 'Bulk Session',
        prompt: 'Test prompt',
        model: 'haiku',
        count: 5,
      });
      expect(mockCreateSession).not.toHaveBeenCalled();
      expect(mockOnCreate).toHaveBeenCalled();
    });
  });

  it('一括セッション作成後、フォームがクリアされる', async () => {
    render(<CreateSessionForm projectId="project-1" onSuccess={mockOnCreate} />);

    const nameInput = screen.getByPlaceholderText(/セッション名/) as HTMLInputElement;
    const promptInput = screen.getByPlaceholderText(/プロンプト/) as HTMLTextAreaElement;
    const modelSelect = screen.getByLabelText(/モデル/) as HTMLSelectElement;
    const countSelect = screen.getByLabelText(/作成するセッション数/) as HTMLSelectElement;
    const createButton = screen.getByRole('button', { name: /作成|セッション作成/ });

    fireEvent.change(nameInput, { target: { value: 'Bulk Session' } });
    fireEvent.change(promptInput, { target: { value: 'Test prompt' } });
    fireEvent.change(modelSelect, { target: { value: 'opus' } });
    fireEvent.change(countSelect, { target: { value: '3' } });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(nameInput.value).toBe('');
      expect(promptInput.value).toBe('');
      expect(modelSelect.value).toBe('sonnet'); // デフォルトモデルに戻る
      expect(countSelect.value).toBe('1'); // デフォルト値に戻る
    });
  });
});
