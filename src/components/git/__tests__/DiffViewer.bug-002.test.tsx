/**
 * BUG-002: Diffタブで「差分を読み込み中...」と表示されたまま止まる問題の再現テスト
 *
 * 問題:
 * - セッション詳細画面のDiffタブで「差分を読み込み中...」と表示されたまま止まる
 * - サーバー側は正常にデータを取得している（ログ確認済み）
 * - フロントエンド側でdiffデータが正しく設定されていない可能性
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { DiffViewer } from '../DiffViewer';
import { useAppStore } from '@/store';

// Zustandストアをモック
vi.mock('@/store', () => ({
  useAppStore: vi.fn() as ReturnType<typeof vi.fn>,
}));

// react-diff-viewer-continuedをモック
vi.mock('react-diff-viewer-continued', () => ({
  default: vi.fn(() => <div data-testid="react-diff-viewer">Diff Content</div>),
}));

// テスト用のモック状態を型安全に作成するヘルパー
type MockAppStoreState = Pick<
  ReturnType<typeof useAppStore>,
  'diff' | 'selectedFile' | 'isDiffLoading' | 'diffError'
>;

const createMockStore = (overrides: Partial<MockAppStoreState> = {}): MockAppStoreState => ({
  diff: null,
  selectedFile: null,
  isDiffLoading: false,
  diffError: null,
  ...overrides,
});

describe('BUG-002: DiffViewer - 差分読み込み表示の問題', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ローディング中の場合、「差分を読み込み中...」と表示される', () => {
    // Setup: ローディング中の状態
    vi.mocked(useAppStore).mockReturnValue(
      createMockStore({ isDiffLoading: true }) as ReturnType<typeof useAppStore>
    );

    // Execute
    render(<DiffViewer />);

    // Verify: ローディング中は読み込みメッセージ
    expect(screen.getByText('差分を読み込み中...')).toBeInTheDocument();
  });

  it('エラー時にはエラーメッセージを表示する（BUG-002修正）', () => {
    // Setup: エラー状態
    vi.mocked(useAppStore).mockReturnValue(
      createMockStore({ diffError: '差分の取得に失敗しました' }) as ReturnType<typeof useAppStore>
    );

    // Execute
    render(<DiffViewer />);

    // Verify: エラーメッセージが表示される
    expect(screen.getByText('差分の取得に失敗しました')).toBeInTheDocument();
    expect(screen.getByText(/ページを再読み込みするか/)).toBeInTheDocument();
  });

  it('diffが空の配列の場合、ファイル選択メッセージが表示される', () => {
    // Setup: diffは存在するがfilesが空
    vi.mocked(useAppStore).mockReturnValue(
      createMockStore({
        diff: {
          files: [],
          totalAdditions: 0,
          totalDeletions: 0,
        },
      }) as ReturnType<typeof useAppStore>
    );

    // Execute
    render(<DiffViewer />);

    // Verify: 「差分を読み込み中...」ではなく「ファイルを選択してください」と表示されるべき
    expect(screen.queryByText('差分を読み込み中...')).not.toBeInTheDocument();
    expect(screen.getByText('ファイルを選択してください')).toBeInTheDocument();
  });

  it('diffデータが正常に設定されており、ファイルが選択されている場合、diff表示される', async () => {
    // Setup: 正常なdiffデータ
    const mockDiff = {
      files: [
        {
          path: 'test.ts',
          status: 'modified' as const,
          additions: 5,
          deletions: 3,
          oldContent: 'old content',
          newContent: 'new content',
        },
      ],
      totalAdditions: 5,
      totalDeletions: 3,
    };

    vi.mocked(useAppStore).mockReturnValue(
      createMockStore({ diff: mockDiff, selectedFile: 'test.ts' }) as ReturnType<typeof useAppStore>
    );

    // Execute
    render(<DiffViewer />);

    // Verify: 「差分を読み込み中...」ではなくDiffビューアが表示される
    expect(screen.queryByText('差分を読み込み中...')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('react-diff-viewer')).toBeInTheDocument();
    });
  });

  it('diffがnullでローディングもエラーもない場合、初期状態メッセージを表示（修正後）', () => {
    /**
     * BUG-002修正後の動作:
     * - diffがnullでもローディング中でなく、エラーもない場合は初期状態
     * - 「Diffタブを選択すると差分を表示します」というメッセージを表示
     */

    // Setup: 初期状態（ローディングもエラーもない）
    vi.mocked(useAppStore).mockReturnValue(
      createMockStore() as ReturnType<typeof useAppStore>
    );

    // Execute
    render(<DiffViewer />);

    // Verify: 初期状態メッセージが表示される
    expect(screen.getByText('Diffタブを選択すると差分を表示します')).toBeInTheDocument();
    expect(screen.queryByText('差分を読み込み中...')).not.toBeInTheDocument();
  });

  it('認証エラーの場合、適切なエラーメッセージを表示', () => {
    // Setup: 認証エラー状態
    vi.mocked(useAppStore).mockReturnValue(
      createMockStore({ diffError: '認証エラーが発生しました' }) as ReturnType<typeof useAppStore>
    );

    // Execute
    render(<DiffViewer />);

    // Verify: 認証エラーメッセージが表示される
    expect(screen.getByText('認証エラーが発生しました')).toBeInTheDocument();
    expect(screen.queryByText('差分を読み込み中...')).not.toBeInTheDocument();
  });

  it('ネットワークエラーの場合、適切なエラーメッセージを表示', () => {
    // Setup: ネットワークエラー状態
    vi.mocked(useAppStore).mockReturnValue(
      createMockStore({ diffError: 'ネットワークエラーが発生しました' }) as ReturnType<typeof useAppStore>
    );

    // Execute
    render(<DiffViewer />);

    // Verify: ネットワークエラーメッセージが表示される
    expect(screen.getByText('ネットワークエラーが発生しました')).toBeInTheDocument();
    expect(screen.queryByText('差分を読み込み中...')).not.toBeInTheDocument();
  });
});
