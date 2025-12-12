const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface Project {
  id: string;
  name: string;
  path: string;
  created_at: string;
  updated_at: string;
}

export type SessionStatus = 'initializing' | 'running' | 'waiting_input' | 'completed' | 'error';

export interface Session {
  id: string;
  project_id: string;
  name: string;
  status: SessionStatus;
  branch_name: string;
  worktree_path: string;
  created_at: string;
  updated_at: string;
}

export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  session_id: string;
  role: MessageRole;
  content: string;
  created_at: string;
}

export interface PermissionRequest {
  id: string;
  type: string;
  description: string;
}

export type FileChangeStatus = 'added' | 'modified' | 'deleted';

export interface FileChange {
  path: string;
  status: FileChangeStatus;
  additions: number;
  deletions: number;
}

export interface DiffResult {
  files: FileChange[];
  diff_content: string;
  has_changes: boolean;
}

export const api = {
  async login(token: string): Promise<void> {
    const formData = new FormData();
    formData.append('token', token);

    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'ログインに失敗しました' }));
      throw new ApiError(response.status, errorData.detail || 'ログインに失敗しました');
    }
  },

  async logout(): Promise<void> {
    const response = await fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'ログアウトに失敗しました' }));
      throw new ApiError(response.status, errorData.detail || 'ログアウトに失敗しました');
    }
  },

  async checkAuth(): Promise<boolean> {
    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        method: 'GET',
        credentials: 'include',
      });
      return response.ok;
    } catch {
      return false;
    }
  },

  async getProjects(): Promise<Project[]> {
    const response = await fetch(`${API_URL}/api/projects`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'プロジェクト一覧の取得に失敗しました' }));
      throw new ApiError(response.status, errorData.detail || 'プロジェクト一覧の取得に失敗しました');
    }

    return await response.json();
  },

  async createProject(path: string): Promise<Project> {
    const response = await fetch(`${API_URL}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path }),
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'プロジェクトの作成に失敗しました' }));
      throw new ApiError(response.status, errorData.detail || 'プロジェクトの作成に失敗しました');
    }

    return await response.json();
  },

  async updateProject(id: string, name: string): Promise<Project> {
    const response = await fetch(`${API_URL}/api/projects/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name }),
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'プロジェクトの更新に失敗しました' }));
      throw new ApiError(response.status, errorData.detail || 'プロジェクトの更新に失敗しました');
    }

    return await response.json();
  },

  async deleteProject(id: string): Promise<void> {
    const response = await fetch(`${API_URL}/api/projects/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'プロジェクトの削除に失敗しました' }));
      throw new ApiError(response.status, errorData.detail || 'プロジェクトの削除に失敗しました');
    }
  },

  async getSessions(projectId: string): Promise<Session[]> {
    const response = await fetch(`${API_URL}/api/projects/${projectId}/sessions`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'セッション一覧の取得に失敗しました' }));
      throw new ApiError(response.status, errorData.detail || 'セッション一覧の取得に失敗しました');
    }

    return await response.json();
  },

  async createSession(projectId: string, name: string, initialPrompt?: string): Promise<Session> {
    const response = await fetch(`${API_URL}/api/projects/${projectId}/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, initial_prompt: initialPrompt }),
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'セッションの作成に失敗しました' }));
      throw new ApiError(response.status, errorData.detail || 'セッションの作成に失敗しました');
    }

    return await response.json();
  },

  async getSession(id: string): Promise<Session> {
    const response = await fetch(`${API_URL}/api/sessions/${id}`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'セッションの取得に失敗しました' }));
      throw new ApiError(response.status, errorData.detail || 'セッションの取得に失敗しました');
    }

    return await response.json();
  },

  async stopSession(id: string): Promise<void> {
    const response = await fetch(`${API_URL}/api/sessions/${id}/stop`, {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'セッションの停止に失敗しました' }));
      throw new ApiError(response.status, errorData.detail || 'セッションの停止に失敗しました');
    }
  },

  async deleteSession(id: string): Promise<void> {
    const response = await fetch(`${API_URL}/api/sessions/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'セッションの削除に失敗しました' }));
      throw new ApiError(response.status, errorData.detail || 'セッションの削除に失敗しました');
    }
  },

  async getMessages(sessionId: string): Promise<Message[]> {
    const response = await fetch(`${API_URL}/api/sessions/${sessionId}/messages`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'メッセージ一覧の取得に失敗しました' }));
      throw new ApiError(response.status, errorData.detail || 'メッセージ一覧の取得に失敗しました');
    }

    return await response.json();
  },

  async sendMessage(sessionId: string, content: string): Promise<Message> {
    const response = await fetch(`${API_URL}/api/sessions/${sessionId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content }),
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'メッセージの送信に失敗しました' }));
      throw new ApiError(response.status, errorData.detail || 'メッセージの送信に失敗しました');
    }

    return await response.json();
  },

  async respondToPermission(sessionId: string, permissionId: string, approved: boolean): Promise<void> {
    const response = await fetch(`${API_URL}/api/sessions/${sessionId}/permissions/${permissionId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ approved }),
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: '権限確認の応答に失敗しました' }));
      throw new ApiError(response.status, errorData.detail || '権限確認の応答に失敗しました');
    }
  },

  async getDiff(sessionId: string): Promise<DiffResult> {
    const response = await fetch(`${API_URL}/api/sessions/${sessionId}/diff`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Diff情報の取得に失敗しました' }));
      throw new ApiError(response.status, errorData.detail || 'Diff情報の取得に失敗しました');
    }

    return await response.json();
  },
};
