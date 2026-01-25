/**
 * ProjectSettingsModalコンポーネントのテスト
 * Task 48.4: プロジェクト設定モーダル
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProjectSettingsModal } from '../ProjectSettingsModal';

// fetchをモック
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ProjectSettingsModal', () => {
  const mockProject = {
    id: 'project-1',
    name: 'テストプロジェクト',
    path: '/path/to/project',
    run_scripts: [
      { name: 'テスト実行', command: 'npm test' },
    ],
    session_count: 3,
    created_at: '2024-01-01T00:00:00Z',
  };

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
    project: mockProject,
  };

  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('isOpen=falseの場合、モーダルが表示されない', () => {
    render(<ProjectSettingsModal {...defaultProps} isOpen={false} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('isOpen=trueの場合、モーダルが表示される', () => {
    render(<ProjectSettingsModal {...defaultProps} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('タイトルが表示される', () => {
    render(<ProjectSettingsModal {...defaultProps} />);

    expect(screen.getByText('プロジェクト設定')).toBeInTheDocument();
  });

  it('プロジェクト名が初期値として表示される', () => {
    render(<ProjectSettingsModal {...defaultProps} />);

    const nameInput = screen.getByLabelText('プロジェクト名');
    expect(nameInput).toHaveValue('テストプロジェクト');
  });

  it('パスが初期値として表示される', () => {
    render(<ProjectSettingsModal {...defaultProps} />);

    const pathInput = screen.getByLabelText('リポジトリパス');
    expect(pathInput).toHaveValue('/path/to/project');
  });

  it('ランスクリプトが表示される', () => {
    render(<ProjectSettingsModal {...defaultProps} />);

    expect(screen.getByDisplayValue('テスト実行')).toBeInTheDocument();
    expect(screen.getByDisplayValue('npm test')).toBeInTheDocument();
  });

  it('ランスクリプト追加ボタンがある', () => {
    render(<ProjectSettingsModal {...defaultProps} />);

    expect(screen.getByRole('button', { name: /スクリプトを追加/ })).toBeInTheDocument();
  });

  it('保存ボタンがある', () => {
    render(<ProjectSettingsModal {...defaultProps} />);

    expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument();
  });

  it('キャンセルボタンクリックでonCloseが呼ばれる', () => {
    const onClose = vi.fn();
    render(<ProjectSettingsModal {...defaultProps} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('保存ボタンクリックでAPIが呼ばれる', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ project: mockProject }),
    });

    render(<ProjectSettingsModal {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/projects/${mockProject.id}`,
        expect.objectContaining({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });
  });

  it('保存成功時にonSuccessとonCloseが呼ばれる', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ project: mockProject }),
    });

    const onSuccess = vi.fn();
    const onClose = vi.fn();
    render(<ProjectSettingsModal {...defaultProps} onSuccess={onSuccess} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('APIエラー時にエラーメッセージが表示される', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: '更新に失敗しました' }),
    });

    render(<ProjectSettingsModal {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(screen.getByText('更新に失敗しました')).toBeInTheDocument();
    });
  });

  it('プロジェクト名を編集できる', () => {
    render(<ProjectSettingsModal {...defaultProps} />);

    const nameInput = screen.getByLabelText('プロジェクト名');
    fireEvent.change(nameInput, { target: { value: '新しい名前' } });

    expect(nameInput).toHaveValue('新しい名前');
  });

  it('ランスクリプトがない場合でも動作する', () => {
    const projectWithoutScripts = {
      ...mockProject,
      run_scripts: [],
    };

    render(<ProjectSettingsModal {...defaultProps} project={projectWithoutScripts} />);

    expect(screen.getByRole('button', { name: /スクリプトを追加/ })).toBeInTheDocument();
  });
});
