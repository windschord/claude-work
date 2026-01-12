'use client';

import { useState, useEffect, useCallback } from 'react';
import type { DockerSession, CreateDockerSessionRequest, SessionWarning } from '@/types/docker-session';

/**
 * Safely extract error message from response
 */
async function getErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const data = await response.json();
    return data.error || fallback;
  } catch {
    // Response is not JSON (e.g., 502 Bad Gateway)
    return fallback;
  }
}

/**
 * Docker sessions management hook
 *
 * Provides CRUD operations and actions for Docker-based sessions.
 */
export function useDockerSessions() {
  const [sessions, setSessions] = useState<DockerSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch all sessions
   */
  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/sessions');
      if (!response.ok) {
        throw new Error('Failed to fetch sessions');
      }
      const data = await response.json();
      setSessions(data.sessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Create a new session
   */
  const createSession = useCallback(async (request: CreateDockerSessionRequest): Promise<DockerSession> => {
    const response = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      throw new Error(await getErrorMessage(response, 'Failed to create session'));
    }
    const data = await response.json();
    await fetchSessions(); // Refresh the list
    return data.session;
  }, [fetchSessions]);

  /**
   * Start a session
   */
  const startSession = useCallback(async (sessionId: string): Promise<void> => {
    const response = await fetch(`/api/sessions/${sessionId}/start`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error(await getErrorMessage(response, 'Failed to start session'));
    }
    await fetchSessions(); // Refresh the list
  }, [fetchSessions]);

  /**
   * Stop a session
   */
  const stopSession = useCallback(async (sessionId: string): Promise<void> => {
    const response = await fetch(`/api/sessions/${sessionId}/stop`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error(await getErrorMessage(response, 'Failed to stop session'));
    }
    await fetchSessions(); // Refresh the list
  }, [fetchSessions]);

  /**
   * Delete a session
   */
  const deleteSession = useCallback(async (sessionId: string): Promise<void> => {
    const response = await fetch(`/api/sessions/${sessionId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error(await getErrorMessage(response, 'Failed to delete session'));
    }
    await fetchSessions(); // Refresh the list
  }, [fetchSessions]);

  /**
   * Get session warning (uncommitted changes, unpushed commits)
   */
  const getSessionWarning = useCallback(async (sessionId: string): Promise<SessionWarning | null> => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/warning`);
      if (!response.ok) {
        return null;
      }
      const data = await response.json();
      return data.warning;
    } catch {
      return null;
    }
  }, []);

  // Fetch sessions on mount
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return {
    sessions,
    loading,
    error,
    fetchSessions,
    createSession,
    startSession,
    stopSession,
    deleteSession,
    getSessionWarning,
  };
}
