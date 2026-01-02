/**
 * セッション一覧ページ
 * REQ-142: /sessions/パスへのアクセスはプロジェクト一覧ページにリダイレクト
 */

import { redirect } from 'next/navigation';

export default function SessionsPage() {
  redirect('/');
}
