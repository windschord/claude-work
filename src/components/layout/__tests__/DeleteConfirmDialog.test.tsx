/**
 * DeleteConfirmDialogコンポーネントのテスト
 * Task 48.5: 汎用削除確認ダイアログ
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DeleteConfirmDialog } from '../DeleteConfirmDialog';

describe('DeleteConfirmDialog', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    title: '削除の確認',
    message: '本当に削除しますか？',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('isOpen=falseの場合、ダイアログが表示されない', () => {
    render(<DeleteConfirmDialog {...defaultProps} isOpen={false} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('isOpen=trueの場合、ダイアログが表示される', () => {
    render(<DeleteConfirmDialog {...defaultProps} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('タイトルが表示される', () => {
    render(<DeleteConfirmDialog {...defaultProps} />);

    expect(screen.getByText('削除の確認')).toBeInTheDocument();
  });

  it('メッセージが表示される', () => {
    render(<DeleteConfirmDialog {...defaultProps} />);

    expect(screen.getByText('本当に削除しますか？')).toBeInTheDocument();
  });

  it('削除ボタンが表示される', () => {
    render(<DeleteConfirmDialog {...defaultProps} />);

    expect(screen.getByRole('button', { name: '削除' })).toBeInTheDocument();
  });

  it('キャンセルボタンが表示される', () => {
    render(<DeleteConfirmDialog {...defaultProps} />);

    expect(screen.getByRole('button', { name: 'キャンセル' })).toBeInTheDocument();
  });

  it('削除ボタンクリックでonConfirmが呼ばれる', async () => {
    const onConfirm = vi.fn();
    render(<DeleteConfirmDialog {...defaultProps} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole('button', { name: '削除' }));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
  });

  it('キャンセルボタンクリックでonCloseが呼ばれる', () => {
    const onClose = vi.fn();
    render(<DeleteConfirmDialog {...defaultProps} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('isLoading=trueの場合、削除ボタンがdisabledになる', () => {
    render(<DeleteConfirmDialog {...defaultProps} isLoading={true} />);

    expect(screen.getByRole('button', { name: /削除中/ })).toBeDisabled();
  });

  it('isLoading=trueの場合、キャンセルボタンがdisabledになる', () => {
    render(<DeleteConfirmDialog {...defaultProps} isLoading={true} />);

    expect(screen.getByRole('button', { name: 'キャンセル' })).toBeDisabled();
  });

  it('カスタム削除ボタンテキストが表示される', () => {
    render(<DeleteConfirmDialog {...defaultProps} confirmText="完全に削除" />);

    expect(screen.getByRole('button', { name: '完全に削除' })).toBeInTheDocument();
  });

  it('削除ボタンは赤色のスタイルを持つ', () => {
    render(<DeleteConfirmDialog {...defaultProps} />);

    const deleteButton = screen.getByRole('button', { name: '削除' });
    expect(deleteButton).toHaveClass('bg-red-600');
  });
});
