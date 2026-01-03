/**
 * WebSocket統合テスト
 * タスク4.3: リアルタイム更新統合
 *
 * WebSocketを使用したリアルタイム更新が正しく機能することをテストします。
 * - ステータス変更でストア更新
 * - セッション一覧のステータス自動更新
 * - エラーメッセージ処理
 *
 * NOTE: メッセージ表示機能はターミナルベースUIに移行したため、
 * messages/permissionRequest関連のテストは削除済み
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAppStore } from '@/store';
import type { ServerMessage } from '@/types/websocket';

describe('WebSocket Integration', () => {
  beforeEach(() => {
    // Zustandストアをリセット
    const { reset } = useAppStore.getState();
    reset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('handleWebSocketMessage', () => {
    it('status_changeメッセージを受信したらセッションステータスが更新される', async () => {
      const { result } = renderHook(() => useAppStore());

      // テスト用セッションを追加
      act(() => {
        result.current.setSessions([
          {
            id: 'session-1',
            project_id: 'project-1',
            name: 'Test Session',
            status: 'initializing',
            model: 'claude-3-5-sonnet-20241022',
            worktree_path: '/tmp/worktree',
            branch_name: 'feature/test',
            created_at: new Date().toISOString(),
          },
        ]);
        result.current.setSelectedSessionId('session-1');
      });

      const statusMessage: ServerMessage = {
        type: 'status_change',
        status: 'running',
      };

      act(() => {
        result.current.handleWebSocketMessage(statusMessage);
      });

      await waitFor(() => {
        const session = result.current.sessions.find((s) => s.id === 'session-1');
        expect(session?.status).toBe('running');
      });
    });

    it('セッション一覧のステータスも自動更新される', async () => {
      const { result } = renderHook(() => useAppStore());

      // 複数のセッションを追加
      act(() => {
        result.current.setSessions([
          {
            id: 'session-1',
            project_id: 'project-1',
            name: 'Session 1',
            status: 'running',
            model: 'claude-3-5-sonnet-20241022',
            worktree_path: '/tmp/worktree-1',
            branch_name: 'feature/test-1',
            created_at: new Date().toISOString(),
          },
          {
            id: 'session-2',
            project_id: 'project-1',
            name: 'Session 2',
            status: 'waiting_input',
            model: 'claude-3-5-sonnet-20241022',
            worktree_path: '/tmp/worktree-2',
            branch_name: 'feature/test-2',
            created_at: new Date().toISOString(),
          },
        ]);
        result.current.setSelectedSessionId('session-1');
      });

      const statusMessage: ServerMessage = {
        type: 'status_change',
        status: 'completed',
      };

      act(() => {
        result.current.handleWebSocketMessage(statusMessage);
      });

      await waitFor(() => {
        // session-1のステータスが更新されている
        const session1 = result.current.sessions.find((s) => s.id === 'session-1');
        expect(session1?.status).toBe('completed');

        // session-2のステータスは変わっていない
        const session2 = result.current.sessions.find((s) => s.id === 'session-2');
        expect(session2?.status).toBe('waiting_input');
      });
    });

    it('errorメッセージを受信したらエラーが設定される', async () => {
      const { result } = renderHook(() => useAppStore());

      const errorMessage: ServerMessage = {
        type: 'error',
        content: 'Connection failed',
      };

      act(() => {
        result.current.handleWebSocketMessage(errorMessage);
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Connection failed');
      });
    });

    it('currentSessionが更新されたらステータスも同期される', async () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        const session = {
          id: 'session-1',
          project_id: 'project-1',
          name: 'Test Session',
          status: 'initializing' as const,
          model: 'claude-3-5-sonnet-20241022',
          worktree_path: '/tmp/worktree',
          branch_name: 'feature/test',
          created_at: new Date().toISOString(),
        };
        result.current.setSessions([session]);
        result.current.setSelectedSessionId('session-1');
        // currentSessionも設定
        useAppStore.setState({ currentSession: session });
      });

      const statusMessage: ServerMessage = {
        type: 'status_change',
        status: 'running',
      };

      act(() => {
        result.current.handleWebSocketMessage(statusMessage);
      });

      await waitFor(() => {
        // currentSessionのステータスも更新される
        expect(result.current.currentSession?.status).toBe('running');
      });
    });
  });
});
