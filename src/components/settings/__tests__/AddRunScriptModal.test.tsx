import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AddRunScriptModal } from '../AddRunScriptModal';
import { useRunScriptStore } from '@/store/run-scripts';

// Zustandストアのモック
vi.mock('@/store/run-scripts', () => ({
  useRunScriptStore: vi.fn(),
}));

describe('AddRunScriptModal', () => {
  const mockAddScript = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockAddScript.mockResolvedValue(undefined);
    (useRunScriptStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      addScript: mockAddScript,
      isLoading: false,
      error: null,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('モーダルが開いている時、タイトルが表示される', () => {
    render(
      <AddRunScriptModal isOpen={true} onClose={mockOnClose} projectId="project-1" />
    );

    expect(screen.getByText('ランスクリプトを追加')).toBeInTheDocument();
  });

  it('モーダルが閉じている時、何も表示されない', () => {
    render(
      <AddRunScriptModal isOpen={false} onClose={mockOnClose} projectId="project-1" />
    );

    expect(screen.queryByText('ランスクリプトを追加')).not.toBeInTheDocument();
  });

  it('名前、説明、コマンド入力フォームが表示される', () => {
    render(
      <AddRunScriptModal isOpen={true} onClose={mockOnClose} projectId="project-1" />
    );

    expect(screen.getByPlaceholderText('Test')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Run unit tests (optional)')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('npm test')).toBeInTheDocument();
  });

  it('コマンド入力フィールドがfont-monoスタイルである', () => {
    render(
      <AddRunScriptModal isOpen={true} onClose={mockOnClose} projectId="project-1" />
    );

    const commandInput = screen.getByPlaceholderText('npm test');
    expect(commandInput).toHaveClass('font-mono');
  });

  it('「追加」ボタンと「キャンセル」ボタンが表示される', () => {
    render(
      <AddRunScriptModal isOpen={true} onClose={mockOnClose} projectId="project-1" />
    );

    expect(screen.getByRole('button', { name: '追加' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'キャンセル' })).toBeInTheDocument();
  });

  it('名前が未入力の場合、「追加」ボタンが無効化される', () => {
    render(
      <AddRunScriptModal isOpen={true} onClose={mockOnClose} projectId="project-1" />
    );

    const addButton = screen.getByRole('button', { name: '追加' });
    expect(addButton).toBeDisabled();
  });

  it('コマンドが未入力の場合、「追加」ボタンが無効化される', () => {
    render(
      <AddRunScriptModal isOpen={true} onClose={mockOnClose} projectId="project-1" />
    );

    const nameInput = screen.getByPlaceholderText('Test');
    fireEvent.change(nameInput, { target: { value: 'Test' } });

    const addButton = screen.getByRole('button', { name: '追加' });
    expect(addButton).toBeDisabled();
  });

  it('名前とコマンドを入力すると「追加」ボタンが有効化される', () => {
    render(
      <AddRunScriptModal isOpen={true} onClose={mockOnClose} projectId="project-1" />
    );

    const nameInput = screen.getByPlaceholderText('Test');
    const commandInput = screen.getByPlaceholderText('npm test');

    fireEvent.change(nameInput, { target: { value: 'Test' } });
    fireEvent.change(commandInput, { target: { value: 'npm test' } });

    const addButton = screen.getByRole('button', { name: '追加' });
    expect(addButton).not.toBeDisabled();
  });

  it('有効な入力でスクリプト追加が成功する', async () => {
    render(
      <AddRunScriptModal isOpen={true} onClose={mockOnClose} projectId="project-1" />
    );

    const nameInput = screen.getByPlaceholderText('Test');
    const descriptionInput = screen.getByPlaceholderText('Run unit tests (optional)');
    const commandInput = screen.getByPlaceholderText('npm test');
    const addButton = screen.getByRole('button', { name: '追加' });

    fireEvent.change(nameInput, { target: { value: 'Test' } });
    fireEvent.change(descriptionInput, { target: { value: 'Run unit tests' } });
    fireEvent.change(commandInput, { target: { value: 'npm test' } });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(mockAddScript).toHaveBeenCalledWith('project-1', {
        name: 'Test',
        description: 'Run unit tests',
        command: 'npm test',
      });
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('説明なしでスクリプト追加が成功する', async () => {
    render(
      <AddRunScriptModal isOpen={true} onClose={mockOnClose} projectId="project-1" />
    );

    const nameInput = screen.getByPlaceholderText('Test');
    const commandInput = screen.getByPlaceholderText('npm test');
    const addButton = screen.getByRole('button', { name: '追加' });

    fireEvent.change(nameInput, { target: { value: 'Build' } });
    fireEvent.change(commandInput, { target: { value: 'npm run build' } });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(mockAddScript).toHaveBeenCalledWith('project-1', {
        name: 'Build',
        description: '',
        command: 'npm run build',
      });
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('追加失敗時にエラーメッセージが表示される', async () => {
    mockAddScript.mockRejectedValueOnce(new Error('ランスクリプトの追加に失敗しました'));

    render(
      <AddRunScriptModal isOpen={true} onClose={mockOnClose} projectId="project-1" />
    );

    const nameInput = screen.getByPlaceholderText('Test');
    const commandInput = screen.getByPlaceholderText('npm test');
    const addButton = screen.getByRole('button', { name: '追加' });

    fireEvent.change(nameInput, { target: { value: 'Test' } });
    fireEvent.change(commandInput, { target: { value: 'npm test' } });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('ランスクリプトの追加に失敗しました')).toBeInTheDocument();
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  it('「キャンセル」ボタンでモーダルが閉じる', () => {
    render(
      <AddRunScriptModal isOpen={true} onClose={mockOnClose} projectId="project-1" />
    );

    const cancelButton = screen.getByRole('button', { name: 'キャンセル' });
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });
});
