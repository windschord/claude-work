/**
 * アクション要求検出モジュール
 * Task 43.17: ANSIエスケープ除去とアクション要求パターン検出
 *
 * Claudeがユーザーのアクション（確認、許可など）を求めているかを検出します。
 */

/**
 * ANSIエスケープシーケンスを除去する正規表現
 * - \u001b[...m: 色やスタイル
 * - \u001b[...H: カーソル移動
 * - \u001b[...J: 画面クリア
 * - その他のCSIシーケンス
 */
const ANSI_REGEX = /\u001b\[[0-9;]*[a-zA-Z]/g;

/**
 * ANSIエスケープシーケンスをテキストから除去
 *
 * @param text - ANSIエスケープを含む可能性のあるテキスト
 * @returns ANSIエスケープを除去したプレーンテキスト
 *
 * @example
 * stripAnsi('\u001b[32mGreen Text\u001b[0m'); // => 'Green Text'
 */
export function stripAnsi(text: string): string {
  return text.replace(ANSI_REGEX, '');
}

/**
 * アクション要求を検出するパターン
 * 大文字小文字を区別しない
 */
const ACTION_PATTERNS = [
  /\[?allow\]?\s*[/|]\s*\[?deny\]?/i, // [Allow] / [Deny]
  /do you want to/i,                   // Do you want to...
  /\(y\/n\)/i,                         // (y/n)
  /\[yes\/no\]/i,                      // [yes/no]
  /yes\/no/i,                          // yes/no
  /press any key/i,                    // Press any key
  /\[y\/n\]/i,                         // [y/n]
  /continue\?\s*\(y\/n\)/i,            // Continue? (y/n)
  /proceed\?\s*\(y\/n\)/i,             // Proceed? (y/n)
  /are you sure\?/i,                   // Are you sure?
];

/**
 * テキストがアクション要求を含むかどうかを検出
 *
 * @param text - 検査するテキスト（ANSIエスケープを含んでいてもOK）
 * @returns アクション要求パターンが見つかった場合はtrue
 *
 * @example
 * detectActionRequest('Do you want to proceed?'); // => true
 * detectActionRequest('Processing files...'); // => false
 */
export function detectActionRequest(text: string): boolean {
  if (!text) return false;

  // ANSIエスケープを除去してから検査
  const plainText = stripAnsi(text);

  return ACTION_PATTERNS.some((pattern) => pattern.test(plainText));
}

/**
 * クールダウン付き通知チェッカーを作成
 *
 * 指定した期間内に複数回呼び出された場合、
 * 最初の呼び出し以外はfalseを返す。
 *
 * @param cooldownMs - クールダウン期間（ミリ秒）
 * @returns 通知すべきかどうかを返す関数
 *
 * @example
 * const shouldNotify = createCooldownChecker(5000);
 * shouldNotify(); // => true
 * shouldNotify(); // => false (5秒以内)
 * // 5秒後...
 * shouldNotify(); // => true
 */
export function createCooldownChecker(cooldownMs: number): () => boolean {
  let lastNotificationTime = 0;

  return () => {
    const now = Date.now();
    if (now - lastNotificationTime > cooldownMs) {
      lastNotificationTime = now;
      return true;
    }
    return false;
  };
}
