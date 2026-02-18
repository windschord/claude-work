import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RemoteRepoForm } from '../RemoteRepoForm';

// useGitHubPATsフックのモック
vi.mock('@/hooks/useGitHubPATs', () => ({
  useGitHubPATs: vi.fn(() => ({
    pats: [
      { id: 'pat-1', name: 'Test PAT 1', description: 'Description 1', isActive: true },
      { id: 'pat-2', name: 'Test PAT 2', description: '', isActive: true },
      { id: 'pat-3', name: 'Inactive PAT', description: '', isActive: false },
    ],
    isLoading: false,
  })),
}));

describe('RemoteRepoForm', () => {
  const mockOnSubmit = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSubmit.mockResolvedValue(undefined);
  });

  describe('初期表示', () => {
    it('URLフィールドが表示される', () => {
      render(
        <RemoteRepoForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          isLoading={false}
        />
      );

      const urlInput = screen.getByLabelText('リポジトリURL');
      expect(urlInput).toBeInTheDocument();
      expect(urlInput).toHaveAttribute('placeholder', 'git@github.com:user/repo.git');
    });

    it('保存場所選択が表示される', () => {
      render(
        <RemoteRepoForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          isLoading={false}
        />
      );

      expect(screen.getByText('保存場所')).toBeInTheDocument();
      expect(screen.getByLabelText(/Docker環境/)).toBeInTheDocument();
      expect(screen.getByLabelText(/ホスト環境/)).toBeInTheDocument();
    });

    it('Dockerがデフォルトで選択されている', () => {
      render(
        <RemoteRepoForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          isLoading={false}
        />
      );

      const dockerRadio = screen.getByLabelText(/Docker環境/) as HTMLInputElement;
      const hostRadio = screen.getByLabelText(/ホスト環境/) as HTMLInputElement;

      expect(dockerRadio.checked).toBe(true);
      expect(hostRadio.checked).toBe(false);
    });

    it('Cloneボタンとキャンセルボタンが表示される', () => {
      render(
        <RemoteRepoForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          isLoading={false}
        />
      );

      expect(screen.getByRole('button', { name: 'Clone' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'キャンセル' })).toBeInTheDocument();
    });

    it('URLが空の場合、Cloneボタンが無効化される', () => {
      render(
        <RemoteRepoForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          isLoading={false}
        />
      );

      const cloneButton = screen.getByRole('button', { name: 'Clone' });
      expect(cloneButton).toBeDisabled();
    });
  });

  describe('URL入力', () => {
    it('URLを入力するとCloneボタンが有効化される', () => {
      render(
        <RemoteRepoForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          isLoading={false}
        />
      );

      const urlInput = screen.getByLabelText('リポジトリURL');
      const cloneButton = screen.getByRole('button', { name: 'Clone' });

      fireEvent.change(urlInput, { target: { value: 'git@github.com:user/repo.git' } });

      expect(cloneButton).not.toBeDisabled();
    });

    it('HTTPS URLを入力した場合、PAT選択が表示される（Docker環境時）', () => {
      render(
        <RemoteRepoForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          isLoading={false}
        />
      );

      const urlInput = screen.getByLabelText('リポジトリURL');

      // Docker環境を選択（デフォルト）
      fireEvent.change(urlInput, { target: { value: 'https://github.com/user/repo.git' } });

      expect(screen.getByLabelText('GitHub Personal Access Token')).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /Test PAT 1/ })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /Test PAT 2/ })).toBeInTheDocument();
    });

    it('SSH URLの場合、PAT選択は表示されない', () => {
      render(
        <RemoteRepoForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          isLoading={false}
        />
      );

      const urlInput = screen.getByLabelText('リポジトリURL');
      fireEvent.change(urlInput, { target: { value: 'git@github.com:user/repo.git' } });

      expect(screen.queryByLabelText('GitHub Personal Access Token')).not.toBeInTheDocument();
    });
  });

  describe('保存場所選択', () => {
    it('ホスト環境を選択できる', () => {
      render(
        <RemoteRepoForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          isLoading={false}
        />
      );

      const hostRadio = screen.getByLabelText(/ホスト環境/);
      fireEvent.click(hostRadio);

      const dockerRadio = screen.getByLabelText(/Docker環境/) as HTMLInputElement;
      const hostRadioInput = hostRadio as HTMLInputElement;

      expect(dockerRadio.checked).toBe(false);
      expect(hostRadioInput.checked).toBe(true);
    });

    it('Host環境選択時、HTTPS URLでもPAT選択は表示されない', () => {
      render(
        <RemoteRepoForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          isLoading={false}
        />
      );

      const urlInput = screen.getByLabelText('リポジトリURL');
      const hostRadio = screen.getByLabelText(/ホスト環境/);

      fireEvent.click(hostRadio);
      fireEvent.change(urlInput, { target: { value: 'https://github.com/user/repo.git' } });

      expect(screen.queryByLabelText('GitHub Personal Access Token')).not.toBeInTheDocument();
    });
  });

  describe('フォーム送信', () => {
    it('SSH URLでClone実行時、正しいパラメータでonSubmitが呼ばれる', async () => {
      render(
        <RemoteRepoForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          isLoading={false}
        />
      );

      const urlInput = screen.getByLabelText('リポジトリURL');
      const cloneButton = screen.getByRole('button', { name: 'Clone' });

      fireEvent.change(urlInput, { target: { value: 'git@github.com:user/repo.git' } });
      fireEvent.click(cloneButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          'git@github.com:user/repo.git',
          undefined,
          'docker',
          undefined
        );
      });
    });

    it('HTTPS URL + PAT選択時、正しいパラメータでonSubmitが呼ばれる', async () => {
      render(
        <RemoteRepoForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          isLoading={false}
        />
      );

      const urlInput = screen.getByLabelText('リポジトリURL');
      fireEvent.change(urlInput, { target: { value: 'https://github.com/user/repo.git' } });

      const patSelect = screen.getByLabelText('GitHub Personal Access Token');
      fireEvent.change(patSelect, { target: { value: 'pat-1' } });

      const cloneButton = screen.getByRole('button', { name: 'Clone' });
      fireEvent.click(cloneButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          'https://github.com/user/repo.git',
          undefined,
          'docker',
          'pat-1'
        );
      });
    });

    it('Host環境選択時、cloneLocationがhostになる', async () => {
      render(
        <RemoteRepoForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          isLoading={false}
        />
      );

      const urlInput = screen.getByLabelText('リポジトリURL');
      const hostRadio = screen.getByLabelText(/ホスト環境/);
      const cloneButton = screen.getByRole('button', { name: 'Clone' });

      fireEvent.click(hostRadio);
      fireEvent.change(urlInput, { target: { value: 'git@github.com:user/repo.git' } });
      fireEvent.click(cloneButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          'git@github.com:user/repo.git',
          undefined,
          'host',
          undefined
        );
      });
    });

    it('詳細設定でtargetDirを指定できる', async () => {
      render(
        <RemoteRepoForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          isLoading={false}
        />
      );

      const urlInput = screen.getByLabelText('リポジトリURL');
      fireEvent.change(urlInput, { target: { value: 'git@github.com:user/repo.git' } });

      // 詳細設定を開く
      const advancedButton = screen.getByText('詳細設定');
      fireEvent.click(advancedButton);

      const targetDirInput = screen.getByLabelText('Clone先ディレクトリ（任意）');
      fireEvent.change(targetDirInput, { target: { value: '/custom/path' } });

      const cloneButton = screen.getByRole('button', { name: 'Clone' });
      fireEvent.click(cloneButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          'git@github.com:user/repo.git',
          '/custom/path',
          'docker',
          undefined
        );
      });
    });
  });

  describe('キャンセル処理', () => {
    it('キャンセルボタンクリック時、onCancelが呼ばれる', () => {
      render(
        <RemoteRepoForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          isLoading={false}
        />
      );

      const cancelButton = screen.getByRole('button', { name: 'キャンセル' });
      fireEvent.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('エラー表示', () => {
    it('errorプロパティが渡された場合、エラーメッセージが表示される', () => {
      render(
        <RemoteRepoForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          isLoading={false}
          error="Clone failed: repository not found"
        />
      );

      expect(screen.getByText('Clone failed: repository not found')).toBeInTheDocument();
    });
  });

  describe('ローディング状態', () => {
    it('isLoadingがtrueの場合、入力フィールドが無効化される', () => {
      render(
        <RemoteRepoForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          isLoading={true}
        />
      );

      const urlInput = screen.getByLabelText('リポジトリURL');
      const dockerRadio = screen.getByLabelText(/Docker環境/);
      const hostRadio = screen.getByLabelText(/ホスト環境/);
      const cancelButton = screen.getByRole('button', { name: 'キャンセル' });

      expect(urlInput).toBeDisabled();
      expect(dockerRadio).toBeDisabled();
      expect(hostRadio).toBeDisabled();
      expect(cancelButton).toBeDisabled();
    });

    it('isLoadingがtrueの場合、Cloneボタンにスピナーが表示される', () => {
      render(
        <RemoteRepoForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          isLoading={true}
        />
      );

      expect(screen.getByText('Clone中...')).toBeInTheDocument();
    });
  });
});
