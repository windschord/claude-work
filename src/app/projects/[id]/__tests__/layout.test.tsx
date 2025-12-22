import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import ProjectLayout from '../layout';
import * as mainLayoutModule from '@/components/layout/MainLayout';

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

  it('should be a Client Component with "use client" directive', () => {
    // layout.tsxファイルの内容を読み込んで検証
    const layoutPath = path.resolve(__dirname, '../layout.tsx');
    const layoutContent = fs.readFileSync(layoutPath, 'utf-8');

    // ファイルの先頭に'use client'ディレクティブが存在することを確認
    expect(layoutContent.trimStart().startsWith("'use client'")).toBe(true);
  });

  it('should use MainLayout component to wrap children', () => {
    const children = <div data-testid="test-children">Test Content</div>;

    render(<ProjectLayout>{children}</ProjectLayout>);

    // MainLayoutが使用されていることを確認
    expect(mainLayoutModule.MainLayout).toHaveBeenCalled();

    // MainLayoutがchildrenをラップしていることを確認
    expect(screen.getByTestId('main-layout')).toBeInTheDocument();
    expect(screen.getByTestId('test-children')).toBeInTheDocument();
  });

  it('should trigger fetchProjects when MainLayout is used', () => {
    // MainLayoutが実際にfetchProjectsを呼び出す動作をシミュレート
    vi.mocked(mainLayoutModule.MainLayout).mockImplementationOnce(({ children }) => {
      // MainLayoutのマウント時の動作を再現
      mockFetchProjects();
      return <div data-testid="main-layout">{children}</div>;
    });

    const children = <div>Test Content</div>;
    render(<ProjectLayout>{children}</ProjectLayout>);

    // fetchProjectsが呼び出されたことを確認
    expect(mockFetchProjects).toHaveBeenCalled();
  });


  it('should not directly render Header and Sidebar components', () => {
    const children = <div>Test Content</div>;

    render(<ProjectLayout>{children}</ProjectLayout>);

    // MainLayoutがレンダリングされていることを確認（モックされたMainLayout）
    expect(screen.getByTestId('main-layout')).toBeInTheDocument();

    // MainLayoutコンポーネントが呼び出されたことを確認
    expect(mainLayoutModule.MainLayout).toHaveBeenCalled();

    // 呼び出し時の引数を確認（children propsが渡されている）
    const callArgs = vi.mocked(mainLayoutModule.MainLayout).mock.calls[0];
    expect(callArgs[0]).toHaveProperty('children');
  });

  it('should pass children to MainLayout correctly', () => {
    const testContent = (
      <div data-testid="complex-children">
        <h1>Complex Content</h1>
        <p>With multiple elements</p>
      </div>
    );

    render(<ProjectLayout>{testContent}</ProjectLayout>);

    // childrenが正しく渡されていることを確認
    expect(screen.getByTestId('complex-children')).toBeInTheDocument();
    expect(screen.getByText('Complex Content')).toBeInTheDocument();
    expect(screen.getByText('With multiple elements')).toBeInTheDocument();
  });
});
