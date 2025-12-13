'use client';

import { MainLayout } from '@/components/layout/MainLayout';
import { AuthGuard } from '@/components/AuthGuard';

export default function Home() {
  return (
    <AuthGuard>
      <MainLayout>
        <div className="flex min-h-full flex-col items-center justify-center p-8">
          <div className="z-10 w-full max-w-5xl items-center justify-between text-center">
            <h1 className="text-4xl font-bold mb-4 text-gray-900">ClaudeWork</h1>
            <p className="text-lg text-gray-600">AI-powered development workspace</p>
            <p className="text-sm text-gray-500 mt-4">
              左側のサイドバーからプロジェクトを選択してください
            </p>
          </div>
        </div>
      </MainLayout>
    </AuthGuard>
  );
}
