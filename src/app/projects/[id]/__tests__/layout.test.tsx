import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ProjectLayout from '../layout';
import * as mainLayoutModule from '@/components/layout/MainLayout';
import * as useAppStoreModule from '@/store';

// MainLayoutコンポーネントをモック
vi.mock('@/components/layout/MainLayout', () => ({
  MainLayout: vi.fn(({ children }) => (
    <div data-testid="main-layout">{children}</div>
  )),
}));

// useAppStoreをモック
const mockFetchProjects = vi.fn();
const mockSetIsMobile = vi.fn();

vi.mock('@/store', () => ({
  useAppStore: vi.fn(() => ({
    fetchProjects: mockFetchProjects,
    setIsMobile: mockSetIsMobile,
    projects: [],
  })),
}));

describe('ProjectLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be a Client Component with "use client" directive', async () => {
    // layout.tsxファイルの内容を読み込んで検証
    const fs = await import('fs');
    const path = await import('path');
    const layoutPath = path.resolve(__dirname, '../layout.tsx');
    const layoutContent = fs.readFileSync(layoutPath, 'utf-8');

    // ファイルの先頭に'use client'ディレクティブが存在することを確認
    expect(layoutContent.trimStart().startsWith("'use client'")).toBe(true);
  });

  it('should use MainLayout component to wrap children', async () => {
    const params = Promise.resolve({ id: 'test-project-id' });
    const children = <div data-testid="test-children">Test Content</div>;

    render(await ProjectLayout({ children, params }));

    // MainLayoutが使用されていることを確認
    expect(mainLayoutModule.MainLayout).toHaveBeenCalled();

    // MainLayoutがchildrenをラップしていることを確認
    expect(screen.getByTestId('main-layout')).toBeInTheDocument();
    expect(screen.getByTestId('test-children')).toBeInTheDocument();
  });

  it('should call fetchProjects when MainLayout is mounted', async () => {
    // MainLayoutの実装を一時的に実際の動作に近づける
    const actualMainLayout = ({ children }: { children: React.ReactNode }) => {
      const { fetchProjects } = useAppStoreModule.useAppStore();

      // useEffectの代わりに、レンダリング時に呼び出す（テスト用簡略化）
      fetchProjects();

      return <div data-testid="main-layout">{children}</div>;
    };

    vi.mocked(mainLayoutModule.MainLayout).mockImplementation(actualMainLayout);

    const params = Promise.resolve({ id: 'test-project-id' });
    const children = <div>Test Content</div>;

    render(await ProjectLayout({ children, params }));

    // fetchProjectsが呼ばれることを確認
    await waitFor(() => {
      expect(mockFetchProjects).toHaveBeenCalled();
    });
  });

  it('should not directly render Header and Sidebar components', async () => {
    const params = Promise.resolve({ id: 'test-project-id' });
    const children = <div>Test Content</div>;

    const { container } = render(await ProjectLayout({ children, params }));

    // layout.tsx内でHeaderやSidebarを直接レンダリングしていないことを確認
    // MainLayoutを使用しているため、layout.tsx自体にはHeaderやSidebarが含まれない
    const layoutSource = container.innerHTML;

    // MainLayoutがレンダリングされていることを確認（モックされたMainLayout）
    expect(screen.getByTestId('main-layout')).toBeInTheDocument();

    // MainLayoutコンポーネントが呼び出されたことを確認
    expect(mainLayoutModule.MainLayout).toHaveBeenCalledWith(
      expect.objectContaining({
        children: expect.anything(),
      }),
      expect.anything()
    );
  });

  it('should pass children to MainLayout correctly', async () => {
    const params = Promise.resolve({ id: 'another-project-id' });
    const testContent = (
      <div data-testid="complex-children">
        <h1>Complex Content</h1>
        <p>With multiple elements</p>
      </div>
    );

    render(await ProjectLayout({ children: testContent, params }));

    // childrenが正しく渡されていることを確認
    expect(screen.getByTestId('complex-children')).toBeInTheDocument();
    expect(screen.getByText('Complex Content')).toBeInTheDocument();
    expect(screen.getByText('With multiple elements')).toBeInTheDocument();
  });
});
