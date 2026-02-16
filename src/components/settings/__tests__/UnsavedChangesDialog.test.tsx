import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnsavedChangesDialog } from '../UnsavedChangesDialog';

describe('UnsavedChangesDialog', () => {
  const mockOnDiscard = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    mockOnDiscard.mockClear();
    mockOnCancel.mockClear();
  });

  it('isOpenがfalseの場合、何も表示されない', () => {
    const { container } = render(
      <UnsavedChangesDialog
        isOpen={false}
        onDiscard={mockOnDiscard}
        onCancel={mockOnCancel}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('isOpenがtrueの場合、ダイアログが表示される', () => {
    render(
      <UnsavedChangesDialog
        isOpen={true}
        onDiscard={mockOnDiscard}
        onCancel={mockOnCancel}
      />
    );
    expect(screen.getByText('未保存の変更があります')).toBeInTheDocument();
    expect(screen.getByText('変更が保存されていません。破棄しますか？')).toBeInTheDocument();
  });

  it('キャンセルボタンが表示される', () => {
    render(
      <UnsavedChangesDialog
        isOpen={true}
        onDiscard={mockOnDiscard}
        onCancel={mockOnCancel}
      />
    );
    expect(screen.getByText('キャンセル')).toBeInTheDocument();
  });

  it('破棄して戻るボタンが表示される', () => {
    render(
      <UnsavedChangesDialog
        isOpen={true}
        onDiscard={mockOnDiscard}
        onCancel={mockOnCancel}
      />
    );
    expect(screen.getByText('破棄して戻る')).toBeInTheDocument();
  });

  it('キャンセルボタンをクリックするとonCancelが呼ばれる', () => {
    render(
      <UnsavedChangesDialog
        isOpen={true}
        onDiscard={mockOnDiscard}
        onCancel={mockOnCancel}
      />
    );
    const cancelButton = screen.getByText('キャンセル');
    fireEvent.click(cancelButton);
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
    expect(mockOnDiscard).not.toHaveBeenCalled();
  });

  it('破棄して戻るボタンをクリックするとonDiscardが呼ばれる', () => {
    render(
      <UnsavedChangesDialog
        isOpen={true}
        onDiscard={mockOnDiscard}
        onCancel={mockOnCancel}
      />
    );
    const discardButton = screen.getByText('破棄して戻る');
    fireEvent.click(discardButton);
    expect(mockOnDiscard).toHaveBeenCalledTimes(1);
    expect(mockOnCancel).not.toHaveBeenCalled();
  });

  it('ESCキーでonCancelが呼ばれる', () => {
    render(
      <UnsavedChangesDialog
        isOpen={true}
        onDiscard={mockOnDiscard}
        onCancel={mockOnCancel}
      />
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('EnterキーでonDiscardが呼ばれる', () => {
    render(
      <UnsavedChangesDialog
        isOpen={true}
        onDiscard={mockOnDiscard}
        onCancel={mockOnCancel}
      />
    );
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(mockOnDiscard).toHaveBeenCalledTimes(1);
  });

  it('破棄ボタンが赤色（bg-red-600）である', () => {
    render(
      <UnsavedChangesDialog
        isOpen={true}
        onDiscard={mockOnDiscard}
        onCancel={mockOnCancel}
      />
    );
    const discardButton = screen.getByText('破棄して戻る');
    expect(discardButton).toHaveClass('bg-red-600');
  });
});
