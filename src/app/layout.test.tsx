import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import RootLayout from './layout';

// next/font/googleをモック
vi.mock('next/font/google', () => ({
  Inter: () => ({
    className: '__className_aaf875',
  }),
}));

// next-themesをモック
vi.mock('next-themes', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="theme-provider">{children}</div>
  ),
}));

// react-hot-toastをモック（propsを検査可能にする）
const { MockToaster } = vi.hoisted(() => ({
  MockToaster: vi.fn((props: Record<string, unknown>) => (
    <div data-testid="toaster" data-position={props.position}>Toaster</div>
  )),
}));
vi.mock('react-hot-toast', () => ({
  Toaster: (props: Record<string, unknown>) => MockToaster(props),
}));

describe('RootLayout', () => {
  beforeEach(() => {
    MockToaster.mockClear();
  });

  it('Toasterコンポーネントが配置されている', () => {
    const { getByTestId } = render(
      <RootLayout>
        <div data-testid="test-content">テストコンテンツ</div>
      </RootLayout>
    );

    // Toasterが存在することを確認
    expect(getByTestId('toaster')).toBeInTheDocument();
  });

  it('ToasterがProvidersの外側（childrenの後）に配置されている', () => {
    const { getByTestId } = render(
      <RootLayout>
        <div data-testid="test-content">テストコンテンツ</div>
      </RootLayout>
    );

    // ThemeProviderとToasterが両方存在することを確認
    const themeProvider = getByTestId('theme-provider');
    const toaster = getByTestId('toaster');

    expect(themeProvider).toBeInTheDocument();
    expect(toaster).toBeInTheDocument();

    // DOM上でThemeProviderの後にToasterが配置されていることを確認
    const parentElement = themeProvider.parentElement;
    if (parentElement) {
      const bodyChildren = Array.from(parentElement.children);
      const themeProviderIndex = bodyChildren.indexOf(themeProvider);
      const toasterIndex = bodyChildren.indexOf(toaster);

      expect(toasterIndex).toBeGreaterThan(themeProviderIndex);
    }
  });

  it('Toasterにposition="top-right"が設定されている', () => {
    render(
      <RootLayout>
        <div>テスト</div>
      </RootLayout>
    );

    expect(MockToaster).toHaveBeenCalledWith(
      expect.objectContaining({ position: 'top-right' })
    );
  });

  it('子要素が正しくレンダリングされる', () => {
    const { getByTestId } = render(
      <RootLayout>
        <div data-testid="test-content">テストコンテンツ</div>
      </RootLayout>
    );

    expect(getByTestId('test-content')).toBeInTheDocument();
  });
});
