import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import ProjectLayout from '../layout';

// コンポーネントのモック
vi.mock('@/components/layout/Header', () => ({
  Header: () => <div data-testid="header">Header</div>,
}));

vi.mock('@/components/layout/Sidebar', () => ({
  Sidebar: () => <div data-testid="sidebar">Sidebar</div>,
}));

describe('ProjectLayout', () => {
  it('レイアウトにHeaderコンポーネントが含まれている', async () => {
    const mockParams = Promise.resolve({ id: 'test-project-id' });
    const { getByTestId } = render(
      await ProjectLayout({
        children: <div data-testid="test-content">テストコンテンツ</div>,
        params: mockParams,
      })
    );

    expect(getByTestId('header')).toBeInTheDocument();
  });

  it('レイアウトにSidebarコンポーネントが含まれている', async () => {
    const mockParams = Promise.resolve({ id: 'test-project-id' });
    const { getByTestId } = render(
      await ProjectLayout({
        children: <div data-testid="test-content">テストコンテンツ</div>,
        params: mockParams,
      })
    );

    expect(getByTestId('sidebar')).toBeInTheDocument();
  });

  it('子要素が正しくレンダリングされる', async () => {
    const mockParams = Promise.resolve({ id: 'test-project-id' });
    const { getByTestId } = render(
      await ProjectLayout({
        children: <div data-testid="test-content">テストコンテンツ</div>,
        params: mockParams,
      })
    );

    expect(getByTestId('test-content')).toBeInTheDocument();
  });

  it('正しいレイアウト構造を持つ', async () => {
    const mockParams = Promise.resolve({ id: 'test-project-id' });
    const { container, getByTestId } = render(
      await ProjectLayout({
        children: <div data-testid="test-content">テストコンテンツ</div>,
        params: mockParams,
      })
    );

    // サイドバーとメインコンテンツエリアが存在することを確認
    const sidebar = getByTestId('sidebar');
    const header = getByTestId('header');
    const content = getByTestId('test-content');

    expect(sidebar).toBeInTheDocument();
    expect(header).toBeInTheDocument();
    expect(content).toBeInTheDocument();

    // レイアウトのルート要素がflexコンテナであることを確認
    const layoutRoot = container.firstChild as HTMLElement;
    expect(layoutRoot).toHaveClass('flex');
    expect(layoutRoot).toHaveClass('h-screen');
  });
});
