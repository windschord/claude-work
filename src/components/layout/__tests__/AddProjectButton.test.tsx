/**
 * AddProjectButtonコンポーネントのテスト
 * Task 48.1: サイドバーにリポジトリ追加ボタンを配置
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AddProjectButton } from '../AddProjectButton';

describe('AddProjectButton', () => {
  it('ボタンがレンダリングされる', () => {
    render(<AddProjectButton onClick={() => {}} />);

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('ボタンにFolderPlusアイコンが含まれる', () => {
    render(<AddProjectButton onClick={() => {}} />);

    // FolderPlusアイコンはdata-testidで確認
    expect(screen.getByTestId('folder-plus-icon')).toBeInTheDocument();
  });

  it('クリックでonClickが呼ばれる', () => {
    const handleClick = vi.fn();
    render(<AddProjectButton onClick={handleClick} />);

    fireEvent.click(screen.getByRole('button'));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('ボタンにツールチップ（title属性）がある', () => {
    render(<AddProjectButton onClick={() => {}} />);

    expect(screen.getByRole('button')).toHaveAttribute('title', 'リポジトリを追加');
  });
});
