import { redirect } from 'next/navigation';

/**
 * 実行環境設定ページ（廃止）
 *
 * このページは廃止されました。
 * 環境設定はプロジェクト設定（プロジェクト設定モーダル > 実行環境）から行ってください。
 * アクセスした場合は /settings にリダイレクトします。
 */
export default function EnvironmentsSettingsPage() {
  redirect('/settings');
}
