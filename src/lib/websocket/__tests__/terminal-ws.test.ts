import { describe, it, expect } from 'vitest';
import { setupTerminalWebSocket } from '../terminal-ws';

/**
 * ターミナルWebSocketのユニットテスト
 *
 * Note: WebSocket統合テストは実際のサーバーインスタンスが必要なため、
 * E2Eテストで実施します。ここでは関数のエクスポートと基本的な検証のみ実施します。
 */
describe('Terminal WebSocket', () => {

  it('should export setupTerminalWebSocket function', () => {
    expect(setupTerminalWebSocket).toBeDefined();
    expect(typeof setupTerminalWebSocket).toBe('function');
  });

  it('should accept WebSocketServer and path parameters', () => {
    // 関数のシグネチャを検証
    expect(setupTerminalWebSocket.length).toBe(2);
  });
});
