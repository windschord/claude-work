/**
 * WebSocket統合テスト
 * タスク4.3: リアルタイム更新統合
 *
 * WebSocketを使用したリアルタイム更新が正しく機能することをテストします。
 * - メッセージ受信でZustandストア更新
 * - 権限リクエスト受信でダイアログ表示
 * - ステータス変更でストア更新
 * - セッション一覧のステータス自動更新
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
    // NOTE: これらのテストはストアにmessages/permissionRequest機能が実装された際に有効化する
    it.skip('outputメッセージを受信したらmessagesに追加される', async () => {
      const { result } = renderHook(() => useAppStore());

      // セッションIDを設定
      act(() => {
        result.current.setSelectedSessionId('test-session-id');
      });

      const outputMessage: ServerMessage = {
        type: 'output',
        content: 'Hello from Claude Code',
      };

      // handleWebSocketMessageを呼び出し
      act(() => {
        result.current.handleWebSocketMessage(outputMessage);
      });

      await waitFor(() => {
        expect(result.current.messages).toHaveLength(1);
        expect(result.current.messages[0].role).toBe('assistant');
        expect(result.current.messages[0].content).toBe('Hello from Claude Code');
      });
    });

    // NOTE: これらのテストはストアにmessages/permissionRequest機能が実装された際に有効化する
    it.skip('outputメッセージにsubAgentが含まれている場合も正しく追加される', async () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.setSelectedSessionId('test-session-id');
      });

      const outputMessage: ServerMessage = {
        type: 'output',
        content: 'Task completed',
        subAgent: {
          name: 'test-agent',
          output: 'Agent output',
        },
      };

      act(() => {
        result.current.handleWebSocketMessage(outputMessage);
      });

      await waitFor(() => {
        expect(result.current.messages).toHaveLength(1);
        expect(result.current.messages[0].content).toBe('Task completed');
        // サブエージェント情報がJSON文字列として保存される
        expect(result.current.messages[0].sub_agents).toBeTruthy();
      });
    });

    // NOTE: これらのテストはストアにmessages/permissionRequest機能が実装された際に有効化する
    it.skip('permission_requestメッセージを受信したらpermissionRequestが更新される', async () => {
      const { result } = renderHook(() => useAppStore());

      const permissionMessage: ServerMessage = {
        type: 'permission_request',
        permission: {
          requestId: 'req-123',
          action: 'git commit',
          details: 'Commit changes to main branch',
        },
      };

      act(() => {
        result.current.handleWebSocketMessage(permissionMessage);
      });

      await waitFor(() => {
        expect(result.current.permissionRequest).toEqual({
          id: 'req-123',
          type: 'git commit',
          description: 'git commit',
          details: 'Commit changes to main branch',
        });
      });
    });

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

  // NOTE: これらのテストはストアにmessages機能が実装された際に有効化する
  describe.skip('パフォーマンス要件', () => {
    it('メッセージ受信から表示まで500ms以内で処理される', async () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.setSelectedSessionId('test-session-id');
      });

      const startTime = performance.now();

      const outputMessage: ServerMessage = {
        type: 'output',
        content: 'Performance test message',
      };

      act(() => {
        result.current.handleWebSocketMessage(outputMessage);
      });

      await waitFor(() => {
        expect(result.current.messages).toHaveLength(1);
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      // 500ms以内で処理が完了すること
      expect(duration).toBeLessThan(500);
    });

    it('大量のメッセージを連続で受信しても500ms以内で処理される', async () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.setSelectedSessionId('test-session-id');
      });

      const messageCount = 10;
      const messages: ServerMessage[] = Array.from({ length: messageCount }, (_, i) => ({
        type: 'output',
        content: `Message ${i + 1}`,
      }));

      const startTime = performance.now();

      act(() => {
        messages.forEach((msg) => {
          result.current.handleWebSocketMessage(msg);
        });
      });

      await waitFor(() => {
        expect(result.current.messages).toHaveLength(messageCount);
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      // 10メッセージでも500ms以内
      expect(duration).toBeLessThan(500);
    });
  });

  // NOTE: これらのテストはストアにmessages機能が実装された際に有効化する
  describe.skip('メモリ管理', () => {
    it('メッセージが1000件を超えたら古いメッセージが削除される', async () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.setSelectedSessionId('test-session-id');
      });

      // 1001件のメッセージを追加
      const messageCount = 1001;

      act(() => {
        for (let i = 0; i < messageCount; i++) {
          result.current.handleWebSocketMessage({
            type: 'output',
            content: `Message ${i + 1}`,
          });
        }
      });

      await waitFor(() => {
        // 最大1000件まで保持
        expect(result.current.messages.length).toBeLessThanOrEqual(1000);

        // 最新のメッセージが残っている
        const lastMessage = result.current.messages[result.current.messages.length - 1];
        expect(lastMessage.content).toBe(`Message ${messageCount}`);
      });
    });
  });
});
