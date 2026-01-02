import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DeleteSessionDialog } from '../DeleteSessionDialog';

describe('DeleteSessionDialog', () => {
  const defaultProps = {
    isOpen: true,
    sessionName: 'test-session',
    worktreePath: '/path/to/.worktrees/test-session',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    isDeleting: false,
  };

  it('ダイアログが正しく表示される', () => {
    render(<DeleteSessionDialog {...defaultProps} />);

    expect(screen.getByText('セッションを削除')).toBeInTheDocument();
    expect(screen.getByText(/以下のセッションを削除しますか/)).toBeInTheDocument();
  });

  it('セッション名がダイアログに表示される', () => {
    render(
      <DeleteSessionDialog {...defaultProps} sessionName="my-custom-session" />
    );

    expect(screen.getByText('my-custom-session')).toBeInTheDocument();
  });

  it('worktreeパスがダイアログに表示される', () => {
    render(<DeleteSessionDialog {...defaultProps} />);

    expect(screen.getByText('/path/to/.worktrees/test-session')).toBeInTheDocument();
  });

  it('キャンセルボタンでonCancelが呼ばれる', () => {
    const onCancel = vi.fn();
    render(<DeleteSessionDialog {...defaultProps} onCancel={onCancel} />);

    fireEvent.click(screen.getByText('キャンセル'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('削除ボタンでonConfirmが呼ばれる', () => {
    const onConfirm = vi.fn();
    render(<DeleteSessionDialog {...defaultProps} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByText('削除'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('isDeleting時に削除ボタンが無効化される', () => {
    render(<DeleteSessionDialog {...defaultProps} isDeleting={true} />);

    const deleteButton = screen.getByText('削除中...');
    expect(deleteButton).toBeDisabled();
  });

  it('isDeleting時にキャンセルボタンも無効化される', () => {
    render(<DeleteSessionDialog {...defaultProps} isDeleting={true} />);

    const cancelButton = screen.getByText('キャンセル');
    expect(cancelButton).toBeDisabled();
  });

  it('isOpen=falseの場合はダイアログが表示されない', () => {
    render(<DeleteSessionDialog {...defaultProps} isOpen={false} />);

    expect(screen.queryByText('セッションを削除')).not.toBeInTheDocument();
  });
});
