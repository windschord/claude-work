import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PromptHistoryDropdown } from '../PromptHistoryDropdown';
import { useAppStore } from '@/store';

// Zustandストアのモック
vi.mock('@/store', () => ({
  useAppStore: vi.fn(),
}));

describe('PromptHistoryDropdown', () => {
  const mockOnSelect = vi.fn();
  const mockFetchPrompts = vi.fn();
  const mockDeletePrompt = vi.fn();

  const mockPrompts = [
    {
      id: 'prompt-1',
      content: 'Implement user authentication',
      used_count: 10,
      last_used_at: '2025-12-10T10:00:00Z',
    },
    {
      id: 'prompt-2',
      content: 'Add unit tests',
      used_count: 5,
      last_used_at: '2025-12-11T10:00:00Z',
    },
    {
      id: 'prompt-3',
      content: 'Fix bug in login',
      used_count: 3,
      last_used_at: '2025-12-12T10:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchPrompts.mockResolvedValue(undefined);
    mockDeletePrompt.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it('ドロップダウンが表示される', () => {
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      prompts: [],
      isLoading: false,
      error: null,
      fetchPrompts: mockFetchPrompts,
      deletePrompt: mockDeletePrompt,
    });

    render(<PromptHistoryDropdown onSelect={mockOnSelect} />);

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('コンポーネントマウント時にfetchPromptsが呼ばれる', () => {
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      prompts: [],
      isLoading: false,
      error: null,
      fetchPrompts: mockFetchPrompts,
      deletePrompt: mockDeletePrompt,
    });

    render(<PromptHistoryDropdown onSelect={mockOnSelect} />);

    expect(mockFetchPrompts).toHaveBeenCalledTimes(1);
  });

  it('プロンプト履歴が表示される', async () => {
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      prompts: mockPrompts,
      isLoading: false,
      error: null,
      fetchPrompts: mockFetchPrompts,
      deletePrompt: mockDeletePrompt,
    });

    render(<PromptHistoryDropdown onSelect={mockOnSelect} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Implement user authentication')).toBeInTheDocument();
      expect(screen.getByText('Add unit tests')).toBeInTheDocument();
      expect(screen.getByText('Fix bug in login')).toBeInTheDocument();
    });
  });

  it('プロンプトを選択するとonSelectが呼ばれる', async () => {
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      prompts: mockPrompts,
      isLoading: false,
      error: null,
      fetchPrompts: mockFetchPrompts,
      deletePrompt: mockDeletePrompt,
    });

    render(<PromptHistoryDropdown onSelect={mockOnSelect} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Implement user authentication')).toBeInTheDocument();
    });

    const promptOption = screen.getByText('Implement user authentication');
    fireEvent.click(promptOption);

    expect(mockOnSelect).toHaveBeenCalledWith('Implement user authentication');
  });

  it('削除ボタンをクリックするとdeletePromptが呼ばれる', async () => {
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      prompts: mockPrompts,
      isLoading: false,
      error: null,
      fetchPrompts: mockFetchPrompts,
      deletePrompt: mockDeletePrompt,
    });

    render(<PromptHistoryDropdown onSelect={mockOnSelect} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Implement user authentication')).toBeInTheDocument();
    });

    // 削除ボタンを探す（ゴミ箱アイコンやaria-labelで識別）
    const deleteButtons = screen.getAllByRole('button', { name: /削除/ });
    fireEvent.click(deleteButtons[0]);

    expect(mockDeletePrompt).toHaveBeenCalledWith('prompt-1');
  });

  it('履歴が空の場合、メッセージが表示される', async () => {
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      prompts: [],
      isLoading: false,
      error: null,
      fetchPrompts: mockFetchPrompts,
      deletePrompt: mockDeletePrompt,
    });

    render(<PromptHistoryDropdown onSelect={mockOnSelect} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/履歴がありません|プロンプト履歴はありません/)).toBeInTheDocument();
    });
  });

  it('ローディング中はローディング表示される', () => {
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      prompts: [],
      isLoading: true,
      error: null,
      fetchPrompts: mockFetchPrompts,
      deletePrompt: mockDeletePrompt,
    });

    render(<PromptHistoryDropdown onSelect={mockOnSelect} />);

    expect(screen.getByText(/読み込み中|Loading/)).toBeInTheDocument();
  });

  it('エラー時はエラーメッセージが表示される', () => {
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      prompts: [],
      isLoading: false,
      error: 'プロンプト履歴の取得に失敗しました',
      fetchPrompts: mockFetchPrompts,
      deletePrompt: mockDeletePrompt,
    });

    render(<PromptHistoryDropdown onSelect={mockOnSelect} />);

    expect(screen.getByText(/プロンプト履歴の取得に失敗しました/)).toBeInTheDocument();
  });

  it('最大10件のプロンプトが表示される', async () => {
    const manyPrompts = Array.from({ length: 15 }, (_, i) => ({
      id: `prompt-${i + 1}`,
      content: `Prompt ${i + 1}`,
      used_count: 15 - i,
      last_used_at: `2025-12-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
    }));

    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      prompts: manyPrompts,
      isLoading: false,
      error: null,
      fetchPrompts: mockFetchPrompts,
      deletePrompt: mockDeletePrompt,
    });

    render(<PromptHistoryDropdown onSelect={mockOnSelect} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      const displayedPrompts = screen.getAllByText(/^Prompt \d+$/);
      expect(displayedPrompts.length).toBeLessThanOrEqual(10);
    });
  });

  it('削除ボタンクリック時にonSelectは呼ばれない', async () => {
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      prompts: mockPrompts,
      isLoading: false,
      error: null,
      fetchPrompts: mockFetchPrompts,
      deletePrompt: mockDeletePrompt,
    });

    render(<PromptHistoryDropdown onSelect={mockOnSelect} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Implement user authentication')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole('button', { name: /削除/ });
    fireEvent.click(deleteButtons[0]);

    expect(mockOnSelect).not.toHaveBeenCalled();
    expect(mockDeletePrompt).toHaveBeenCalledWith('prompt-1');
  });

  it('used_countが降順で表示される', async () => {
    const unsortedPrompts = [
      {
        id: 'prompt-1',
        content: 'Low usage',
        used_count: 1,
        last_used_at: '2025-12-10T10:00:00Z',
      },
      {
        id: 'prompt-2',
        content: 'High usage',
        used_count: 100,
        last_used_at: '2025-12-11T10:00:00Z',
      },
      {
        id: 'prompt-3',
        content: 'Medium usage',
        used_count: 50,
        last_used_at: '2025-12-12T10:00:00Z',
      },
    ];

    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      prompts: unsortedPrompts,
      isLoading: false,
      error: null,
      fetchPrompts: mockFetchPrompts,
      deletePrompt: mockDeletePrompt,
    });

    render(<PromptHistoryDropdown onSelect={mockOnSelect} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      const items = screen.getAllByText(/usage$/);
      expect(items[0].textContent).toContain('High usage');
      expect(items[1].textContent).toContain('Medium usage');
      expect(items[2].textContent).toContain('Low usage');
    });
  });
});
