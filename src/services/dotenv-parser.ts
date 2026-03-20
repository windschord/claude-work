export interface DotenvParseResult {
  variables: { [key: string]: string };
  errors: string[];
}

export function parseDotenv(content: string): DotenvParseResult {
  const variables: { [key: string]: string } = {};
  const errors: string[] = [];

  const lines = content.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // 空行をスキップ
    if (trimmedLine === '') {
      continue;
    }

    // コメント行をスキップ
    if (trimmedLine.startsWith('#')) {
      continue;
    }

    // export プレフィックスを除去
    let processedLine = trimmedLine;
    if (processedLine.startsWith('export ')) {
      processedLine = processedLine.substring(7);
    }

    // 最初の = でkeyとvalueに分割
    const eqIndex = processedLine.indexOf('=');
    if (eqIndex === -1) {
      errors.push(`Line ${i + 1}: '=' が見つかりません: ${trimmedLine}`);
      continue;
    }

    const key = processedLine.substring(0, eqIndex).trim();
    if (key === '') {
      errors.push(`Line ${i + 1}: キーが空です: ${trimmedLine}`);
      continue;
    }

    let value = processedLine.substring(eqIndex + 1).trim();

    // クォート処理
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      // クォートを除去
      value = value.slice(1, -1);
    } else {
      // クォートなしの場合はインラインコメントを除去
      const commentIndex = value.indexOf(' #');
      if (commentIndex !== -1) {
        value = value.substring(0, commentIndex).trim();
      }
    }

    variables[key] = value;
  }

  return { variables, errors };
}
