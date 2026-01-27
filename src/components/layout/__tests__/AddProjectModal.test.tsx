/**
 * AddProjectModalコンポーネントのテスト
 * Task 48.2: リポジトリ追加モーダル
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AddProjectModal } from '../AddProjectModal';

// fetchをモック
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('AddProjectModal', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('isOpen=falseの場合、モーダルが表示されない', () => {
    render(
      <AddProjectModal
        isOpen={false}
        onClose={() => {}}
        onSuccess={() => {}}
      />
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('isOpen=trueの場合、モーダルが表示される', () => {
    render(
      <AddProjectModal
        isOpen={true}
        onClose={() => {}}
        onSuccess={() => {}}
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('タイトルが表示される', () => {
    render(
      <AddProjectModal
        isOpen={true}
        onClose={() => {}}
        onSuccess={() => {}}
      />
    );

    expect(screen.getByText('リポジトリを追加')).toBeInTheDocument();
  });

  it('パス入力フィールドがある', () => {
    render(
      <AddProjectModal
        isOpen={true}
        onClose={() => {}}
        onSuccess={() => {}}
      />
    );

    expect(screen.getByLabelText('リポジトリパス')).toBeInTheDocument();
  });

  it('名前入力フィールドがある', () => {
    render(
      <AddProjectModal
        isOpen={true}
        onClose={() => {}}
        onSuccess={() => {}}
      />
    );

    expect(screen.getByLabelText('表示名（オプション）')).toBeInTheDocument();
  });

  it('パスが空の場合、追加ボタンがdisabledになる', () => {
    render(
      <AddProjectModal
        isOpen={true}
        onClose={() => {}}
        onSuccess={() => {}}
      />
    );

    const addButton = screen.getByRole('button', { name: '追加' });
    expect(addButton).toBeDisabled();
  });

  it('パスを入力すると追加ボタンが有効になる', () => {
    render(
      <AddProjectModal
        isOpen={true}
        onClose={() => {}}
        onSuccess={() => {}}
      />
    );

    const pathInput = screen.getByLabelText('リポジトリパス');
    fireEvent.change(pathInput, { target: { value: '/path/to/repo' } });

    const addButton = screen.getByRole('button', { name: '追加' });
    expect(addButton).not.toBeDisabled();
  });

  it('キャンセルボタンクリックでonCloseが呼ばれる', () => {
    const handleClose = vi.fn();
    render(
      <AddProjectModal
        isOpen={true}
        onClose={handleClose}
        onSuccess={() => {}}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }));

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('追加ボタンクリックでAPIが呼ばれる', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ project: { id: 'new-project-id' } }),
    });

    const handleSuccess = vi.fn();
    render(
      <AddProjectModal
        isOpen={true}
        onClose={() => {}}
        onSuccess={handleSuccess}
      />
    );

    const pathInput = screen.getByLabelText('リポジトリパス');
    fireEvent.change(pathInput, { target: { value: '/path/to/repo' } });

    fireEvent.click(screen.getByRole('button', { name: '追加' }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/projects', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: '/path/to/repo' }),
      }));
    });
  });

  it('追加成功時にonSuccessが呼ばれる', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ project: { id: 'new-project-id' } }),
    });

    const handleSuccess = vi.fn();
    const handleClose = vi.fn();
    render(
      <AddProjectModal
        isOpen={true}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />
    );

    const pathInput = screen.getByLabelText('リポジトリパス');
    fireEvent.change(pathInput, { target: { value: '/path/to/repo' } });

    fireEvent.click(screen.getByRole('button', { name: '追加' }));

    await waitFor(() => {
      expect(handleSuccess).toHaveBeenCalledTimes(1);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  it('APIエラー時にエラーメッセージが表示される', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: '既に登録されています' }),
    });

    render(
      <AddProjectModal
        isOpen={true}
        onClose={() => {}}
        onSuccess={() => {}}
      />
    );

    const pathInput = screen.getByLabelText('リポジトリパス');
    fireEvent.change(pathInput, { target: { value: '/path/to/repo' } });

    fireEvent.click(screen.getByRole('button', { name: '追加' }));

    await waitFor(() => {
      expect(screen.getByText('既に登録されています')).toBeInTheDocument();
    });
  });

  it('名前を入力した場合、APIに名前が含まれる', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ project: { id: 'new-project-id' } }),
    });

    render(
      <AddProjectModal
        isOpen={true}
        onClose={() => {}}
        onSuccess={() => {}}
      />
    );

    const pathInput = screen.getByLabelText('リポジトリパス');
    const nameInput = screen.getByLabelText('表示名（オプション）');
    fireEvent.change(pathInput, { target: { value: '/path/to/repo' } });
    fireEvent.change(nameInput, { target: { value: 'My Project' } });

    fireEvent.click(screen.getByRole('button', { name: '追加' }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/projects', expect.objectContaining({
        body: JSON.stringify({ path: '/path/to/repo', name: 'My Project' }),
      }));
    });
  });
});
