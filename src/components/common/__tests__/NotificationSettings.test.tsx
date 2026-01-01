import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotificationSettings } from '../NotificationSettings';

// useNotificationStoreのモック
const mockUpdateSettings = vi.fn();
const mockUseNotificationStore = vi.fn();

vi.mock('@/store/notification', () => ({
  useNotificationStore: () => mockUseNotificationStore(),
}));

describe('NotificationSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('通知が許可されている場合、Bellアイコンが表示される', () => {
    mockUseNotificationStore.mockReturnValue({
      permission: 'granted',
      settings: {
        onTaskComplete: true,
        onPermissionRequest: true,
        onError: true,
        onActionRequired: true,
      },
      updateSettings: mockUpdateSettings,
      initializeFromStorage: vi.fn(),
    });

    render(<NotificationSettings />);

    const button = screen.getByLabelText('通知設定');
    expect(button).toBeInTheDocument();

    // Bellアイコンが存在することを確認（SVG要素として）
    const svg = button.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('通知がブロックされている場合、BellOffアイコンが表示される', () => {
    mockUseNotificationStore.mockReturnValue({
      permission: 'denied',
      settings: {
        onTaskComplete: true,
        onPermissionRequest: true,
        onError: true,
        onActionRequired: true,
      },
      updateSettings: mockUpdateSettings,
      initializeFromStorage: vi.fn(),
    });

    render(<NotificationSettings />);

    const button = screen.getByLabelText('通知設定');
    const svg = button.querySelector('svg');
    expect(svg).toBeInTheDocument();

    // BellOffアイコンはtext-gray-400クラスを持つ
    expect(svg).toHaveClass('text-gray-400');
  });

  it('ボタンをクリックするとドロップダウンが開く', () => {
    mockUseNotificationStore.mockReturnValue({
      permission: 'granted',
      settings: {
        onTaskComplete: true,
        onPermissionRequest: true,
        onError: true,
        onActionRequired: true,
      },
      updateSettings: mockUpdateSettings,
      initializeFromStorage: vi.fn(),
    });

    render(<NotificationSettings />);

    const button = screen.getByLabelText('通知設定');

    // 初期状態ではドロップダウンは非表示
    expect(screen.queryByText('通知設定')).not.toBeInTheDocument();

    // クリックでドロップダウンが開く
    fireEvent.click(button);

    expect(screen.getByText('通知設定')).toBeInTheDocument();
    expect(screen.getByText('タスク完了')).toBeInTheDocument();
    expect(screen.getByText('権限要求')).toBeInTheDocument();
    expect(screen.getByText('エラー発生')).toBeInTheDocument();
    expect(screen.getByText('アクション要求')).toBeInTheDocument();
  });

  // Task 43.20: アクション要求チェックボックスのテスト
  it('アクション要求チェックボックスが表示される', () => {
    mockUseNotificationStore.mockReturnValue({
      permission: 'granted',
      settings: {
        onTaskComplete: true,
        onPermissionRequest: true,
        onError: true,
        onActionRequired: true,
      },
      updateSettings: mockUpdateSettings,
      initializeFromStorage: vi.fn(),
    });

    render(<NotificationSettings />);

    // ドロップダウンを開く
    const button = screen.getByLabelText('通知設定');
    fireEvent.click(button);

    // アクション要求チェックボックスが表示される
    expect(screen.getByText('アクション要求')).toBeInTheDocument();
  });

  it('アクション要求チェックボックスの変更でupdateSettingsが呼ばれる', () => {
    mockUseNotificationStore.mockReturnValue({
      permission: 'granted',
      settings: {
        onTaskComplete: true,
        onPermissionRequest: true,
        onError: true,
        onActionRequired: true,
      },
      updateSettings: mockUpdateSettings,
      initializeFromStorage: vi.fn(),
    });

    render(<NotificationSettings />);

    // ドロップダウンを開く
    const button = screen.getByLabelText('通知設定');
    fireEvent.click(button);

    // アクション要求チェックボックスを取得
    const actionRequiredLabel = screen.getByText('アクション要求').closest('label');
    const checkbox = actionRequiredLabel?.querySelector('input[type="checkbox"]') as HTMLInputElement;

    expect(checkbox).toBeInTheDocument();
    expect(checkbox.checked).toBe(true);

    // チェックを外す
    fireEvent.click(checkbox);

    expect(mockUpdateSettings).toHaveBeenCalledWith({ onActionRequired: false });
  });

  it('タスク完了チェックボックスの変更でupdateSettingsが呼ばれる', () => {
    mockUseNotificationStore.mockReturnValue({
      permission: 'granted',
      settings: {
        onTaskComplete: true,
        onPermissionRequest: true,
        onError: true,
        onActionRequired: true,
      },
      updateSettings: mockUpdateSettings,
      initializeFromStorage: vi.fn(),
    });

    render(<NotificationSettings />);

    // ドロップダウンを開く
    const button = screen.getByLabelText('通知設定');
    fireEvent.click(button);

    // タスク完了チェックボックスを取得
    const taskCompleteLabel = screen.getByText('タスク完了').closest('label');
    const checkbox = taskCompleteLabel?.querySelector('input[type="checkbox"]') as HTMLInputElement;

    expect(checkbox).toBeInTheDocument();
    expect(checkbox.checked).toBe(true);

    // チェックを外す
    fireEvent.click(checkbox);

    expect(mockUpdateSettings).toHaveBeenCalledWith({ onTaskComplete: false });
  });

  it('権限要求チェックボックスの変更でupdateSettingsが呼ばれる', () => {
    mockUseNotificationStore.mockReturnValue({
      permission: 'granted',
      settings: {
        onTaskComplete: true,
        onPermissionRequest: true,
        onError: true,
        onActionRequired: true,
      },
      updateSettings: mockUpdateSettings,
      initializeFromStorage: vi.fn(),
    });

    render(<NotificationSettings />);

    // ドロップダウンを開く
    const button = screen.getByLabelText('通知設定');
    fireEvent.click(button);

    // 権限要求チェックボックスを取得
    const permissionRequestLabel = screen.getByText('権限要求').closest('label');
    const checkbox = permissionRequestLabel?.querySelector('input[type="checkbox"]') as HTMLInputElement;

    expect(checkbox).toBeInTheDocument();
    expect(checkbox.checked).toBe(true);

    // チェックを外す
    fireEvent.click(checkbox);

    expect(mockUpdateSettings).toHaveBeenCalledWith({ onPermissionRequest: false });
  });

  it('エラー発生チェックボックスの変更でupdateSettingsが呼ばれる', () => {
    mockUseNotificationStore.mockReturnValue({
      permission: 'granted',
      settings: {
        onTaskComplete: true,
        onPermissionRequest: true,
        onError: true,
        onActionRequired: true,
      },
      updateSettings: mockUpdateSettings,
      initializeFromStorage: vi.fn(),
    });

    render(<NotificationSettings />);

    // ドロップダウンを開く
    const button = screen.getByLabelText('通知設定');
    fireEvent.click(button);

    // エラー発生チェックボックスを取得
    const errorLabel = screen.getByText('エラー発生').closest('label');
    const checkbox = errorLabel?.querySelector('input[type="checkbox"]') as HTMLInputElement;

    expect(checkbox).toBeInTheDocument();
    expect(checkbox.checked).toBe(true);

    // チェックを外す
    fireEvent.click(checkbox);

    expect(mockUpdateSettings).toHaveBeenCalledWith({ onError: false });
  });

  it('通知がブロックされている場合、警告メッセージが表示される', () => {
    mockUseNotificationStore.mockReturnValue({
      permission: 'denied',
      settings: {
        onTaskComplete: true,
        onPermissionRequest: true,
        onError: true,
        onActionRequired: true,
      },
      updateSettings: mockUpdateSettings,
      initializeFromStorage: vi.fn(),
    });

    render(<NotificationSettings />);

    // ドロップダウンを開く
    const button = screen.getByLabelText('通知設定');
    fireEvent.click(button);

    // 警告メッセージが表示される
    expect(screen.getByText('ブラウザの通知がブロックされています')).toBeInTheDocument();
  });

  it('通知が許可されている場合、警告メッセージは表示されない', () => {
    mockUseNotificationStore.mockReturnValue({
      permission: 'granted',
      settings: {
        onTaskComplete: true,
        onPermissionRequest: true,
        onError: true,
        onActionRequired: true,
      },
      updateSettings: mockUpdateSettings,
      initializeFromStorage: vi.fn(),
    });

    render(<NotificationSettings />);

    // ドロップダウンを開く
    const button = screen.getByLabelText('通知設定');
    fireEvent.click(button);

    // 警告メッセージは表示されない
    expect(screen.queryByText('ブラウザの通知がブロックされています')).not.toBeInTheDocument();
  });

  it('再度ボタンをクリックするとドロップダウンが閉じる', () => {
    mockUseNotificationStore.mockReturnValue({
      permission: 'granted',
      settings: {
        onTaskComplete: true,
        onPermissionRequest: true,
        onError: true,
        onActionRequired: true,
      },
      updateSettings: mockUpdateSettings,
      initializeFromStorage: vi.fn(),
    });

    render(<NotificationSettings />);

    const button = screen.getByLabelText('通知設定');

    // ドロップダウンを開く
    fireEvent.click(button);
    expect(screen.getByText('タスク完了')).toBeInTheDocument();

    // 再度クリックでドロップダウンが閉じる
    fireEvent.click(button);
    expect(screen.queryByText('タスク完了')).not.toBeInTheDocument();
  });
});
