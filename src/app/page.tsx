'use client';

import { useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { AuthGuard } from '@/components/AuthGuard';
import { ProjectList } from '@/components/projects/ProjectList';
import { useAppStore } from '@/store';

export default function Home() {
  const { fetchProjects } = useAppStore();

  useEffect(() => {
    fetchProjects().catch(() => {
      // エラーは個別のコンポーネントで処理
    });
  }, [fetchProjects]);

  return (
    <AuthGuard>
      <MainLayout>
        <ProjectList />
      </MainLayout>
    </AuthGuard>
  );
}
