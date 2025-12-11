'use client';

import { useAuthStore } from '@/store/auth';
import { useRouter } from 'next/navigation';

export default function Home() {
  const { logout, isLoading } = useAuthStore();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('ログアウトエラー:', error);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm">
        <h1 className="text-4xl font-bold mb-8 text-center">
          Claude Work
        </h1>
        <p className="text-center text-lg mb-8">
          ClaudeWorkプロジェクトへようこそ
        </p>
        <div className="flex justify-center">
          <button
            onClick={handleLogout}
            disabled={isLoading}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'ログアウト中...' : 'ログアウト'}
          </button>
        </div>
      </div>
    </main>
  );
}
