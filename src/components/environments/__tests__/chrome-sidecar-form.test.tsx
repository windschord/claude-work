import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChromeSidecarSection } from '../ChromeSidecarSection';

describe('ChromeSidecarSection', () => {
  const defaultProps = {
    enabled: false,
    image: 'chromium/headless-shell',
    tag: '131.0.6778.204',
    onEnabledChange: vi.fn(),
    onImageChange: vi.fn(),
    onTagChange: vi.fn(),
    disabled: false,
  };

  it('Chrome Sidecarセクションが表示されること', () => {
    render(<ChromeSidecarSection {...defaultProps} />);
    expect(screen.getByText('Chrome Sidecar')).toBeDefined();
  });

  it('トグルOFF時にimage/tagフィールドが無効化されること', () => {
    render(<ChromeSidecarSection {...defaultProps} enabled={false} />);
    const imageInput = screen.getByLabelText('Chrome Image') as HTMLInputElement;
    const tagInput = screen.getByLabelText('Chrome Tag') as HTMLInputElement;
    expect(imageInput.disabled).toBe(true);
    expect(tagInput.disabled).toBe(true);
  });

  it('トグルON時にimage/tagフィールドが有効化されること', () => {
    render(<ChromeSidecarSection {...defaultProps} enabled={true} />);
    const imageInput = screen.getByLabelText('Chrome Image') as HTMLInputElement;
    const tagInput = screen.getByLabelText('Chrome Tag') as HTMLInputElement;
    expect(imageInput.disabled).toBe(false);
    expect(tagInput.disabled).toBe(false);
  });

  it('トグルON時にデフォルト値が表示されること', () => {
    render(<ChromeSidecarSection {...defaultProps} enabled={true} />);
    const imageInput = screen.getByLabelText('Chrome Image') as HTMLInputElement;
    const tagInput = screen.getByLabelText('Chrome Tag') as HTMLInputElement;
    expect(imageInput.value).toBe('chromium/headless-shell');
    expect(tagInput.value).toBe('131.0.6778.204');
  });

  it('tag に "latest" を入力するとバリデーションエラーが表示されること', () => {
    render(<ChromeSidecarSection {...defaultProps} enabled={true} tag="latest" />);
    expect(screen.getByText(/latestは使用できません/)).toBeDefined();
  });

  it('トグルを切り替えるとonEnabledChangeが呼ばれること', () => {
    const onEnabledChange = vi.fn();
    render(<ChromeSidecarSection {...defaultProps} onEnabledChange={onEnabledChange} />);
    const toggle = screen.getByRole('checkbox');
    fireEvent.click(toggle);
    expect(onEnabledChange).toHaveBeenCalledWith(true);
  });

  it('既存のchromeSidecar設定がフォームに正しく反映されること', () => {
    render(
      <ChromeSidecarSection
        {...defaultProps}
        enabled={true}
        image="my-chrome/image"
        tag="120.0.0.1"
      />
    );
    const imageInput = screen.getByLabelText('Chrome Image') as HTMLInputElement;
    const tagInput = screen.getByLabelText('Chrome Tag') as HTMLInputElement;
    expect(imageInput.value).toBe('my-chrome/image');
    expect(tagInput.value).toBe('120.0.0.1');
  });
});
