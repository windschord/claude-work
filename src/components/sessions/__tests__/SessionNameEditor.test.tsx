/**
 * SessionNameEditorのテスト
 * Task 43.14: クリックで編集可能なセッション名表示
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SessionNameEditor } from '../SessionNameEditor';

// fetchをモック
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('SessionNameEditor', () => {
  const mockOnSave = vi.fn();
  const defaultProps = {
    sessionId: 'session-123',
    initialName: 'Initial Session Name',
    onSave: mockOnSave,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it('初期表示でセッション名が表示される', () => {
    render(<SessionNameEditor {...defaultProps} />);

    expect(screen.getByText('Initial Session Name')).toBeInTheDocument();
  });

  it('クリックで編集モードになる', async () => {
    render(<SessionNameEditor {...defaultProps} />);

    const nameDisplay = screen.getByText('Initial Session Name');
    fireEvent.click(nameDisplay);

    // 入力フィールドが表示される
    const input = screen.getByRole('textbox');
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('Initial Session Name');
  });

  it('Enterキーで保存される', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ session: { id: 'session-123', name: 'New Name' } }),
    });

    render(<SessionNameEditor {...defaultProps} />);

    // 編集モードに入る
    const nameDisplay = screen.getByText('Initial Session Name');
    fireEvent.click(nameDisplay);

    // 名前を変更
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'New Name' } });

    // Enterキーで保存
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/sessions/session-123',
        expect.objectContaining({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'New Name' }),
        })
      );
    });
  });

  it('blurで保存される', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ session: { id: 'session-123', name: 'New Name' } }),
    });

    render(<SessionNameEditor {...defaultProps} />);

    // 編集モードに入る
    const nameDisplay = screen.getByText('Initial Session Name');
    fireEvent.click(nameDisplay);

    // 名前を変更
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'New Name' } });

    // blurで保存
    fireEvent.blur(input);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/sessions/session-123',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ name: 'New Name' }),
        })
      );
    });
  });

  it('変更がない場合はAPIが呼ばれない', async () => {
    render(<SessionNameEditor {...defaultProps} />);

    // 編集モードに入る
    const nameDisplay = screen.getByText('Initial Session Name');
    fireEvent.click(nameDisplay);

    // 名前を変更せずにblur
    const input = screen.getByRole('textbox');
    fireEvent.blur(input);

    // APIが呼ばれないことを確認
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('Escapeキーで編集がキャンセルされる', async () => {
    render(<SessionNameEditor {...defaultProps} />);

    // 編集モードに入る
    const nameDisplay = screen.getByText('Initial Session Name');
    fireEvent.click(nameDisplay);

    // 名前を変更
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'New Name' } });

    // Escapeでキャンセル
    fireEvent.keyDown(input, { key: 'Escape' });

    // 元の名前が表示される
    expect(screen.getByText('Initial Session Name')).toBeInTheDocument();
    // APIは呼ばれない
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('保存成功時にonSaveが呼ばれる', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ session: { id: 'session-123', name: 'New Name' } }),
    });

    render(<SessionNameEditor {...defaultProps} />);

    // 編集モードに入る
    fireEvent.click(screen.getByText('Initial Session Name'));

    // 名前を変更
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'New Name' } });

    // Enterキーで保存
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith('New Name');
    });
  });

  it('APIエラー時にonErrorが呼ばれる', async () => {
    const mockOnError = vi.fn();

    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Failed to update' }),
    });

    render(<SessionNameEditor {...defaultProps} onError={mockOnError} />);

    // 編集モードに入る
    fireEvent.click(screen.getByText('Initial Session Name'));

    // 名前を変更
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'New Name' } });

    // Enterキーで保存
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith('Failed to update');
    });
  });

  it('空の名前では保存されない', async () => {
    render(<SessionNameEditor {...defaultProps} />);

    // 編集モードに入る
    fireEvent.click(screen.getByText('Initial Session Name'));

    // 名前を空にする
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '' } });

    // Enterキーで保存を試みる
    fireEvent.keyDown(input, { key: 'Enter' });

    // APIは呼ばれない
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('編集中はローディング表示される', async () => {
    mockFetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: async () => ({ session: { id: 'session-123', name: 'New Name' } }),
            });
          }, 100);
        })
    );

    render(<SessionNameEditor {...defaultProps} />);

    // 編集モードに入る
    fireEvent.click(screen.getByText('Initial Session Name'));

    // 名前を変更
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'New Name' } });

    // Enterキーで保存
    fireEvent.keyDown(input, { key: 'Enter' });

    // ローディング中は入力が無効化される
    expect(input).toBeDisabled();

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
  });
});
