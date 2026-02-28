import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AddProjectWizard } from '../index';

// Mock useEnvironments
vi.mock('@/hooks/useEnvironments', () => ({
  useEnvironments: () => ({
    environments: [
      { id: 'env-1', name: 'Docker Default', type: 'DOCKER', is_default: true, config: '{}', created_at: '', updated_at: '' },
    ],
    isLoading: false,
    error: null,
    fetchEnvironments: vi.fn(),
    hostEnvironmentDisabled: false,
  }),
}));

// Mock useGitHubPATs
vi.mock('@/hooks/useGitHubPATs', () => ({
  useGitHubPATs: () => ({
    pats: [],
    isLoading: false,
    error: null,
    fetchPATs: vi.fn(),
    createPAT: vi.fn(),
  }),
}));

// Mock useAppStore
vi.mock('@/store', () => ({
  useAppStore: () => ({
    fetchProjects: vi.fn(),
    addProject: vi.fn(),
    cloneProject: vi.fn(),
  }),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('AddProjectWizard', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('isOpen=trueの時にモーダルが表示される', () => {
    render(<AddProjectWizard isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByText('プロジェクトを追加')).toBeInTheDocument();
  });

  it('isOpen=falseの時にモーダルが非表示', () => {
    render(<AddProjectWizard isOpen={false} onClose={mockOnClose} />);
    expect(screen.queryByText('プロジェクトを追加')).not.toBeInTheDocument();
  });

  it('プログレスバーが表示される', () => {
    render(<AddProjectWizard isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByText('環境')).toBeInTheDocument();
    expect(screen.getByText('認証')).toBeInTheDocument();
    expect(screen.getByText('リポジトリ')).toBeInTheDocument();
    expect(screen.getByText('セッション')).toBeInTheDocument();
  });

  it('初期ステップはStep 1（環境選択）', () => {
    render(<AddProjectWizard isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByText('実行環境を選択')).toBeInTheDocument();
  });

  it('「次へ」ボタンで Step 2 に遷移する', async () => {
    render(<AddProjectWizard isOpen={true} onClose={mockOnClose} />);

    const nextButton = screen.getByRole('button', { name: '次へ' });

    await waitFor(() => {
      expect(nextButton).not.toBeDisabled();
    });

    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText('認証情報設定')).toBeInTheDocument();
    });
  });

  it('Step 2で「戻る」ボタンクリックでStep 1に戻る', async () => {
    render(<AddProjectWizard isOpen={true} onClose={mockOnClose} />);

    // Step 2に進む
    const nextButton = screen.getByRole('button', { name: '次へ' });
    await waitFor(() => {
      expect(nextButton).not.toBeDisabled();
    });
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText('認証情報設定')).toBeInTheDocument();
    });

    // 「戻る」をクリック
    const backButton = screen.getByRole('button', { name: '戻る' });
    fireEvent.click(backButton);

    await waitFor(() => {
      expect(screen.getByText('実行環境を選択')).toBeInTheDocument();
    });
  });

  it('Step 1では「戻る」ボタンが非表示', () => {
    render(<AddProjectWizard isOpen={true} onClose={mockOnClose} />);
    expect(screen.queryByRole('button', { name: '戻る' })).not.toBeInTheDocument();
  });

  it('「キャンセル」ボタンでonCloseが呼ばれる', () => {
    render(<AddProjectWizard isOpen={true} onClose={mockOnClose} />);
    const cancelButton = screen.getByRole('button', { name: 'キャンセル' });
    fireEvent.click(cancelButton);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('Step 2から Step 3 に遷移できる', async () => {
    render(<AddProjectWizard isOpen={true} onClose={mockOnClose} />);

    // Step 1 -> Step 2
    const nextButton1 = screen.getByRole('button', { name: '次へ' });
    await waitFor(() => { expect(nextButton1).not.toBeDisabled(); });
    fireEvent.click(nextButton1);

    await waitFor(() => {
      expect(screen.getByText('認証情報設定')).toBeInTheDocument();
    });

    // Step 2 -> Step 3
    const nextButton2 = screen.getByRole('button', { name: '次へ' });
    fireEvent.click(nextButton2);

    await waitFor(() => {
      expect(screen.getByText('リポジトリ設定')).toBeInTheDocument();
    });
  });
});
