/**
 * アクション要求検出モジュール
 * Task 43.17: ANSIエスケープ除去とアクション要求パターン検出
 *
 * Claudeがユーザーのアクション（確認、許可など）を求めているかを検出します。
 */

/**
 * ANSIエスケープシーケンスを除去する正規表現
 * - CSI: \u001b[...m (色やスタイル), \u001b[...H (カーソル移動), etc.
 * - OSC: \u001b]...\u0007 (ウィンドウタイトルなど)
 * - DCS: \u001bP...\u001b\\ (デバイス制御)
 * - その他の制御シーケンス
 */
const ANSI_PATTERNS = [
  /\u001b\[[0-9;]*[a-zA-Z]/g,           // CSI sequences (most common)
  /\u001b\].*?(?:\u0007|\u001b\\)/g,    // OSC sequences (window title, etc.)
  /\u001bP.*?\u001b\\/g,                // DCS sequences
  /\u001b[NOc_^][^\u001b]*/g,           // SS2, SS3, and other sequences
];

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
  let result = text;
  for (const pattern of ANSI_PATTERNS) {
    result = result.replace(pattern, '');
  }
  return result;
}

/**
 * 最小テキスト長
 * 短すぎる出力は偽陽性の可能性が高いため無視
 */
const MIN_TEXT_LENGTH = 10;

/**
 * アクション要求を検出するパターン
 * 大文字小文字を区別しない
 */
const ACTION_PATTERNS = [
  /\[?allow\]?\s*[/|]\s*\[?deny\]?/i, // [Allow] / [Deny], Allow|Deny
  /do you want to/i,                   // Do you want to...
  /\(y\/n\)/i,                         // (y/n)
  /\[yes\/no\]/i,                      // [yes/no]
  /yes\/no/i,                          // yes/no
  /press any key/i,                    // Press any key
  /\[y\/n\]/i,                         // [y/n]
  /continue\?\s*\(y\/n\)/i,            // Continue? (y/n)
  /proceed\?\s*\(y\/n\)/i,             // Proceed? (y/n)
  /are you sure\?/i,                   // Are you sure?
  /yes to confirm/i,                   // Yes to confirm
  /confirm with yes/i,                 // Confirm with yes
  /type yes to/i,                      // Type yes to...
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

  // 短すぎる出力は偽陽性の可能性が高いため無視
  if (plainText.length < MIN_TEXT_LENGTH) return false;

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
