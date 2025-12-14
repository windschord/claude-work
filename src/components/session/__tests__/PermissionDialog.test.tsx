import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import PermissionDialog from '../PermissionDialog';

describe('PermissionDialog', () => {
  const mockPermission = {
    id: 'perm-1',
    type: 'file_write',
    description: 'Write to file: /path/to/file.ts',
    details: 'The assistant wants to create a new file.',
  };

  const mockOnApprove = vi.fn();
  const mockOnReject = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('権限確認ダイアログが表示される', () => {
    render(
      <PermissionDialog
        isOpen={true}
        permission={mockPermission}
        onApprove={mockOnApprove}
        onReject={mockOnReject}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText(/権限の確認/i)).toBeInTheDocument();
    expect(screen.getByText('Write to file: /path/to/file.ts')).toBeInTheDocument();
  });

  it('閉じている時はダイアログが表示されない', () => {
    render(
      <PermissionDialog
        isOpen={false}
        permission={mockPermission}
        onApprove={mockOnApprove}
        onReject={mockOnReject}
        onClose={mockOnClose}
      />
    );

    expect(screen.queryByText(/権限の確認/i)).not.toBeInTheDocument();
  });

  it('承認ボタンをクリックするとonApproveが呼ばれる', () => {
    render(
      <PermissionDialog
        isOpen={true}
        permission={mockPermission}
        onApprove={mockOnApprove}
        onReject={mockOnReject}
        onClose={mockOnClose}
      />
    );

    const approveButton = screen.getByRole('button', { name: /承認/i });
    fireEvent.click(approveButton);

    expect(mockOnApprove).toHaveBeenCalledWith('perm-1');
    expect(mockOnReject).not.toHaveBeenCalled();
  });

  it('拒否ボタンをクリックするとonRejectが呼ばれる', () => {
    render(
      <PermissionDialog
        isOpen={true}
        permission={mockPermission}
        onApprove={mockOnApprove}
        onReject={mockOnReject}
        onClose={mockOnClose}
      />
    );

    const rejectButton = screen.getByRole('button', { name: /拒否/i });
    fireEvent.click(rejectButton);

    expect(mockOnReject).toHaveBeenCalledWith('perm-1');
    expect(mockOnApprove).not.toHaveBeenCalled();
  });

  it('権限の詳細が表示される', () => {
    render(
      <PermissionDialog
        isOpen={true}
        permission={mockPermission}
        onApprove={mockOnApprove}
        onReject={mockOnReject}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('The assistant wants to create a new file.')).toBeInTheDocument();
  });

  it('permissionがnullの場合は何も表示されない', () => {
    render(
      <PermissionDialog
        isOpen={true}
        permission={null}
        onApprove={mockOnApprove}
        onReject={mockOnReject}
        onClose={mockOnClose}
      />
    );

    expect(screen.queryByText(/権限の確認/i)).not.toBeInTheDocument();
  });

  it('承認ボタンと拒否ボタンが両方表示される', () => {
    render(
      <PermissionDialog
        isOpen={true}
        permission={mockPermission}
        onApprove={mockOnApprove}
        onReject={mockOnReject}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByRole('button', { name: /承認/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /拒否/i })).toBeInTheDocument();
  });
});
