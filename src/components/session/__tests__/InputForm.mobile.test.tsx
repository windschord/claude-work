import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import InputForm from '../InputForm';

describe('InputForm - Mobile Optimization', () => {
  afterEach(() => {
    cleanup();
  });

  const mockOnSubmit = () => {};

  it('テキストエリアのフォントサイズがtext-baseに設定されている', () => {
    render(<InputForm onSubmit={mockOnSubmit} />);
    const textarea = screen.getByPlaceholderText(/メッセージを入力してください/);
    expect(textarea).toHaveClass('text-base');
  });

  it('送信ボタンの最小高さが44pxに設定されている', () => {
    render(<InputForm onSubmit={mockOnSubmit} />);
    const button = screen.getByRole('button', { name: /送信/ });
    expect(button).toHaveClass('min-h-[44px]');
  });

  it('送信ボタンのパディングが適切に設定されている', () => {
    render(<InputForm onSubmit={mockOnSubmit} />);
    const button = screen.getByRole('button', { name: /送信/ });
    expect(button).toHaveClass('px-6');
    expect(button).toHaveClass('py-2');
  });

  it('テキストエリアが3行で表示される', () => {
    render(<InputForm onSubmit={mockOnSubmit} />);
    const textarea = screen.getByPlaceholderText(/メッセージを入力してください/);
    expect(textarea).toHaveAttribute('rows', '3');
  });

  it('テキストエリアのリサイズが無効化されている', () => {
    render(<InputForm onSubmit={mockOnSubmit} />);
    const textarea = screen.getByPlaceholderText(/メッセージを入力してください/);
    expect(textarea).toHaveClass('resize-none');
  });

  it('フォームにボーダートップが設定されている', () => {
    const { container } = render(<InputForm onSubmit={mockOnSubmit} />);
    const form = container.querySelector('form');
    expect(form).toHaveClass('border-t');
  });

  it('フォームのパディングが適切に設定されている', () => {
    const { container } = render(<InputForm onSubmit={mockOnSubmit} />);
    const form = container.querySelector('form');
    expect(form).toHaveClass('p-4');
  });
});
