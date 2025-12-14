import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ConflictDialog } from '../ConflictDialog';

describe('ConflictDialog', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('ダイアログが閉じている時は何も表示されない', () => {
    render(
      <ConflictDialog
        isOpen={false}
        conflictFiles={['file1.ts', 'file2.ts']}
        onClose={mockOnClose}
      />
    );

    expect(screen.queryByText('コンフリクトが発生しました')).not.toBeInTheDocument();
  });

  it('ダイアログが開いている時にタイトルとメッセージが表示される', () => {
    render(
      <ConflictDialog
        isOpen={true}
        conflictFiles={['file1.ts', 'file2.ts']}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('コンフリクトが発生しました')).toBeInTheDocument();
    expect(screen.getByText('以下のファイルでコンフリクトが発生しました。手動で解決してください。')).toBeInTheDocument();
  });

  it('コンフリクトファイル一覧が表示される', () => {
    render(
      <ConflictDialog
        isOpen={true}
        conflictFiles={['src/app/component.tsx', 'src/lib/utils.ts', 'README.md']}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('src/app/component.tsx')).toBeInTheDocument();
    expect(screen.getByText('src/lib/utils.ts')).toBeInTheDocument();
    expect(screen.getByText('README.md')).toBeInTheDocument();
  });

  it('コンフリクトファイルが空の場合、空のリストが表示される', () => {
    render(
      <ConflictDialog
        isOpen={true}
        conflictFiles={[]}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('コンフリクトが発生しました')).toBeInTheDocument();
    // ファイルリストは空なので、リスト要素が存在しないことを確認
    const list = screen.getByRole('list');
    expect(list.children.length).toBe(0);
  });

  it('「閉じる」ボタンクリックでonCloseが呼ばれる', () => {
    render(
      <ConflictDialog
        isOpen={true}
        conflictFiles={['file1.ts']}
        onClose={mockOnClose}
      />
    );

    const closeButton = screen.getByText('閉じる');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('複数のコンフリクトファイルがすべて表示される', () => {
    const files = [
      'file1.ts',
      'file2.ts',
      'file3.ts',
      'file4.ts',
      'file5.ts',
    ];

    render(
      <ConflictDialog
        isOpen={true}
        conflictFiles={files}
        onClose={mockOnClose}
      />
    );

    files.forEach(file => {
      expect(screen.getByText(file)).toBeInTheDocument();
    });
  });
});
