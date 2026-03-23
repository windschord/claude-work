import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChromeDebugInfo } from '../sessions/ChromeDebugInfo';
import { ChromeBadge } from '../sessions/ChromeBadge';

describe('Session Chrome Info', () => {
  describe('ChromeDebugInfo (セッション詳細画面)', () => {
    it('サイドカーあり・ポートあり: デバッグ情報が表示されること', () => {
      render(
        <ChromeDebugInfo
          chromeContainerId="cw-chrome-session-1"
          chromeDebugPort={49152}
        />
      );
      expect(screen.getByText('Chrome DevTools Debug')).toBeDefined();
      expect(screen.getByText(/Running/)).toBeDefined();
      expect(screen.getByText(/localhost:49152/)).toBeDefined();
    });

    it('サイドカーあり・ポートなし: ポート不明表示', () => {
      render(
        <ChromeDebugInfo
          chromeContainerId="cw-chrome-session-1"
          chromeDebugPort={null}
        />
      );
      expect(screen.getByText(/debug port unavailable/)).toBeDefined();
    });

    it('サイドカーなし: セクション非表示', () => {
      const { container } = render(
        <ChromeDebugInfo
          chromeContainerId={null}
          chromeDebugPort={null}
        />
      );
      expect(container.innerHTML).toBe('');
    });
  });

  describe('ChromeBadge (セッションリスト)', () => {
    it('サイドカーあり: Chromeバッジ表示', () => {
      render(<ChromeBadge chromeContainerId="cw-chrome-session-1" />);
      expect(screen.getByText('Chrome')).toBeDefined();
    });

    it('サイドカーなし: バッジ非表示', () => {
      const { container } = render(<ChromeBadge chromeContainerId={null} />);
      expect(container.innerHTML).toBe('');
    });
  });
});
