import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CodeBlock } from '../CodeBlock';

// navigator.clipboard.writeText のモック
const mockWriteText = jest.fn();
Object.assign(navigator, {
  clipboard: {
    writeText: mockWriteText,
  },
});

describe('CodeBlock', () => {
  beforeEach(() => {
    mockWriteText.mockClear();
  });

  it('コードブロックが正しくレンダリングされる', () => {
    const code = 'const x = 10;\nconsole.log(x);';
    render(<CodeBlock language="javascript">{code}</CodeBlock>);

    expect(screen.getByText(/const x = 10/)).toBeInTheDocument();
    expect(screen.getByText(/console.log\(x\)/)).toBeInTheDocument();
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
    expect(screen.getByText('plain text')).toBeInTheDocument();
  });

  it('TypeScriptコードのシンタックスハイライト', () => {
    const code = 'interface User {\n  name: string;\n}';
    const { container } = render(<CodeBlock language="typescript">{code}</CodeBlock>);

    const codeElement = container.querySelector('code');
    expect(codeElement).toBeInTheDocument();
    expect(screen.getByText(/interface User/)).toBeInTheDocument();
  });

  it('Bashコードのシンタックスハイライト', () => {
    const code = 'npm install react';
    const { container } = render(<CodeBlock language="bash">{code}</CodeBlock>);

    const codeElement = container.querySelector('code');
    expect(codeElement).toBeInTheDocument();
    expect(screen.getByText(/npm install react/)).toBeInTheDocument();
  });
});
