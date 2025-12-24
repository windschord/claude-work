import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { FileList } from '../FileList';
import { useAppStore } from '@/store';

vi.mock('@/store', () => ({
  useAppStore: vi.fn(),
}));

describe('FileList', () => {
  const mockSelectFile = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('ファイルリストが空の場合、メッセージを表示する', () => {
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      diff: { files: [], totalAdditions: 0, totalDeletions: 0 },
      selectedFile: null,
      selectFile: mockSelectFile,
    });

    render(<FileList />);
    expect(screen.getByText('変更されたファイルはありません')).toBeInTheDocument();
  });

  it('追加されたファイルに+アイコンと緑色を表示する', () => {
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      diff: {
        files: [
          {
            path: 'new-file.ts',
            status: 'added',
            additions: 10,
            deletions: 0,
            oldContent: '',
            newContent: 'export const test = true;',
          },
        ],
        totalAdditions: 10,
        totalDeletions: 0,
      },
      selectedFile: null,
      selectFile: mockSelectFile,
    });

    render(<FileList />);
    const fileItem = screen.getByText('new-file.ts').closest('button');
    expect(fileItem).toBeInTheDocument();
    expect(screen.getByText('+')).toBeInTheDocument();
    expect(fileItem).toHaveClass('text-green-600');
  });

  it('変更されたファイルに~アイコンと黄色を表示する', () => {
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      diff: {
        files: [
          {
            path: 'modified-file.ts',
            status: 'modified',
            additions: 5,
            deletions: 3,
            oldContent: 'const old = true;',
            newContent: 'const new = true;',
          },
        ],
        totalAdditions: 5,
        totalDeletions: 3,
      },
      selectedFile: null,
      selectFile: mockSelectFile,
    });

    render(<FileList />);
    const fileItem = screen.getByText('modified-file.ts').closest('button');
    expect(fileItem).toBeInTheDocument();
    expect(screen.getByText('~')).toBeInTheDocument();
    expect(fileItem).toHaveClass('text-yellow-600');
  });

  it('削除されたファイルに-アイコンと赤色を表示する', () => {
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      diff: {
        files: [
          {
            path: 'deleted-file.ts',
            status: 'deleted',
            additions: 0,
            deletions: 10,
            oldContent: 'const deleted = true;',
            newContent: '',
          },
        ],
        totalAdditions: 0,
        totalDeletions: 10,
      },
      selectedFile: null,
      selectFile: mockSelectFile,
    });

    render(<FileList />);
    const fileItem = screen.getByText('deleted-file.ts').closest('button');
    expect(fileItem).toBeInTheDocument();
    expect(screen.getByText('-')).toBeInTheDocument();
    expect(fileItem).toHaveClass('text-red-600');
  });

  it('ファイルをクリックするとselectFileが呼ばれる', () => {
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      diff: {
        files: [
          {
            path: 'test-file.ts',
            status: 'added',
            additions: 5,
            deletions: 0,
            oldContent: '',
            newContent: 'test content',
          },
        ],
        totalAdditions: 5,
        totalDeletions: 0,
      },
      selectedFile: null,
      selectFile: mockSelectFile,
    });

    render(<FileList />);
    const fileItem = screen.getByText('test-file.ts');
    fireEvent.click(fileItem);
    expect(mockSelectFile).toHaveBeenCalledWith('test-file.ts');
  });

  it('選択中のファイルに背景色を適用する', () => {
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      diff: {
        files: [
          {
            path: 'selected-file.ts',
            status: 'modified',
            additions: 3,
            deletions: 2,
            oldContent: 'old',
            newContent: 'new',
          },
        ],
        totalAdditions: 3,
        totalDeletions: 2,
      },
      selectedFile: 'selected-file.ts',
      selectFile: mockSelectFile,
    });

    render(<FileList />);
    const fileItem = screen.getByText('selected-file.ts').closest('button');
    expect(fileItem).toHaveClass('bg-blue-100');
  });

  it('複数のファイルを表示する', () => {
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      diff: {
        files: [
          {
            path: 'file1.ts',
            status: 'added',
            additions: 5,
            deletions: 0,
            oldContent: '',
            newContent: 'content1',
          },
          {
            path: 'file2.ts',
            status: 'modified',
            additions: 3,
            deletions: 2,
            oldContent: 'old2',
            newContent: 'new2',
          },
          {
            path: 'file3.ts',
            status: 'deleted',
            additions: 0,
            deletions: 10,
            oldContent: 'old3',
            newContent: '',
          },
        ],
        totalAdditions: 8,
        totalDeletions: 12,
      },
      selectedFile: null,
      selectFile: mockSelectFile,
    });

    render(<FileList />);
    expect(screen.getByText('file1.ts')).toBeInTheDocument();
    expect(screen.getByText('file2.ts')).toBeInTheDocument();
    expect(screen.getByText('file3.ts')).toBeInTheDocument();
  });

  it('diffがnullの場合、読み込み中メッセージを表示する', () => {
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      diff: null,
      selectedFile: null,
      selectFile: mockSelectFile,
    });

    render(<FileList />);
    expect(screen.getByText('差分を読み込み中...')).toBeInTheDocument();
  });
});
