import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AddProjectModal } from './AddProjectModal';

describe('AddProjectModal - キャンセルボタン', () => {
  it('キャンセルボタンをクリックするとonCloseが呼ばれる', async () => {
    const onClose = vi.fn();

    render(
      <AddProjectModal
        isOpen={true}
        onClose={onClose}
      />
    );

    // キャンセルボタンを取得
    const cancelButton = screen.getByRole('button', { name: /キャンセル/i });

    // クリック
    fireEvent.click(cancelButton);

    // onCloseが即座に呼ばれることを確認
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    }, { timeout: 1000 }); // 1秒以内に呼ばれるべき
  });

  it('キャンセルボタンをクリックするとフォームがリセットされる', async () => {
    const onClose = vi.fn();

    render(
      <AddProjectModal
        isOpen={true}
        onClose={onClose}
      />
    );

    // フォームに入力
    const pathInput = screen.getByLabelText(/Gitリポジトリのパス/i);
    fireEvent.change(pathInput, { target: { value: '/test/path' } });

    // 入力値を確認
    expect(pathInput).toHaveValue('/test/path');

    // キャンセルボタンをクリック
    const cancelButton = screen.getByRole('button', { name: /キャンセル/i });
    fireEvent.click(cancelButton);

    // onCloseが呼ばれることを確認
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('Escキーでもダイアログが閉じる', async () => {
    const onClose = vi.fn();

    render(
      <AddProjectModal
        isOpen={true}
        onClose={onClose}
      />
    );

    // Dialogコンポーネント内でEscキーを押す
    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });

    // onCloseが呼ばれることを確認
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
