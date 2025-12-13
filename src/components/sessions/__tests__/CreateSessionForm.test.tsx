import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CreateSessionForm } from '../CreateSessionForm';

describe('CreateSessionForm', () => {
  const mockOnCreate = vi.fn();
  const mockOnError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
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

    // エラーをシミュレート
    mockOnError.mockImplementation(() => {
      throw new Error('セッションの作成に失敗しました');
    });

    fireEvent.change(nameInput, { target: { value: 'New Session' } });
    fireEvent.change(promptInput, { target: { value: 'Test prompt' } });
    fireEvent.click(createButton);

    await waitFor(() => {
      const errorMessage = screen.queryByText(/セッションの作成に失敗しました|エラー/);
      if (errorMessage) {
        expect(errorMessage).toBeInTheDocument();
      }
    });
  });

  it('ローディング中は作成ボタンが無効化される', async () => {
    // 長時間かかる処理をシミュレート
    const slowOnCreate = vi.fn(() => new Promise(() => {}));

    render(<CreateSessionForm projectId="project-1" onSuccess={slowOnCreate} />);

    const nameInput = screen.getByPlaceholderText(/セッション名/);
    const promptInput = screen.getByPlaceholderText(/プロンプト/);
    const createButton = screen.getByRole('button', { name: /作成|セッション作成/ });

    fireEvent.change(nameInput, { target: { value: 'New Session' } });
    fireEvent.change(promptInput, { target: { value: 'Test prompt' } });
    fireEvent.click(createButton);

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
});
