'use client';

import { useState, useEffect, useCallback } from 'react';

export interface DockerVolumeInfo {
  name: string;
  driver: string;
  createdAt: string;
}

export interface UseDockerVolumesReturn {
  volumes: DockerVolumeInfo[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useDockerVolumes(): UseDockerVolumesReturn {
  const [volumes, setVolumes] = useState<DockerVolumeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  const refetch = useCallback(() => {
    setFetchTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchVolumes() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/docker/volumes');

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to fetch volumes');
        }

        const data = await response.json();

        if (!cancelled) {
          setVolumes(data.volumes ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setVolumes([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchVolumes();

    return () => {
      cancelled = true;
    };
  }, [fetchTrigger]);

  return { volumes, loading, error, refetch };
}
