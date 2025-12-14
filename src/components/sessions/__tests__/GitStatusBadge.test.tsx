import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { GitStatusBadge } from '../GitStatusBadge';

describe('GitStatusBadge', () => {
  afterEach(() => {
    cleanup();
  });

  describe('クリーン状態', () => {
    it('クリーンバッジが表示される', () => {
      render(<GitStatusBadge status="clean" />);

      const badge = screen.getByTestId('git-status-badge-clean');
      expect(badge).toBeInTheDocument();
    });

    it('緑色のバッジが表示される', () => {
      render(<GitStatusBadge status="clean" />);

      const badge = screen.getByTestId('git-status-badge-clean');
      expect(badge).toHaveClass('bg-green-100', 'text-green-800');
    });

    it('チェックアイコンが表示される', () => {
      render(<GitStatusBadge status="clean" />);

      const icon = screen.getByTestId('git-status-icon-clean');
      expect(icon).toBeInTheDocument();
    });

    it('"クリーン"というテキストが表示される', () => {
      render(<GitStatusBadge status="clean" />);

      const text = screen.getByText('クリーン');
      expect(text).toBeInTheDocument();
    });

    it('バッジが角丸で小さいテキストサイズである', () => {
      render(<GitStatusBadge status="clean" />);

      const badge = screen.getByTestId('git-status-badge-clean');
      expect(badge).toHaveClass('rounded-full', 'px-2', 'py-1', 'text-xs');
    });
  });

  describe('ダーティ状態', () => {
    it('ダーティバッジが表示される', () => {
      render(<GitStatusBadge status="dirty" />);

      const badge = screen.getByTestId('git-status-badge-dirty');
      expect(badge).toBeInTheDocument();
    });

    it('黄色のバッジが表示される', () => {
      render(<GitStatusBadge status="dirty" />);

      const badge = screen.getByTestId('git-status-badge-dirty');
      expect(badge).toHaveClass('bg-yellow-100', 'text-yellow-800');
    });

    it('警告アイコンが表示される', () => {
      render(<GitStatusBadge status="dirty" />);

      const icon = screen.getByTestId('git-status-icon-dirty');
      expect(icon).toBeInTheDocument();
    });

    it('"未コミット変更あり"というテキストが表示される', () => {
      render(<GitStatusBadge status="dirty" />);

      const text = screen.getByText('未コミット変更あり');
      expect(text).toBeInTheDocument();
    });

    it('バッジが角丸で小さいテキストサイズである', () => {
      render(<GitStatusBadge status="dirty" />);

      const badge = screen.getByTestId('git-status-badge-dirty');
      expect(badge).toHaveClass('rounded-full', 'px-2', 'py-1', 'text-xs');
    });
  });

  describe('アイコンとテキストのレイアウト', () => {
    it('クリーンバッジでアイコンとテキストが横並びで表示される', () => {
      render(<GitStatusBadge status="clean" />);

      const badge = screen.getByTestId('git-status-badge-clean');
      expect(badge).toHaveClass('flex', 'items-center', 'gap-1');
    });

    it('ダーティバッジでアイコンとテキストが横並びで表示される', () => {
      render(<GitStatusBadge status="dirty" />);

      const badge = screen.getByTestId('git-status-badge-dirty');
      expect(badge).toHaveClass('flex', 'items-center', 'gap-1');
    });
  });

  describe('全ステータスの表示', () => {
    it('cleanとdirtyの両方のステータスでバッジが表示される', () => {
      const statuses: Array<'clean' | 'dirty'> = ['clean', 'dirty'];

      statuses.forEach((status) => {
        const { unmount } = render(<GitStatusBadge status={status} />);
        const badge = screen.getByTestId(`git-status-badge-${status}`);
        expect(badge).toBeInTheDocument();
        unmount();
      });
    });

    it('各ステータスに適切な色が設定される', () => {
      const statusColorMap = [
        { status: 'clean' as const, bgColor: 'bg-green-100', textColor: 'text-green-800' },
        { status: 'dirty' as const, bgColor: 'bg-yellow-100', textColor: 'text-yellow-800' },
      ];

      statusColorMap.forEach(({ status, bgColor, textColor }) => {
        const { unmount } = render(<GitStatusBadge status={status} />);
        const badge = screen.getByTestId(`git-status-badge-${status}`);
        expect(badge).toHaveClass(bgColor, textColor);
        unmount();
      });
    });
  });
});
