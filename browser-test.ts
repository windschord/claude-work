import { chromium, Browser, Page } from 'playwright';

/**
 * テーマ切り替え機能のE2Eテスト（ログインページで実行）
 */
async function testThemeToggle(page: Page): Promise<void> {
  console.log('テーマ切り替え機能のテスト開始...');

  // コンソールログとエラーの収集
  const consoleLogs: string[] = [];
  const consoleErrors: string[] = [];

  page.on('console', (msg) => {
    const text = msg.text();
    const location = msg.location();
    const logEntry = location.url ? `[${msg.type()}] ${text} (${location.url})` : `[${msg.type()}] ${text}`;
    consoleLogs.push(logEntry);
    if (msg.type() === 'error' || msg.type() === 'warning') {
      consoleErrors.push(logEntry);
    }
  });

  // リソースの読み込み失敗を監視
  page.on('response', async (response) => {
    if (response.status() >= 400) {
      consoleLogs.push(`[HTTP ${response.status()}] ${response.url()}`);
      consoleErrors.push(`HTTP ${response.status()}: ${response.url()}`);
    }
  });

  page.on('pageerror', (error) => {
    consoleErrors.push(`PageError: ${error.message}`);
  });

  // ログインページに移動
  await page.goto('http://localhost:3000/login');
  await page.waitForLoadState('networkidle');

  // テーマ切り替えボタンを探す
  const themeToggle = page.getByLabel('Toggle theme');
  await themeToggle.waitFor({ state: 'visible', timeout: 5000 });
  console.log('✓ テーマ切り替えボタンが表示されています');

  // スクリーンショット保存用ディレクトリ作成
  await page.evaluate(() => {
    const dir = '/Users/tsk/Sync/git/claude-work/test-screenshots';
    return dir;
  });

  // 初期状態のHTMLクラスを取得
  const initialClass = await page.evaluate(() => document.documentElement.className);
  console.log(`初期状態のHTMLクラス: "${initialClass}"`);

  // 初期テーマのスクリーンショット
  await page.screenshot({ path: 'test-screenshots/theme-initial.png', fullPage: true });

  // ローカルストレージの初期状態を確認
  const initialTheme = await page.evaluate(() => localStorage.getItem('theme'));
  console.log(`ローカルストレージの初期テーマ: ${initialTheme}`);

  // テーマ切り替えボタンをクリック（1回目）
  await themeToggle.click();
  await page.waitForTimeout(500); // テーマ切り替えのアニメーション待機

  // 1回目クリック後のHTMLクラスを取得
  const afterFirstClick = await page.evaluate(() => document.documentElement.className);
  console.log(`1回目クリック後のHTMLクラス: "${afterFirstClick}"`);

  // スクリーンショット
  await page.screenshot({ path: 'test-screenshots/theme-after-first-click.png', fullPage: true });

  // ローカルストレージのテーマを確認
  const themeAfterFirstClick = await page.evaluate(() => localStorage.getItem('theme'));
  console.log(`1回目クリック後のローカルストレージテーマ: ${themeAfterFirstClick}`);

  // テーマ切り替えボタンをクリック（2回目）
  await themeToggle.click();
  await page.waitForTimeout(500);

  // 2回目クリック後のHTMLクラスを取得
  const afterSecondClick = await page.evaluate(() => document.documentElement.className);
  console.log(`2回目クリック後のHTMLクラス: "${afterSecondClick}"`);

  // スクリーンショット
  await page.screenshot({ path: 'test-screenshots/theme-after-second-click.png', fullPage: true });

  // ローカルストレージのテーマを確認
  const themeAfterSecondClick = await page.evaluate(() => localStorage.getItem('theme'));
  console.log(`2回目クリック後のローカルストレージテーマ: ${themeAfterSecondClick}`);

  // テーマ切り替えボタンをクリック（3回目 - 元に戻る）
  await themeToggle.click();
  await page.waitForTimeout(500);

  // 3回目クリック後のHTMLクラスを取得
  const afterThirdClick = await page.evaluate(() => document.documentElement.className);
  console.log(`3回目クリック後のHTMLクラス: "${afterThirdClick}"`);

  // スクリーンショット
  await page.screenshot({ path: 'test-screenshots/theme-after-third-click.png', fullPage: true });

  // ローカルストレージのテーマを確認
  const themeAfterThirdClick = await page.evaluate(() => localStorage.getItem('theme'));
  console.log(`3回目クリック後のローカルストレージテーマ: ${themeAfterThirdClick}`);

  // コンソールログを表示（デバッグ用）
  if (consoleLogs.length > 0) {
    console.log('\nブラウザコンソールログ:');
    consoleLogs.slice(0, 20).forEach(log => console.log(`  ${log}`));
    if (consoleLogs.length > 20) {
      console.log(`  ... and ${consoleLogs.length - 20} more logs`);
    }
  }

  // エラーのチェック
  if (consoleErrors.length > 0) {
    console.log('\n❌ JavaScriptエラーが発生しました:');
    consoleErrors.forEach(err => console.log(`  - ${err}`));
  } else {
    console.log('\n✓ JavaScriptエラーは発生していません');
  }

  // テーマ切り替えが正しく動作しているか検証
  console.log('\n検証結果:');

  // HTMLクラスが変更されているか確認
  if (initialClass === afterFirstClick && afterFirstClick === afterSecondClick && afterSecondClick === afterThirdClick) {
    console.log('❌ HTMLクラスが変更されていません - テーマ切り替えが動作していない可能性があります');
  } else {
    console.log('✓ HTMLクラスが変更されています - テーマ切り替えが動作しています');
  }

  // ローカルストレージが変更されているか確認
  if (initialTheme === themeAfterFirstClick && themeAfterFirstClick === themeAfterSecondClick && themeAfterSecondClick === themeAfterThirdClick) {
    console.log('❌ ローカルストレージのテーマが変更されていません');
  } else {
    console.log('✓ ローカルストレージのテーマが変更されています');
  }

  console.log('\nテーマ切り替え機能のテスト完了');
}

/**
 * メイン実行関数
 */
async function main() {
  let browser: Browser | null = null;

  try {
    console.log('ブラウザテスト開始...\n');

    // ブラウザ起動（デバッグモード: headless: false）
    const headless = process.env.HEADLESS === 'false' ? false : true;
    browser = await chromium.launch({
      headless,
      slowMo: headless ? 0 : 500, // ヘッド付きモードの場合はスローモーション
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      // キャッシュを無効化
      ignoreHTTPSErrors: true,
    });

    const page = await context.newPage();

    // キャッシュをクリア
    await context.clearCookies();
    await page.goto('about:blank');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // テーマ切り替え機能のテスト
    await testThemeToggle(page);

    console.log('\n✓ すべてのテストが完了しました');

  } catch (error) {
    console.error('❌ テスト実行中にエラーが発生しました:', error);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

main();
