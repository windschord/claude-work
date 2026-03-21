import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EnvVarImportSection } from '../EnvVarImportSection';

// fetch をモック
const mockFetch = vi.fn();
global.fetch = mockFetch;

function createDefaultProps(overrides: Partial<Parameters<typeof EnvVarImportSection>[0]> = {}) {
  return {
    projectId: 'test-project-id',
    existingVars: {},
    onImport: vi.fn(),
    ...overrides,
  };
}

describe('EnvVarImportSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('初期状態でインポートボタンが表示される', () => {
    render(<EnvVarImportSection {...createDefaultProps()} />);
    expect(screen.getByText('.envからインポート')).toBeInTheDocument();
  });

  it('disabled時にボタンが無効化される', () => {
    render(<EnvVarImportSection {...createDefaultProps({ disabled: true })} />);
    const button = screen.getByText('.envからインポート');
    expect(button).toBeDisabled();
  });

  it('ファイル一覧取得中にローディング表示される', async () => {
    // fetchを遅延させる
    mockFetch.mockReturnValue(new Promise(() => {}));

    render(<EnvVarImportSection {...createDefaultProps()} />);
    fireEvent.click(screen.getByText('.envからインポート'));

    await waitFor(() => {
      expect(screen.getByText('ファイル一覧を取得中...')).toBeInTheDocument();
    });
  });

  it('ファイルが見つからない場合にメッセージが表示される', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ files: [] }),
    });

    render(<EnvVarImportSection {...createDefaultProps()} />);
    fireEvent.click(screen.getByText('.envからインポート'));

    await waitFor(() => {
      expect(screen.getByText('.envファイルが見つかりません')).toBeInTheDocument();
    });
  });

  it('ファイル一覧取得後にセレクタが表示される', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ files: ['.env', '.env.local'] }),
    });

    render(<EnvVarImportSection {...createDefaultProps()} />);
    fireEvent.click(screen.getByText('.envからインポート'));

    await waitFor(() => {
      expect(screen.getByText('ファイルを選択...')).toBeInTheDocument();
    });
  });

  it('パースAPIにpathフィールドで送信する', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: ['.env'] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ variables: { KEY: 'value' }, errors: [] }),
      });

    render(<EnvVarImportSection {...createDefaultProps()} />);
    fireEvent.click(screen.getByText('.envからインポート'));

    await waitFor(() => {
      expect(screen.getByText('ファイルを選択...')).toBeInTheDocument();
    });

    // ファイルを選択
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '.env' } });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/projects/test-project-id/env-files/parse',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ path: '.env' }),
        }),
      );
    });
  });

  it('インポートボタンクリックでonImportが呼ばれる', async () => {
    const onImport = vi.fn();
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: ['.env'] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ variables: { KEY: 'value' }, errors: [] }),
      });

    render(<EnvVarImportSection {...createDefaultProps({ onImport })} />);
    fireEvent.click(screen.getByText('.envからインポート'));

    await waitFor(() => {
      expect(screen.getByText('ファイルを選択...')).toBeInTheDocument();
    });

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '.env' } });

    await waitFor(() => {
      expect(screen.getByText('インポート')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('インポート'));
    expect(onImport).toHaveBeenCalledWith({ KEY: 'value' });
  });
});
