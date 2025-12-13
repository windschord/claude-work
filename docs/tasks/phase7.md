## フェーズ7: UI/UX改善とドキュメント
*推定期間: 85分（AIエージェント作業時間）*
*MVP: No*

### タスク7.1: ライト/ダークモード実装

**説明**:
テーマ切り替え機能を実装する。ユーザーの好みやOSテーマに応じて、ライトモードとダークモードを切り替えられるようにする。
- OSテーマ自動検出（prefers-color-scheme）
- 手動切り替えボタン
- ローカルストレージ保存（設定永続化）
- Tailwind CSS darkモード対応

**技術的文脈**:
- Next.js 14 App Router
- Tailwind CSS 3.x darkモード（class戦略）
- next-themes 0.x（テーマ管理）
- ローカルストレージでテーマ保存
- Zustand 4.xでテーマ状態管理（オプション）

**必要なパッケージ**:
```bash
npm install next-themes
```

**実装ファイル**:
- `tailwind.config.ts` - 既存拡張（darkMode設定）
- `src/app/providers.tsx` - ThemeProviderラップ
- `src/app/layout.tsx` - 既存拡張（Providersでラップ）
- `src/components/common/ThemeToggle.tsx` - テーマ切り替えボタンコンポーネント
- `src/components/layout/Header.tsx` - 既存拡張（ThemeToggle追加）
- `src/components/common/__tests__/ThemeToggle.test.tsx` - コンポーネントテスト

**実装手順（TDD）**:
1. **テスト作成フェーズ**:
   - `src/components/common/__tests__/ThemeToggle.test.tsx`作成
     - テーマトグルボタンが表示される
     - クリックでテーマが切り替わる（light ⇔ dark）
     - 現在のテーマアイコンが表示される（太陽/月）
   - テスト実行: `npm test` → すべて失敗することを確認
   - コミット: "Add theme toggle tests"

2. **実装フェーズ**:
   - `tailwind.config.ts`拡張
     ```typescript
     import type { Config } from 'tailwindcss';

     const config: Config = {
       darkMode: 'class', // クラス戦略を使用
       content: [
         './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
         './src/components/**/*.{js,ts,jsx,tsx,mdx}',
         './src/app/**/*.{js,ts,jsx,tsx,mdx}',
       ],
       theme: {
         extend: {
           // 既存のテーマ拡張設定
         },
       },
       plugins: [],
     };
     export default config;
     ```
   - `src/app/providers.tsx`作成
     ```typescript
     'use client';

     import { ThemeProvider } from 'next-themes';
     import { ReactNode } from 'react';

     export function Providers({ children }: { children: ReactNode }) {
       return (
         <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
           {children}
         </ThemeProvider>
       );
     }
     ```
   - `src/app/layout.tsx`拡張
     ```typescript
     import { Providers } from './providers';

     export default function RootLayout({
       children,
     }: {
       children: React.ReactNode;
     }) {
       return (
         <html lang="ja" suppressHydrationWarning>
           <body>
             <Providers>{children}</Providers>
           </body>
         </html>
       );
     }
     ```
   - `src/components/common/ThemeToggle.tsx`作成
     ```typescript
     'use client';

     import { useTheme } from 'next-themes';
     import { useEffect, useState } from 'react';
     import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';

     export function ThemeToggle() {
       const [mounted, setMounted] = useState(false);
       const { theme, setTheme } = useTheme();

       useEffect(() => {
         setMounted(true);
       }, []);

       if (!mounted) {
         return (
           <button
             className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
             aria-label="Toggle theme"
           >
             <div className="w-5 h-5" />
           </button>
         );
       }

       return (
         <button
           onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
           className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
           aria-label="Toggle theme"
         >
           {theme === 'dark' ? (
             <SunIcon className="w-5 h-5 text-yellow-500" />
           ) : (
             <MoonIcon className="w-5 h-5 text-gray-700" />
           )}
         </button>
       );
     }
     ```
   - `src/components/layout/Header.tsx`拡張
     - ヘッダー右側に`ThemeToggle`追加
   - 既存コンポーネントにdarkモードスタイル追加
     - 例: `bg-white dark:bg-gray-900`
     - 例: `text-gray-900 dark:text-gray-100`
     - 例: `border-gray-200 dark:border-gray-700`
   - テスト実行: `npm test` → すべて通過することを確認
   - コミット: "Implement light/dark theme toggle with next-themes"

**UI仕様**:

**ThemeToggle**:
- ボタン: 円形背景、ホバーでグレー背景
- ライトモード時: 月アイコン（MoonIcon）、グレー色
- ダークモード時: 太陽アイコン（SunIcon）、黄色
- アニメーション: `transition-colors`でスムーズ切り替え
- 配置: ヘッダー右側、ログアウトボタンの隣

**ダークモードカラーパレット**:
- 背景: `bg-gray-900`（主背景）、`bg-gray-800`（カード背景）
- テキスト: `text-gray-100`（主テキスト）、`text-gray-400`（副テキスト）
- ボーダー: `border-gray-700`
- ホバー: `hover:bg-gray-800`
- プライマリカラー: `bg-blue-600`（ライトモード: `bg-blue-500`）

**適用コンポーネント**:
- すべてのコンポーネントにdarkモードスタイル追加
- 特に重要なコンポーネント:
  - Header: `bg-white dark:bg-gray-900 border-b dark:border-gray-700`
  - ProjectCard: `bg-white dark:bg-gray-800 border dark:border-gray-700`
  - SessionCard: `bg-white dark:bg-gray-800 border dark:border-gray-700`
  - ChatOutput: `bg-gray-50 dark:bg-gray-900`
  - DiffViewer: react-diff-viewer-continuedのダークテーマ使用
  - Terminal: 既にダークテーマ（変更不要）

**エラーハンドリング**:
- 特になし（テーマ切り替えはクライアントサイドで完結）

**受入基準**:
- [ ] `tailwind.config.ts`に`darkMode: 'class'`が設定されている
- [ ] `src/app/providers.tsx`が存在し、`ThemeProvider`でラップされている
- [ ] `src/app/layout.tsx`で`Providers`が使用されている
- [ ] `src/components/common/ThemeToggle.tsx`が存在する
- [ ] ヘッダーにテーマトグルボタンが表示される
- [ ] OSテーマに従って初期表示される
- [ ] 手動で切り替えられる
- [ ] 設定がローカルストレージに保存される
- [ ] ページリロード後も設定が保持される
- [ ] 全コンポーネントがダークモードに対応している
- [ ] テストファイルが存在する
- [ ] 全テストが通過する（`npm test`）
- [ ] ESLintエラーがゼロである（`npm run lint`）
- [ ] テストのみのコミットと実装のコミットが分かれている

**依存関係**:
- フェーズ6完了
- タスク3.2（レイアウトとナビゲーション実装）完了

**推定工数**: 25分（AIエージェント作業時間）
- テスト作成・コミット: 7分
- 実装・テスト通過・コミット: 18分

---

### タスク7.2: モバイルUI最適化

**説明**:
モバイル向けUIを最適化する。小さい画面でも使いやすいように、レスポンシブデザインを実装する。
- カード形式セッション一覧（モバイル）
- タッチ操作最適化（タップ領域拡大）
- 入力フォーム調整（モバイルキーボード対応）
- ハンバーガーメニュー（ナビゲーション）

**技術的文脈**:
- Tailwind CSS レスポンシブデザイン（sm:, md:, lg: ブレークポイント）
- ブレークポイント: 768px（タブレット）、1024px（デスクトップ）
- Headless UI `Menu`でハンバーガーメニュー
- モバイルファーストアプローチ

**必要なパッケージ**:
```bash
# Headless UIは既にタスク3.3でインストール済み
# 追加パッケージなし
```

**実装ファイル**:
- `src/components/layout/Header.tsx` - 既存拡張（ハンバーガーメニュー追加）
- `src/components/layout/MobileMenu.tsx` - モバイルメニューコンポーネント
- `src/components/sessions/SessionList.tsx` - 既存拡張（モバイルレイアウト）
- `src/components/sessions/SessionCard.tsx` - 既存拡張（モバイルレイアウト）
- `src/components/sessions/ChatOutput.tsx` - 既存拡張（モバイルレイアウト）
- `src/components/layout/__tests__/MobileMenu.test.tsx` - コンポーネントテスト

**実装手順（TDD）**:
1. **テスト作成フェーズ**:
   - `src/components/layout/__tests__/MobileMenu.test.tsx`作成
     - 768px未満でハンバーガーアイコンが表示される
     - ハンバーガークリックでメニューが開く
     - メニュー内にナビゲーションリンクが表示される
   - テスト実行: `npm test` → すべて失敗することを確認
   - コミット: "Add mobile UI optimization tests"

2. **実装フェーズ**:
   - `src/components/layout/MobileMenu.tsx`作成
     ```typescript
     'use client';

     import { Menu, Transition } from '@headlessui/react';
     import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
     import { Fragment } from 'react';
     import Link from 'next/link';

     interface MobileMenuProps {
       items: Array<{ label: string; href: string }>;
     }

     export function MobileMenu({ items }: MobileMenuProps) {
       return (
         <Menu as="div" className="relative md:hidden">
           {({ open }) => (
             <>
               <Menu.Button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                 {open ? (
                   <XMarkIcon className="w-6 h-6" />
                 ) : (
                   <Bars3Icon className="w-6 h-6" />
                 )}
               </Menu.Button>
               <Transition
                 as={Fragment}
                 enter="transition ease-out duration-100"
                 enterFrom="transform opacity-0 scale-95"
                 enterTo="transform opacity-100 scale-100"
                 leave="transition ease-in duration-75"
                 leaveFrom="transform opacity-100 scale-100"
                 leaveTo="transform opacity-0 scale-95"
               >
                 <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right rounded-md bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                   <div className="py-1">
                     {items.map((item) => (
                       <Menu.Item key={item.href}>
                         {({ active }) => (
                           <Link
                             href={item.href}
                             className={`block px-4 py-2 text-sm ${
                               active
                                 ? 'bg-gray-100 dark:bg-gray-700'
                                 : ''
                             }`}
                           >
                             {item.label}
                           </Link>
                         )}
                       </Menu.Item>
                     ))}
                   </div>
                 </Menu.Items>
               </Transition>
             </>
           )}
         </Menu>
       );
     }
     ```
   - `src/components/layout/Header.tsx`拡張
     ```typescript
     export function Header() {
       const menuItems = [
         { label: 'Projects', href: '/' },
         { label: 'Settings', href: '/settings' },
         { label: 'Logout', href: '/logout' },
       ];

       return (
         <header className="border-b dark:border-gray-700 bg-white dark:bg-gray-900">
           <div className="flex items-center justify-between px-4 py-3">
             {/* ロゴ */}
             <h1 className="text-xl font-bold">ClaudeWork</h1>

             {/* デスクトップナビゲーション */}
             <nav className="hidden md:flex items-center gap-4">
               <Link href="/">Projects</Link>
               <Link href="/settings">Settings</Link>
               <ThemeToggle />
               <button onClick={handleLogout}>Logout</button>
             </nav>

             {/* モバイルメニュー */}
             <div className="flex items-center gap-2 md:hidden">
               <ThemeToggle />
               <MobileMenu items={menuItems} />
             </div>
           </div>
         </header>
       );
     }
     ```
   - `src/components/sessions/SessionList.tsx`拡張
     ```typescript
     // モバイル: カード形式（1カラム）
     // タブレット: グリッド（2カラム）
     // デスクトップ: グリッド（3カラム）
     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
       {sessions.map((session) => (
         <SessionCard key={session.id} session={session} />
       ))}
     </div>
     ```
   - `src/components/sessions/SessionCard.tsx`拡張
     ```typescript
     // タップ領域拡大: padding増加、min-height設定
     <div className="border rounded-lg p-4 min-h-[120px] hover:shadow-md cursor-pointer active:bg-gray-50 dark:active:bg-gray-700">
       {/* ... */}
     </div>
     ```
   - `src/components/sessions/ChatOutput.tsx`拡張
     ```typescript
     // モバイル: 入力フォームを最下部固定
     <div className="flex flex-col h-full">
       <div className="flex-1 overflow-y-auto">
         {/* メッセージ履歴 */}
       </div>
       <div className="border-t p-4 bg-white dark:bg-gray-900">
         {/* 入力フォーム */}
         <textarea
           className="w-full px-4 py-3 text-base" // text-baseでモバイルズーム防止
           rows={3}
         />
       </div>
     </div>
     ```
   - すべてのフォーム入力に`text-base`または`text-[16px]`設定（iOS自動ズーム防止）
   - ボタンに`min-h-[44px]`設定（タップ領域確保）
   - テスト実行: `npm test` → すべて通過することを確認
   - コミット: "Optimize UI for mobile devices with responsive design"

**UI仕様**:

**ブレークポイント**:
- モバイル: デフォルト（〜767px）
- タブレット: `sm:`（768px〜）
- デスクトップ: `lg:`（1024px〜）

**MobileMenu**:
- ハンバーガーアイコン: 3本線（Bars3Icon）
- 閉じるアイコン: X（XMarkIcon）
- メニュー: 右上からドロップダウン、白背景（ダークモード: グレー）
- アニメーション: フェード+スケール

**SessionList（モバイル）**:
- レイアウト: 1カラム（`grid-cols-1`）
- タブレット: 2カラム（`sm:grid-cols-2`）
- デスクトップ: 3カラム（`lg:grid-cols-3`）
- Gap: 4（1rem）

**SessionCard（モバイル）**:
- Padding: 4（1rem）- 最小高さ: 120px（`min-h-[120px]`）
- タップフィードバック: `active:bg-gray-50`
- ホバー効果: デスクトップのみ（`hover:shadow-md`）

**ChatOutput（モバイル）**:
- 入力フォーム: 最下部固定（`border-t p-4`）
- テキストエリア: `text-base`（16px、iOS自動ズーム防止）
- 行数: 3行（`rows={3}`）

**タップ領域最適化**:
- すべてのボタン: 最小高さ44px（`min-h-[44px]`）
- すべてのリンク: パディング拡大（`p-4`）

**フォント最適化**:
- すべての入力フィールド: `text-base`または`text-[16px]`（iOS自動ズーム防止）

**エラーハンドリング**:
- 特になし（レスポンシブデザインはCSSで完結）

**受入基準**:
- [ ] `src/components/layout/MobileMenu.tsx`が存在する
- [ ] 768px未満でハンバーガーメニューが表示される
- [ ] 768px以上でデスクトップナビゲーションが表示される
- [ ] ハンバーガーメニューが機能する
- [ ] セッション一覧がモバイルで1カラム表示される
- [ ] タブレットで2カラム、デスクトップで3カラム表示される
- [ ] タップ領域が44px以上確保されている
- [ ] 入力フォームが最下部固定されている
- [ ] フォントサイズが16px以上でiOS自動ズームが発生しない
- [ ] タッチ操作がスムーズ
- [ ] テストファイルが存在する
- [ ] 全テストが通過する（`npm test`）
- [ ] ESLintエラーがゼロである（`npm run lint`）
- [ ] テストのみのコミットと実装のコミットが分かれている

**依存関係**:
- タスク7.1（ライト/ダークモード実装）完了
- タスク3.2（レイアウトとナビゲーション実装）完了
- タスク3.4（セッション管理画面実装）完了
- タスク3.5（セッション詳細画面実装）完了

**推定工数**: 30分（AIエージェント作業時間）
- テスト作成・コミット: 9分
- 実装・テスト通過・コミット: 21分

---

### タスク7.3: ドキュメント作成

**説明**:
README、セットアップガイドを作成する。ユーザーが ClaudeWork を簡単にセットアップして使用できるようにする。
- README.md（概要、機能、スクリーンショット）
- セットアップ手順
- 環境変数一覧
- API仕様概要
- ライセンス情報

**技術的文脈**:
- Markdownドキュメント
- 実際の動作を確認してスクリーンショットを撮影（オプション）
- API仕様はOpenAPI/Swagger形式も検討（将来的）

**必要なパッケージ**:
```bash
# 追加パッケージなし
```

**実装ファイル**:
- `README.md` - プロジェクトREADME
- `docs/SETUP.md` - セットアップガイド
- `docs/ENV_VARS.md` - 環境変数リファレンス
- `docs/API.md` - API仕様概要
- `LICENSE` - ライセンスファイル（MITライセンス推奨）

**実装手順（TDD）**:
1. **テスト作成フェーズ**:
   - ドキュメント作成のため、テストは作成しない
   - コミットなし

2. **実装フェーズ**:
   - `README.md`作成
     ```markdown
     # ClaudeWork

     ClaudeWork は、Claude Code セッションをブラウザから管理するための Web ベースツールです。複数のセッションを並列で実行し、Git worktree を使用して各セッションを独立した環境で管理します。

     ## 主な機能

     - **セッション管理**: 複数の Claude Code セッションを並列実行
     - **Git worktree 統合**: セッションごとに独立した Git 環境
     - **リアルタイム通信**: WebSocket によるリアルタイム出力表示
     - **Diff 表示**: Git diff をビジュアルに表示
     - **Git 操作**: rebase、squash merge などの Git 操作をブラウザから実行
     - **ランスクリプト**: テスト実行、ビルドなどの定型作業を簡単に実行
     - **ターミナル統合**: ブラウザ内でターミナル操作
     - **ライト/ダークモード**: テーマ切り替え対応
     - **モバイル対応**: レスポンシブデザイン

     ## セットアップ

     詳細は [SETUP.md](docs/SETUP.md) を参照してください。

     ### クイックスタート

     ```bash
     npx claude-work
     ```

     初回起動時に認証トークンを設定します:

     ```bash
     export AUTH_TOKEN="your-secret-token"
     npx claude-work
     ```

     ブラウザで `http://localhost:3000` を開き、設定したトークンでログインします。

     ## 環境変数

     詳細は [ENV_VARS.md](docs/ENV_VARS.md) を参照してください。

     | 変数名 | 説明 | デフォルト |
     |--------|------|-----------|
     | `AUTH_TOKEN` | 認証トークン | なし（必須） |
     | `PORT` | サーバーポート | 3000 |
     | `DATABASE_URL` | SQLite データベースパス | file:./data/claude-work.db |

     ## API 仕様

     詳細は [API.md](docs/API.md) を参照してください。

     ## ライセンス

     MIT License - 詳細は [LICENSE](LICENSE) を参照してください。

     ## 技術スタック

     - **フロントエンド**: Next.js 14, React 18, TypeScript, Tailwind CSS, Zustand
     - **バックエンド**: Next.js API Routes, Prisma, SQLite, WebSocket (ws)
     - **その他**: XTerm.js, react-diff-viewer-continued, Headless UI

     ## 貢献

     Issue や Pull Request は歓迎します。

     ## サポート

     問題が発生した場合は、GitHub Issues でお知らせください。
     ```
   - `docs/SETUP.md`作成
     ```markdown
     # セットアップガイド

     ## 必要要件

     - Node.js 20 以上
     - Git
     - Claude Code CLI（`npm install -g claude-code`）

     ## インストール

     ### npx で実行（推奨）

     グローバルインストール不要で実行できます:

     ```bash
     npx claude-work
     ```

     ### グローバルインストール

     ```bash
     npm install -g claude-work
     claude-work
     ```

     ## 初期設定

     ### 1. 認証トークン設定

     環境変数で認証トークンを設定します:

     ```bash
     export AUTH_TOKEN="your-secret-token"
     ```

     または、`.env`ファイルを作成:

     ```
     AUTH_TOKEN=your-secret-token
     PORT=3000
     DATABASE_URL=file:./data/claude-work.db
     ```

     ### 2. サーバー起動

     ```bash
     npx claude-work
     ```

     サーバーが起動したら、ブラウザで `http://localhost:3000` を開きます。

     ### 3. ログイン

     設定した認証トークンでログインします。

     ### 4. プロジェクト追加

     Git リポジトリのパスを指定してプロジェクトを追加します:

     ```
     /path/to/your/git/repo
     ```

     ### 5. セッション作成

     プロジェクトを開き、セッション名とプロンプトを入力してセッションを作成します。

     ## トラブルシューティング

     ### データベースエラー

     データベースファイルが破損した場合、削除して再起動します:

     ```bash
     rm -rf data/claude-work.db
     npx claude-work
     ```

     ### ポート競合

     ポート 3000 が使用中の場合、別のポートを指定します:

     ```bash
     PORT=3001 npx claude-work
     ```

     ### Claude Code が見つからない

     Claude Code CLI がインストールされているか確認します:

     ```bash
     claude --version
     ```

     インストールされていない場合:

     ```bash
     npm install -g claude-code
     ```
     ```
   - `docs/ENV_VARS.md`作成
     ```markdown
     # 環境変数リファレンス

     ClaudeWork で使用可能な環境変数の一覧です。

     ## 必須環境変数

     ### AUTH_TOKEN

     - **説明**: 認証トークン
     - **形式**: 任意の文字列（推奨: 32文字以上のランダム文字列）
     - **例**: `AUTH_TOKEN="my-secret-token-12345678"`
     - **デフォルト**: なし（必須）

     ## オプション環境変数

     ### PORT

     - **説明**: サーバーポート
     - **形式**: 整数（1024-65535）
     - **例**: `PORT=3000`
     - **デフォルト**: `3000`

     ### DATABASE_URL

     - **説明**: SQLite データベースパス
     - **形式**: `file:./path/to/database.db`
     - **例**: `DATABASE_URL="file:./data/claude-work.db"`
     - **デフォルト**: `file:./data/claude-work.db`

     ### NODE_ENV

     - **説明**: 実行環境
     - **形式**: `development` | `production` | `test`
     - **例**: `NODE_ENV=production`
     - **デフォルト**: `development`

     ### LOG_LEVEL

     - **説明**: ログレベル
     - **形式**: `error` | `warn` | `info` | `debug`
     - **例**: `LOG_LEVEL=info`
     - **デフォルト**: `info`

     ## 設定例

     ### .env ファイル

     ```env
     AUTH_TOKEN=your-secret-token-here
     PORT=3000
     DATABASE_URL=file:./data/claude-work.db
     NODE_ENV=production
     LOG_LEVEL=info
     ```

     ### コマンドライン

     ```bash
     AUTH_TOKEN="your-token" PORT=3001 npx claude-work
     ```
     ```
   - `docs/API.md`作成
     ```markdown
     # API 仕様概要

     ClaudeWork の REST API とWebSocket API の概要です。

     ## 認証

     すべての API リクエストには、セッションクッキーが必要です。

     ### ログイン

     ```
     POST /api/auth/login
     Content-Type: application/json

     {
       "token": "your-auth-token"
     }
     ```

     ### ログアウト

     ```
     POST /api/auth/logout
     ```

     ## プロジェクト API

     ### プロジェクト一覧取得

     ```
     GET /api/projects
     ```

     ### プロジェクト追加

     ```
     POST /api/projects
     Content-Type: application/json

     {
       "path": "/path/to/git/repo"
     }
     ```

     ### プロジェクト削除

     ```
     DELETE /api/projects/{id}
     ```

     ## セッション API

     ### セッション一覧取得

     ```
     GET /api/projects/{id}/sessions
     ```

     ### セッション作成

     ```
     POST /api/projects/{id}/sessions
     Content-Type: application/json

     {
       "name": "session-name",
       "prompt": "initial prompt",
       "model": "auto"
     }
     ```

     ### セッション削除

     ```
     DELETE /api/sessions/{id}
     ```

     ## Git 操作 API

     ### Diff 取得

     ```
     GET /api/sessions/{id}/diff
     ```

     ### Rebase 実行

     ```
     POST /api/sessions/{id}/rebase
     ```

     ### Squash Merge 実行

     ```
     POST /api/sessions/{id}/merge
     Content-Type: application/json

     {
       "commit_message": "Merge commit message"
     }
     ```

     ## ランスクリプト API

     ### スクリプト一覧取得

     ```
     GET /api/projects/{id}/scripts
     ```

     ### スクリプト実行

     ```
     POST /api/sessions/{id}/execute
     Content-Type: application/json

     {
       "script_id": "script-uuid"
     }
     ```

     ## WebSocket API

     ### セッション WebSocket

     ```
     ws://localhost:3000/ws/sessions/{id}
     ```

     **メッセージ形式**:

     クライアント → サーバー:
     ```json
     {
       "type": "input",
       "content": "user message"
     }
     ```

     サーバー → クライアント:
     ```json
     {
       "type": "output",
       "content": "claude response"
     }
     ```

     ### ターミナル WebSocket

     ```
     ws://localhost:3000/ws/terminal/{id}
     ```

     **メッセージ形式**:

     クライアント → サーバー:
     ```json
     {
       "type": "input",
       "data": "ls -la\n"
     }
     ```

     サーバー → クライアント:
     ```json
     {
       "type": "data",
       "content": "total 48\ndrwxr-xr-x ..."
     }
     ```
     ```
   - `LICENSE`作成（MITライセンス）
     ```
     MIT License

     Copyright (c) 2025 ClaudeWork Contributors

     Permission is hereby granted, free of charge, to any person obtaining a copy
     of this software and associated documentation files (the "Software"), to deal
     in the Software without restriction, including without limitation the rights
     to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     copies of the Software, and to permit persons to whom the Software is
     furnished to do so, subject to the following conditions:

     The above copyright notice and this permission notice shall be included in all
     copies or substantial portions of the Software.

     THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
     SOFTWARE.
     ```
   - コミット: "Add comprehensive documentation (README, SETUP, ENV_VARS, API, LICENSE)"

**ドキュメント構成**:

**README.md**:
- プロジェクト概要
- 主な機能リスト
- クイックスタート
- 環境変数表
- 技術スタック
- ライセンス情報
- 貢献ガイドライン

**docs/SETUP.md**:
- 必要要件
- インストール手順（npx/グローバル）
- 初期設定手順
- トラブルシューティング

**docs/ENV_VARS.md**:
- 環境変数一覧（表形式）
- 各変数の説明、形式、デフォルト値
- 設定例（.envファイル、コマンドライン）

**docs/API.md**:
- 認証API
- プロジェクトAPI
- セッションAPI
- Git操作API
- ランスクリプトAPI
- WebSocket API
- リクエスト/レスポンス例

**LICENSE**:
- MITライセンス全文

**エラーハンドリング**:
- 特になし（ドキュメント作成のためエラー処理不要）

**受入基準**:
- [ ] `README.md`が存在する
- [ ] `docs/SETUP.md`が存在する
- [ ] `docs/ENV_VARS.md`が存在する
- [ ] `docs/API.md`が存在する
- [ ] `LICENSE`が存在する
- [ ] README にプロジェクト概要が記載されている
- [ ] README に主な機能リストが記載されている
- [ ] README にクイックスタートが記載されている
- [ ] SETUP にセットアップ手順が記載されている
- [ ] SETUP にトラブルシューティングが記載されている
- [ ] ENV_VARS に全環境変数が記載されている
- [ ] API に主要な API エンドポイントが記載されている
- [ ] LICENSE に MIT ライセンスが記載されている
- [ ] すべてのドキュメントが Markdown 形式である
- [ ] リンクが正しく設定されている
- [ ] コミットが作成されている

**依存関係**:
- タスク7.2（モバイルUI最適化）完了
- 全フェーズ完了（ドキュメントは最終段階）

**推定工数**: 30分（AIエージェント作業時間）
- ドキュメント作成・コミット: 30分

---

## フェーズ7完了

このフェーズの完了により、以下のUI/UX改善とドキュメントが実装されます:
- ライト/ダークモード
- モバイルUI最適化
- 包括的なドキュメント（README, SETUP, ENV_VARS, API, LICENSE）

これで ClaudeWork の全フェーズが完了します。
