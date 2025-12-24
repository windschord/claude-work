import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { vi } from 'vitest';
import { CodeBlock } from '../CodeBlock';

// navigator.clipboard.writeText のモック
const mockWriteText = vi.fn();
Object.assign(navigator, {
  clipboard: {
    writeText: mockWriteText,
  },
});

describe('CodeBlock', () => {
  beforeEach(() => {
    mockWriteText.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('コードブロックが正しくレンダリングされる', () => {
    const code = 'const x = 10;\nconsole.log(x);';
    const { container } = render(<CodeBlock language="javascript">{code}</CodeBlock>);

    // シンタックスハイライトにより複数の要素に分割されるため、containerで確認
    const codeElement = container.querySelector('code');
    expect(codeElement).toBeInTheDocument();
    expect(codeElement).toHaveTextContent('const x = 10;');
    expect(codeElement).toHaveTextContent('console.log(x);');
  });

  it('言語指定でシンタックスハイライトが適用される', () => {
    const code = 'def hello():\n    print("Hello")';
    const { container } = render(<CodeBlock language="python">{code}</CodeBlock>);

    // SyntaxHighlighterが使用されていることを確認
    const codeElement = container.querySelector('code');
    expect(codeElement).toBeInTheDocument();
  });

  it('コピーボタンが表示される', () => {
    const code = 'const x = 10;';
    render(<CodeBlock language="javascript">{code}</CodeBlock>);

    const copyButton = screen.getByRole('button', { name: /copy/i });
    expect(copyButton).toBeInTheDocument();
  });

  it('コピーボタンをクリックするとコードがクリップボードにコピーされる', async () => {
    mockWriteText.mockResolvedValue(undefined);
    const code = 'const x = 10;';
    render(<CodeBlock language="javascript">{code}</CodeBlock>);

    const copyButton = screen.getByRole('button', { name: /copy/i });
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith(code);
    });
  });

  it('コピー後にボタンのテキストが"Copied!"に変わる', async () => {
    mockWriteText.mockResolvedValue(undefined);
    const code = 'const x = 10;';
    render(<CodeBlock language="javascript">{code}</CodeBlock>);

    const copyButton = screen.getByRole('button', { name: /copy/i });
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });

    // 2秒後に元に戻ることを確認
    await waitFor(
      () => {
        expect(screen.getByText('Copy')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it('言語が指定されていない場合はtextとして扱われる', () => {
    const code = 'plain text';
    const { container } = render(<CodeBlock language="">{code}</CodeBlock>);

    const codeElement = container.querySelector('code');
    expect(codeElement).toBeInTheDocument();
    expect(codeElement).toHaveTextContent('plain text');
  });

  it('TypeScriptコードのシンタックスハイライト', () => {
    const code = 'interface User {\n  name: string;\n}';
    const { container } = render(<CodeBlock language="typescript">{code}</CodeBlock>);

    const codeElement = container.querySelector('code');
    expect(codeElement).toBeInTheDocument();
    expect(codeElement).toHaveTextContent('interface User');
    expect(codeElement).toHaveTextContent('name: string;');
  });

  it('Bashコードのシンタックスハイライト', () => {
    const code = 'npm install react';
    const { container } = render(<CodeBlock language="bash">{code}</CodeBlock>);

    const codeElement = container.querySelector('code');
    expect(codeElement).toBeInTheDocument();
    expect(codeElement).toHaveTextContent('npm install react');
  });
});
