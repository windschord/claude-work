import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NetworkFilterSection } from '../NetworkFilterSection';

// useNetworkFilter をモック
const mockCreateRule = vi.fn();
const mockUpdateRule = vi.fn();
const mockDeleteRule = vi.fn();
const mockToggleRule = vi.fn();
const mockToggleFilter = vi.fn();

const defaultMockHook = {
  rules: [],
  filterConfig: { id: 'cfg-1', environment_id: 'env-001', enabled: false, created_at: new Date(), updated_at: new Date() },
  isLoading: false,
  error: null,
  createRule: mockCreateRule,
  updateRule: mockUpdateRule,
  deleteRule: mockDeleteRule,
  toggleRule: mockToggleRule,
  toggleFilter: mockToggleFilter,
  getTemplates: vi.fn(),
  applyTemplates: vi.fn(),
  testConnection: vi.fn(),
};

vi.mock('@/hooks/useNetworkFilter', () => ({
  useNetworkFilter: vi.fn(() => defaultMockHook),
}));

import { useNetworkFilter } from '@/hooks/useNetworkFilter';

const mockUseNetworkFilter = vi.mocked(useNetworkFilter);

const sampleRule = {
  id: 'rule-001',
  environment_id: 'env-001',
  target: 'api.anthropic.com',
  port: 443,
  description: 'Claude API',
  enabled: true,
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-01-01'),
};

describe('NetworkFilterSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseNetworkFilter.mockReturnValue({ ...defaultMockHook });
  });

  describe('表示条件', () => {
    it('Docker環境の場合にフィルタリングセクションが表示される', () => {
      render(
        <NetworkFilterSection environmentId="env-001" environmentType="DOCKER" />
      );

      expect(screen.getByText('ネットワークフィルタリング')).toBeInTheDocument();
    });

    it('HOST環境の場合にフィルタリングセクションが非表示', () => {
      render(
        <NetworkFilterSection environmentId="env-001" environmentType="HOST" />
      );

      expect(screen.queryByText('ネットワークフィルタリング')).not.toBeInTheDocument();
    });

    it('SSH環境の場合にフィルタリングセクションが非表示', () => {
      render(
        <NetworkFilterSection environmentId="env-001" environmentType="SSH" />
      );

      expect(screen.queryByText('ネットワークフィルタリング')).not.toBeInTheDocument();
    });
  });

  describe('ルール一覧表示', () => {
    it('ルール一覧が正しく表示される', () => {
      mockUseNetworkFilter.mockReturnValue({
        ...defaultMockHook,
        rules: [sampleRule],
      });

      render(
        <NetworkFilterSection environmentId="env-001" environmentType="DOCKER" />
      );

      expect(screen.getByText('api.anthropic.com')).toBeInTheDocument();
      expect(screen.getByText('443')).toBeInTheDocument();
      expect(screen.getByText('Claude API')).toBeInTheDocument();
    });

    it('ルールが0件の場合に空メッセージを表示する', () => {
      mockUseNetworkFilter.mockReturnValue({
        ...defaultMockHook,
        rules: [],
      });

      render(
        <NetworkFilterSection environmentId="env-001" environmentType="DOCKER" />
      );

      expect(screen.getByText(/ルールが設定されていません/)).toBeInTheDocument();
    });

    it('ポートがnullのルールは「全て」と表示される', () => {
      mockUseNetworkFilter.mockReturnValue({
        ...defaultMockHook,
        rules: [{ ...sampleRule, port: null }],
      });

      render(
        <NetworkFilterSection environmentId="env-001" environmentType="DOCKER" />
      );

      expect(screen.getByText('全て')).toBeInTheDocument();
    });
  });

  describe('ルール追加', () => {
    it('ルール追加ボタンクリックでフォームが表示される', async () => {
      render(
        <NetworkFilterSection environmentId="env-001" environmentType="DOCKER" />
      );

      const addButton = screen.getByRole('button', { name: /ルールを追加/ });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });
  });

  describe('フィルタリングトグル', () => {
    it('フィルタリングが無効の場合、トグルがオフ状態である', () => {
      mockUseNetworkFilter.mockReturnValue({
        ...defaultMockHook,
        filterConfig: { ...defaultMockHook.filterConfig!, enabled: false },
      });

      render(
        <NetworkFilterSection environmentId="env-001" environmentType="DOCKER" />
      );

      const toggle = screen.getByRole('switch');
      expect(toggle).toHaveAttribute('aria-checked', 'false');
    });

    it('フィルタリングが有効の場合、トグルがオン状態である', () => {
      mockUseNetworkFilter.mockReturnValue({
        ...defaultMockHook,
        filterConfig: { ...defaultMockHook.filterConfig!, enabled: true },
      });

      render(
        <NetworkFilterSection environmentId="env-001" environmentType="DOCKER" />
      );

      const toggle = screen.getByRole('switch');
      expect(toggle).toHaveAttribute('aria-checked', 'true');
    });

    it('トグルクリックでtoggleFilterが呼ばれる', async () => {
      mockUseNetworkFilter.mockReturnValue({
        ...defaultMockHook,
        filterConfig: { ...defaultMockHook.filterConfig!, enabled: false },
      });

      render(
        <NetworkFilterSection environmentId="env-001" environmentType="DOCKER" />
      );

      const toggle = screen.getByRole('switch');
      fireEvent.click(toggle);

      await waitFor(() => {
        expect(mockToggleFilter).toHaveBeenCalledWith(true);
      });
    });
  });

  describe('ルール削除', () => {
    it('削除ボタンクリックでdeleteRuleが呼ばれる', async () => {
      mockUseNetworkFilter.mockReturnValue({
        ...defaultMockHook,
        rules: [sampleRule],
      });

      render(
        <NetworkFilterSection environmentId="env-001" environmentType="DOCKER" />
      );

      const deleteButton = screen.getByRole('button', { name: /削除/ });
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(mockDeleteRule).toHaveBeenCalledWith('rule-001');
      });
    });
  });

  describe('ルール編集', () => {
    it('編集ボタンクリックで編集フォームが表示される', async () => {
      mockUseNetworkFilter.mockReturnValue({
        ...defaultMockHook,
        rules: [sampleRule],
      });

      render(
        <NetworkFilterSection environmentId="env-001" environmentType="DOCKER" />
      );

      const editButton = screen.getByRole('button', { name: /編集/ });
      fireEvent.click(editButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        // 編集モードでは既存の値が入力されている
        expect(screen.getByDisplayValue('api.anthropic.com')).toBeInTheDocument();
      });
    });
  });

  describe('ローディング状態', () => {
    it('ロード中はローディングインジケータを表示する', () => {
      mockUseNetworkFilter.mockReturnValue({
        ...defaultMockHook,
        isLoading: true,
      });

      render(
        <NetworkFilterSection environmentId="env-001" environmentType="DOCKER" />
      );

      expect(screen.getByText(/読み込み中/)).toBeInTheDocument();
    });
  });

  describe('エラー表示', () => {
    it('エラー時にエラーメッセージを表示する', () => {
      mockUseNetworkFilter.mockReturnValue({
        ...defaultMockHook,
        error: 'ネットワークフィルタリングの読み込みに失敗しました',
      });

      render(
        <NetworkFilterSection environmentId="env-001" environmentType="DOCKER" />
      );

      expect(screen.getByText('ネットワークフィルタリングの読み込みに失敗しました')).toBeInTheDocument();
    });
  });
});
