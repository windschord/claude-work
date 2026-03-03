import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AddProjectModal } from './AddProjectModal';

// Zustandストアのモック
vi.mock('@/store', () => ({
  useAppStore: vi.fn(() => ({
    addProject: vi.fn(),
    cloneProject: vi.fn(),
    fetchProjects: vi.fn(),
  })),
}));

// GitHub PAT hookのモック
vi.mock('@/hooks/useGitHubPATs', () => ({
  useGitHubPATs: vi.fn(() => ({
    pats: [],
    isLoading: false,
  })),
}));

// useEnvironments hookのモック
vi.mock('@/hooks/useEnvironments', () => ({
  useEnvironments: vi.fn(() => ({
    environments: [
      { id: 'env-1', name: 'Default Docker', type: 'DOCKER', description: 'Test env', config: '{}' },
    ],
    isLoading: false,
    error: null,
    hostEnvironmentDisabled: false,
  })),
}));

describe('AddProjectModal - キャンセルボタン', () => {
  it('キャンセルボタンをクリックするとonCloseが呼ばれる', async () => {
    const onClose = vi.fn();

    render(
      <AddProjectModal
        isOpen={true}
        onClose={onClose}
      />
    );

    // キャンセルボタンを取得
    const cancelButton = screen.getByRole('button', { name: /キャンセル/i });

    // クリック
    fireEvent.click(cancelButton);

    // onCloseが即座に呼ばれることを確認
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    }, { timeout: 1000 }); // 1秒以内に呼ばれるべき
  });

  it('キャンセルボタンをクリックするとonCloseが呼ばれる（ローカルタブ）', async () => {
    const onClose = vi.fn();

    render(
      <AddProjectModal
        isOpen={true}
        onClose={onClose}
      />
    );

    // ローカルタブをクリック（デフォルトはリモートタブ）
    const localTab = screen.getByRole('tab', { name: 'ローカル' });
    fireEvent.click(localTab);

    // フォームに入力
    const pathInput = screen.getByLabelText(/Gitリポジトリのパス/i);
    fireEvent.change(pathInput, { target: { value: '/test/path' } });

    // 入力値を確認
    expect(pathInput).toHaveValue('/test/path');

    // キャンセルボタンをクリック
    const cancelButton = screen.getByRole('button', { name: /キャンセル/i });
    fireEvent.click(cancelButton);

    // onCloseが呼ばれることを確認
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('Escキーでもダイアログが閉じる', async () => {
    const onClose = vi.fn();

    render(
      <AddProjectModal
        isOpen={true}
        onClose={onClose}
      />
    );

    // Dialogコンポーネント内でEscキーを押す
    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });

    // onCloseが呼ばれることを確認
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
