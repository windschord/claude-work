/**
 * ModelSelectorのテスト
 * Task 43.13: モデル選択UI（コンパクトモードとフルモード）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModelSelector } from '../ModelSelector';

describe('ModelSelector', () => {
  const mockOnChange = vi.fn();
  const defaultProps = {
    value: 'auto',
    onChange: mockOnChange,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('共通動作', () => {
    it('4つのモデルオプションが存在する', () => {
      render(<ModelSelector {...defaultProps} compact={false} />);

      expect(screen.getByRole('button', { name: /auto/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /opus/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sonnet/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /haiku/i })).toBeInTheDocument();
    });

    it('選択変更時にonChangeが呼ばれる', () => {
      render(<ModelSelector {...defaultProps} compact={false} />);

      const sonnetButton = screen.getByRole('button', { name: /sonnet/i });
      fireEvent.click(sonnetButton);

      expect(mockOnChange).toHaveBeenCalledWith('claude-sonnet-4');
    });
  });

  describe('フルモード（compact=false）', () => {
    it('ボタン群が表示される', () => {
      render(<ModelSelector {...defaultProps} compact={false} />);

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBe(4);
    });

    it('選択中のボタンがハイライトされる', () => {
      render(<ModelSelector {...defaultProps} value="claude-opus-4" compact={false} />);

      const opusButton = screen.getByRole('button', { name: /opus/i });
      expect(opusButton).toHaveClass('bg-blue-500');
    });

    it('未選択のボタンはデフォルトスタイル', () => {
      render(<ModelSelector {...defaultProps} value="claude-opus-4" compact={false} />);

      const sonnetButton = screen.getByRole('button', { name: /sonnet/i });
      expect(sonnetButton).not.toHaveClass('bg-blue-500');
    });

    it('autoが選択されている場合、Autoボタンがハイライト', () => {
      render(<ModelSelector {...defaultProps} value="auto" compact={false} />);

      const autoButton = screen.getByRole('button', { name: /auto/i });
      expect(autoButton).toHaveClass('bg-blue-500');
    });
  });

  describe('コンパクトモード（compact=true）', () => {
    it('selectが表示される', () => {
      render(<ModelSelector {...defaultProps} compact={true} />);

      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
    });

    it('4つのオプションがselectに含まれる', () => {
      render(<ModelSelector {...defaultProps} compact={true} />);

      const options = screen.getAllByRole('option');
      expect(options.length).toBe(4);
    });

    it('選択変更時にonChangeが呼ばれる', () => {
      render(<ModelSelector {...defaultProps} compact={true} />);

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'claude-haiku' } });

      expect(mockOnChange).toHaveBeenCalledWith('claude-haiku');
    });

    it('現在の値がselectで選択されている', () => {
      render(<ModelSelector {...defaultProps} value="claude-sonnet-4" compact={true} />);

      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('claude-sonnet-4');
    });
  });

  describe('デフォルト動作', () => {
    it('compactを指定しない場合はフルモード', () => {
      render(<ModelSelector {...defaultProps} />);

      // ボタン群が表示される（セレクトではなく）
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBe(4);
    });
  });

  describe('disabledプロパティ', () => {
    it('disabled時にすべてのボタンが無効化される（フルモード）', () => {
      render(<ModelSelector {...defaultProps} compact={false} disabled />);

      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        expect(button).toBeDisabled();
      });
    });

    it('disabled時にselectが無効化される（コンパクトモード）', () => {
      render(<ModelSelector {...defaultProps} compact={true} disabled />);

      const select = screen.getByRole('combobox');
      expect(select).toBeDisabled();
    });
  });

  describe('カスタムラベル', () => {
    it('ラベルが表示される', () => {
      render(<ModelSelector {...defaultProps} label="デフォルトモデル" />);

      expect(screen.getByText('デフォルトモデル')).toBeInTheDocument();
    });
  });
});
