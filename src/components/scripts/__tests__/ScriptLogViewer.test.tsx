import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ScriptLogViewer } from '../ScriptLogViewer';
import { useScriptLogStore } from '@/store/script-logs';
import type { ScriptRunInfo } from '@/store/script-logs';

// Zustandストアをモック
vi.mock('@/store/script-logs', () => ({
  useScriptLogStore: vi.fn(),
}));

describe('ScriptLogViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('実行情報が存在しない場合、メッセージを表示する', () => {
    // runs.get()がundefinedを返すようにモック
    vi.mocked(useScriptLogStore).mockReturnValue(new Map());

    render(<ScriptLogViewer runId="non-existent-run" />);

    expect(screen.getByText('ログが見つかりません')).toBeInTheDocument();
  });

  it('実行中のスクリプト情報を表示する', () => {
    const mockRun: ScriptRunInfo = {
      runId: 'test-run-1',
      scriptId: 'script-1',
      scriptName: 'Test Script',
      isRunning: true,
      startTime: Date.now(),
      endTime: null,
      exitCode: null,
      signal: null,
      executionTime: null,
      logs: [],
    };

    const mockRuns = new Map([['test-run-1', mockRun]]);
    vi.mocked(useScriptLogStore).mockReturnValue(mockRuns);

    render(<ScriptLogViewer runId="test-run-1" />);

    expect(screen.getByText('Test Script')).toBeInTheDocument();
    expect(screen.getByText('実行中')).toBeInTheDocument();
  });

  it('完了したスクリプト情報（成功）を表示する', () => {
    const mockRun: ScriptRunInfo = {
      runId: 'test-run-1',
      scriptId: 'script-1',
      scriptName: 'Test Script',
      isRunning: false,
      startTime: Date.now() - 5000,
      endTime: Date.now(),
      exitCode: 0,
      signal: null,
      executionTime: 5000,
      logs: [],
    };

    const mockRuns = new Map([['test-run-1', mockRun]]);
    vi.mocked(useScriptLogStore).mockReturnValue(mockRuns);

    render(<ScriptLogViewer runId="test-run-1" />);

    expect(screen.getByText('成功')).toBeInTheDocument();
    expect(screen.getByText(/終了コード:/)).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText(/実行時間:/)).toBeInTheDocument();
  });

  it('完了したスクリプト情報（失敗）を表示する', () => {
    const mockRun: ScriptRunInfo = {
      runId: 'test-run-1',
      scriptId: 'script-1',
      scriptName: 'Test Script',
      isRunning: false,
      startTime: Date.now() - 3000,
      endTime: Date.now(),
      exitCode: 1,
      signal: null,
      executionTime: 3000,
      logs: [],
    };

    const mockRuns = new Map([['test-run-1', mockRun]]);
    vi.mocked(useScriptLogStore).mockReturnValue(mockRuns);

    render(<ScriptLogViewer runId="test-run-1" />);

    expect(screen.getByText('失敗')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('ログエントリーを表示する', () => {
    const mockRun: ScriptRunInfo = {
      runId: 'test-run-1',
      scriptId: 'script-1',
      scriptName: 'Test Script',
      isRunning: true,
      startTime: Date.now(),
      endTime: null,
      exitCode: null,
      signal: null,
      executionTime: null,
      logs: [
        { timestamp: Date.now(), level: 'info', content: 'Starting script...' },
        { timestamp: Date.now(), level: 'error', content: 'Error occurred!' },
        { timestamp: Date.now(), level: 'info', content: 'Script completed' },
      ],
    };

    const mockRuns = new Map([['test-run-1', mockRun]]);
    vi.mocked(useScriptLogStore).mockReturnValue(mockRuns);

    render(<ScriptLogViewer runId="test-run-1" />);

    expect(screen.getByText('Starting script...')).toBeInTheDocument();
    expect(screen.getByText('Error occurred!')).toBeInTheDocument();
    expect(screen.getByText('Script completed')).toBeInTheDocument();
  });

  it('ログレベルフィルターが機能する（REQ-035）', async () => {
    const mockRun: ScriptRunInfo = {
      runId: 'test-run-1',
      scriptId: 'script-1',
      scriptName: 'Test Script',
      isRunning: true,
      startTime: Date.now(),
      endTime: null,
      exitCode: null,
      signal: null,
      executionTime: null,
      logs: [
        { timestamp: Date.now(), level: 'info', content: 'Info log' },
        { timestamp: Date.now(), level: 'error', content: 'Error log' },
      ],
    };

    const mockRuns = new Map([['test-run-1', mockRun]]);
    vi.mocked(useScriptLogStore).mockReturnValue(mockRuns);

    render(<ScriptLogViewer runId="test-run-1" />);

    // 最初はすべて表示
    expect(screen.getByText('Info log')).toBeInTheDocument();
    expect(screen.getByText('Error log')).toBeInTheDocument();

    // エラーのみフィルター
    const filterSelect = screen.getByRole('combobox');
    fireEvent.change(filterSelect, { target: { value: 'error' } });

    await waitFor(() => {
      expect(screen.queryByText('Info log')).not.toBeInTheDocument();
      expect(screen.getByText('Error log')).toBeInTheDocument();
    });

    // 情報のみフィルター
    fireEvent.change(filterSelect, { target: { value: 'info' } });

    await waitFor(() => {
      expect(screen.getByText('Info log')).toBeInTheDocument();
      expect(screen.queryByText('Error log')).not.toBeInTheDocument();
    });
  });

  it('テキスト検索が機能する（REQ-036）', async () => {
    const mockRun: ScriptRunInfo = {
      runId: 'test-run-1',
      scriptId: 'script-1',
      scriptName: 'Test Script',
      isRunning: true,
      startTime: Date.now(),
      endTime: null,
      exitCode: null,
      signal: null,
      executionTime: null,
      logs: [
        { timestamp: Date.now(), level: 'info', content: 'Starting process' },
        { timestamp: Date.now(), level: 'info', content: 'Processing data' },
        { timestamp: Date.now(), level: 'info', content: 'Completed successfully' },
      ],
    };

    const mockRuns = new Map([['test-run-1', mockRun]]);
    vi.mocked(useScriptLogStore).mockReturnValue(mockRuns);

    render(<ScriptLogViewer runId="test-run-1" />);

    // 最初はすべて表示
    expect(screen.getByText('Starting process')).toBeInTheDocument();
    expect(screen.getByText('Processing data')).toBeInTheDocument();
    expect(screen.getByText('Completed successfully')).toBeInTheDocument();

    // "process"で検索
    const searchInput = screen.getByPlaceholderText('ログを検索...');
    fireEvent.change(searchInput, { target: { value: 'process' } });

    await waitFor(() => {
      expect(screen.getByText('Starting process')).toBeInTheDocument();
      expect(screen.getByText('Processing data')).toBeInTheDocument();
      expect(screen.queryByText('Completed successfully')).not.toBeInTheDocument();
    });
  });

  it('自動スクロールのオン/オフが切り替えられる', () => {
    const mockRun: ScriptRunInfo = {
      runId: 'test-run-1',
      scriptId: 'script-1',
      scriptName: 'Test Script',
      isRunning: true,
      startTime: Date.now(),
      endTime: null,
      exitCode: null,
      signal: null,
      executionTime: null,
      logs: [],
    };

    const mockRuns = new Map([['test-run-1', mockRun]]);
    vi.mocked(useScriptLogStore).mockReturnValue(mockRuns);

    render(<ScriptLogViewer runId="test-run-1" />);

    const autoScrollCheckbox = screen.getByRole('checkbox');

    // デフォルトではチェックされている
    expect(autoScrollCheckbox).toBeChecked();

    // チェックを外す
    fireEvent.click(autoScrollCheckbox);
    expect(autoScrollCheckbox).not.toBeChecked();

    // 再度チェックする
    fireEvent.click(autoScrollCheckbox);
    expect(autoScrollCheckbox).toBeChecked();
  });

  it('実行時間のフォーマットが正しい（秒）', () => {
    // 5秒
    const mockRun: ScriptRunInfo = {
      runId: 'test-run-1',
      scriptId: 'script-1',
      scriptName: 'Test Script',
      isRunning: false,
      startTime: Date.now() - 5000,
      endTime: Date.now(),
      exitCode: 0,
      signal: null,
      executionTime: 5000,
      logs: [],
    };

    const mockRuns = new Map([['test-run-1', mockRun]]);
    vi.mocked(useScriptLogStore).mockReturnValue(mockRuns);

    render(<ScriptLogViewer runId="test-run-1" />);
    expect(screen.getByText('5.00s')).toBeInTheDocument();
  });

  it('実行時間のフォーマットが正しい（分）', () => {
    // 1分30秒
    const mockRun: ScriptRunInfo = {
      runId: 'test-run-2',
      scriptId: 'script-1',
      scriptName: 'Test Script',
      isRunning: false,
      startTime: Date.now() - 90000,
      endTime: Date.now(),
      exitCode: 0,
      signal: null,
      executionTime: 90000,
      logs: [],
    };

    const mockRuns = new Map([['test-run-2', mockRun]]);
    vi.mocked(useScriptLogStore).mockReturnValue(mockRuns);

    render(<ScriptLogViewer runId="test-run-2" />);
    expect(screen.getByText('1m 30s')).toBeInTheDocument();
  });
});
