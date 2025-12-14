import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DiffViewer } from '../DiffViewer';
import { useAppStore } from '@/store';

vi.mock('@/store', () => ({
  useAppStore: vi.fn(),
}));

vi.mock('react-diff-viewer-continued', () => ({
  default: ({ oldValue, newValue }: { oldValue: string; newValue: string }) => (
    <div data-testid="diff-viewer">
      <div data-testid="old-content">{oldValue}</div>
      <div data-testid="new-content">{newValue}</div>
    </div>
  ),
}));

describe('DiffViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ファイルが選択されていない場合、メッセージを表示する', () => {
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      diff: {
        files: [
          {
            path: 'test.ts',
            status: 'modified',
            additions: 1,
            deletions: 1,
            oldContent: 'old',
            newContent: 'new',
          },
        ],
        totalAdditions: 1,
        totalDeletions: 1,
      },
      selectedFile: null,
    });

    render(<DiffViewer />);
    expect(screen.getByText('ファイルを選択してください')).toBeInTheDocument();
  });

  it('選択されたファイルのdiffを表示する', () => {
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      diff: {
        files: [
          {
            path: 'selected.ts',
            status: 'modified',
            additions: 2,
            deletions: 1,
            oldContent: 'const old = true;',
            newContent: 'const new = true;\nconst added = true;',
          },
        ],
        totalAdditions: 2,
        totalDeletions: 1,
      },
      selectedFile: 'selected.ts',
    });

    render(<DiffViewer />);
    expect(screen.getByTestId('diff-viewer')).toBeInTheDocument();
    expect(screen.getByTestId('old-content')).toHaveTextContent('const old = true;');
    expect(screen.getByTestId('new-content')).toHaveTextContent('const new = true;');
  });

  it('追加されたファイルのdiffを表示する（oldContentが空）', () => {
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      diff: {
        files: [
          {
            path: 'new-file.ts',
            status: 'added',
            additions: 5,
            deletions: 0,
            oldContent: '',
            newContent: 'export const newFeature = true;',
          },
        ],
        totalAdditions: 5,
        totalDeletions: 0,
      },
      selectedFile: 'new-file.ts',
    });

    render(<DiffViewer />);
    expect(screen.getByTestId('diff-viewer')).toBeInTheDocument();
    expect(screen.getByTestId('old-content')).toHaveTextContent('');
    expect(screen.getByTestId('new-content')).toHaveTextContent('export const newFeature = true;');
  });

  it('削除されたファイルのdiffを表示する（newContentが空）', () => {
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      diff: {
        files: [
          {
            path: 'deleted-file.ts',
            status: 'deleted',
            additions: 0,
            deletions: 3,
            oldContent: 'export const obsolete = true;',
            newContent: '',
          },
        ],
        totalAdditions: 0,
        totalDeletions: 3,
      },
      selectedFile: 'deleted-file.ts',
    });

    render(<DiffViewer />);
    expect(screen.getByTestId('diff-viewer')).toBeInTheDocument();
    expect(screen.getByTestId('old-content')).toHaveTextContent('export const obsolete = true;');
    expect(screen.getByTestId('new-content')).toHaveTextContent('');
  });

  it('diffがnullの場合、読み込み中メッセージを表示する', () => {
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      diff: null,
      selectedFile: null,
    });

    render(<DiffViewer />);
    expect(screen.getByText('差分を読み込み中...')).toBeInTheDocument();
  });

  it('選択されたファイルがdiffに存在しない場合、エラーメッセージを表示する', () => {
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      diff: {
        files: [
          {
            path: 'existing.ts',
            status: 'modified',
            additions: 1,
            deletions: 1,
            oldContent: 'old',
            newContent: 'new',
          },
        ],
        totalAdditions: 1,
        totalDeletions: 1,
      },
      selectedFile: 'non-existent.ts',
    });

    render(<DiffViewer />);
    expect(screen.getByText('選択されたファイルの差分が見つかりません')).toBeInTheDocument();
  });

  it('ファイル名とステータス情報を表示する', () => {
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      diff: {
        files: [
          {
            path: 'modified.ts',
            status: 'modified',
            additions: 5,
            deletions: 3,
            oldContent: 'old content',
            newContent: 'new content',
          },
        ],
        totalAdditions: 5,
        totalDeletions: 3,
      },
      selectedFile: 'modified.ts',
    });

    render(<DiffViewer />);
    expect(screen.getByText('modified.ts')).toBeInTheDocument();
    expect(screen.getByText('+5')).toBeInTheDocument();
    expect(screen.getByText('-3')).toBeInTheDocument();
  });
});
