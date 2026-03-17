import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RegistryFirewallStatus } from '../RegistryFirewallStatus';

// useRegistryFirewall をモック
const mockToggleEnabled = vi.fn();
const mockRefetch = vi.fn();

const defaultMockHook = {
  health: { status: 'healthy' as const, registries: ['npm', 'PyPI', 'Go', 'Cargo', 'Docker'] },
  blocks: [],
  enabled: true,
  isLoading: false,
  error: null,
  toggleEnabled: mockToggleEnabled,
  refetch: mockRefetch,
};

vi.mock('@/hooks/useRegistryFirewall', () => ({
  useRegistryFirewall: vi.fn(() => defaultMockHook),
}));

import { useRegistryFirewall } from '@/hooks/useRegistryFirewall';

const mockUseRegistryFirewall = vi.mocked(useRegistryFirewall);

describe('RegistryFirewallStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRegistryFirewall.mockReturnValue({ ...defaultMockHook });
  });

  describe('ローディング状態', () => {
    it('ロード中はローディングインジケータを表示する', () => {
      mockUseRegistryFirewall.mockReturnValue({
        ...defaultMockHook,
        isLoading: true,
      });

      render(<RegistryFirewallStatus />);

      expect(screen.getByText('読み込み中...')).toBeInTheDocument();
    });

    it('ロード中はメインコンテンツが表示されない', () => {
      mockUseRegistryFirewall.mockReturnValue({
        ...defaultMockHook,
        isLoading: true,
      });

      render(<RegistryFirewallStatus />);

      expect(screen.queryByText('Registry Firewall')).not.toBeInTheDocument();
    });
  });

  describe('エラー表示', () => {
    it('エラー時にエラーメッセージを表示する', () => {
      mockUseRegistryFirewall.mockReturnValue({
        ...defaultMockHook,
        error: 'データの取得に失敗しました',
        isLoading: false,
      });

      render(<RegistryFirewallStatus />);

      expect(screen.getByText('データの取得に失敗しました')).toBeInTheDocument();
    });

    it('トグルエラー時にエラーメッセージを表示する', async () => {
      mockToggleEnabled.mockRejectedValue(new Error('設定の更新に失敗しました'));

      render(<RegistryFirewallStatus />);

      const toggle = screen.getByRole('switch');
      await act(async () => {
        fireEvent.click(toggle);
      });

      await waitFor(() => {
        expect(screen.getByText('設定の更新に失敗しました')).toBeInTheDocument();
      });
    });
  });

  describe('ステータス表示', () => {
    it('正常ステータスが表示される', () => {
      render(<RegistryFirewallStatus />);

      expect(screen.getByText('正常')).toBeInTheDocument();
    });

    it('異常ステータスが表示される', () => {
      mockUseRegistryFirewall.mockReturnValue({
        ...defaultMockHook,
        health: { status: 'unhealthy', registries: ['npm', 'PyPI', 'Go', 'Cargo', 'Docker'] },
      });

      render(<RegistryFirewallStatus />);

      expect(screen.getByText('異常')).toBeInTheDocument();
    });

    it('停止中ステータスが表示される', () => {
      mockUseRegistryFirewall.mockReturnValue({
        ...defaultMockHook,
        health: { status: 'stopped', registries: ['npm', 'PyPI', 'Go', 'Cargo', 'Docker'] },
      });

      render(<RegistryFirewallStatus />);

      expect(screen.getByText('停止中')).toBeInTheDocument();
    });
  });

  describe('トグル操作', () => {
    it('有効時にトグルがオン状態である', () => {
      render(<RegistryFirewallStatus />);

      const toggle = screen.getByRole('switch');
      expect(toggle).toHaveAttribute('aria-checked', 'true');
      expect(screen.getByText('有効')).toBeInTheDocument();
    });

    it('無効時にトグルがオフ状態である', () => {
      mockUseRegistryFirewall.mockReturnValue({
        ...defaultMockHook,
        enabled: false,
      });

      render(<RegistryFirewallStatus />);

      const toggle = screen.getByRole('switch');
      expect(toggle).toHaveAttribute('aria-checked', 'false');
      expect(screen.getByText('無効')).toBeInTheDocument();
    });

    it('トグルクリックでtoggleEnabledが呼ばれる', async () => {
      mockToggleEnabled.mockResolvedValue(undefined);

      render(<RegistryFirewallStatus />);

      const toggle = screen.getByRole('switch');
      await act(async () => {
        fireEvent.click(toggle);
      });

      expect(mockToggleEnabled).toHaveBeenCalledWith(false);
    });
  });

  describe('対応レジストリ一覧', () => {
    it('5つのレジストリが表示される', () => {
      render(<RegistryFirewallStatus />);

      expect(screen.getByText('npm')).toBeInTheDocument();
      expect(screen.getByText('PyPI')).toBeInTheDocument();
      expect(screen.getByText('Go')).toBeInTheDocument();
      expect(screen.getByText('Cargo')).toBeInTheDocument();
      expect(screen.getByText('Docker')).toBeInTheDocument();
    });
  });

  describe('管理画面リンク', () => {
    it('管理画面リンクが表示される', () => {
      render(<RegistryFirewallStatus />);

      const link = screen.getByText('管理画面を開く');
      expect(link).toBeInTheDocument();
      expect(link.closest('a')).toHaveAttribute('href', '/api/registry-firewall/ui/');
      expect(link.closest('a')).toHaveAttribute('target', '_blank');
    });
  });

  describe('ブロックログ', () => {
    it('ブロックログが0件の場合にメッセージを表示する', () => {
      render(<RegistryFirewallStatus />);

      expect(screen.getByText('ブロックログはありません')).toBeInTheDocument();
    });

    it('ブロックログが表示される', () => {
      mockUseRegistryFirewall.mockReturnValue({
        ...defaultMockHook,
        blocks: [
          {
            timestamp: '2024-06-15T10:30:00Z',
            package_name: 'malicious-pkg',
            registry: 'npm',
            reason: 'Known malware',
          },
        ],
      });

      render(<RegistryFirewallStatus />);

      expect(screen.getByText('malicious-pkg')).toBeInTheDocument();
      // 'npm'はレジストリバッジとテーブルセルの両方に存在するため、getAllByTextを使用
      expect(screen.getAllByText('npm').length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText('Known malware')).toBeInTheDocument();
    });

    it('「全てのログを見る」リンクが表示される', () => {
      mockUseRegistryFirewall.mockReturnValue({
        ...defaultMockHook,
        blocks: [
          {
            timestamp: '2024-06-15T10:30:00Z',
            package_name: 'malicious-pkg',
            registry: 'npm',
            reason: 'Known malware',
          },
        ],
      });

      render(<RegistryFirewallStatus />);

      const link = screen.getByText('全てのログを見る');
      expect(link).toBeInTheDocument();
      expect(link.closest('a')).toHaveAttribute('href', '/api/registry-firewall/ui/');
    });
  });

  describe('セクションヘッダー', () => {
    it('パッケージセキュリティヘッダーが表示される', () => {
      render(<RegistryFirewallStatus />);

      expect(screen.getByText('パッケージセキュリティ')).toBeInTheDocument();
    });
  });
});
