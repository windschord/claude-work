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
  default_model: string;
  created_at: string;
  updated_at: string;
}

export type SessionStatus = 'initializing' | 'running' | 'waiting_input' | 'completed' | 'error';

export interface Session {
  id: string;
  project_id: string;
  name: string;
  status: SessionStatus;
  model: string | null;
  branch_name: string;
  worktree_path: string;
  created_at: string;
  updated_at: string;
  has_uncommitted_changes: boolean;
  changed_files_count: number;
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

export interface RebaseResult {
  success: boolean;
  message: string;
  conflict_files?: string[];
}

export interface MergeResult {
  success: boolean;
  message: string;
}

export interface PromptHistory {
  id: number;
  project_id: string;
  prompt_text: string;
  created_at: string;
}

export interface Commit {
  hash: string;
  message: string;
  author_name: string;
  author_email: string;
  date: string;
}

export interface CommitDiff {
  diff: string;
}

export interface ResetResult {
  success: boolean;
}

export interface RunScript {
  id: number;
  project_id: string;
  name: string;
  command: string;
  created_at: string;
  updated_at: string;
}

export interface ScriptExecutionResult {
  success: boolean;
  output: string;
  exit_code: number;
  execution_time: number;
}

// WebSocket message types
export type WebSocketMessage =
  | { type: 'assistant_output'; content: string }
  | { type: 'permission_request'; permission_id: string; description: string }
  | { type: 'session_status'; status: SessionStatus }
  | { type: 'error'; message: string };

export type WebSocketClientMessage =
  | { type: 'user_input'; content: string }
  | { type: 'permission_response'; permission_id: string; approved: boolean };

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

  async createProject(path: string, defaultModel?: string): Promise<Project> {
    const response = await fetch(`${API_URL}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path, default_model: defaultModel }),
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'プロジェクトの作成に失敗しました' }));
      throw new ApiError(response.status, errorData.detail || 'プロジェクトの作成に失敗しました');
    }

    return await response.json();
  },

  async updateProject(id: string, name?: string, defaultModel?: string): Promise<Project> {
    const response = await fetch(`${API_URL}/api/projects/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, default_model: defaultModel }),
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

  async createSession(projectId: string, name: string, initialPrompt?: string, count?: number, model?: string): Promise<Session[]> {
    const response = await fetch(`${API_URL}/api/projects/${projectId}/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, message: initialPrompt || '', count, model }),
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

  async rebaseFromMain(sessionId: string): Promise<RebaseResult> {
    const response = await fetch(`${API_URL}/api/sessions/${sessionId}/rebase`, {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'rebaseに失敗しました' }));
      throw new ApiError(response.status, errorData.detail || 'rebaseに失敗しました');
    }

    return await response.json();
  },

  async squashMerge(sessionId: string, message: string): Promise<MergeResult> {
    const response = await fetch(`${API_URL}/api/sessions/${sessionId}/merge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'マージに失敗しました' }));
      throw new ApiError(response.status, errorData.detail || 'マージに失敗しました');
    }

    return await response.json();
  },

  async getPromptHistory(projectId: string): Promise<PromptHistory[]> {
    const response = await fetch(`${API_URL}/api/projects/${projectId}/prompt-history`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'プロンプト履歴の取得に失敗しました' }));
      throw new ApiError(response.status, errorData.detail || 'プロンプト履歴の取得に失敗しました');
    }

    return await response.json();
  },

  async savePromptHistory(projectId: string, promptText: string): Promise<PromptHistory> {
    const response = await fetch(`${API_URL}/api/projects/${projectId}/prompt-history`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt_text: promptText }),
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'プロンプト履歴の保存に失敗しました' }));
      throw new ApiError(response.status, errorData.detail || 'プロンプト履歴の保存に失敗しました');
    }

    return await response.json();
  },

  async deletePromptHistory(projectId: string, historyId: number): Promise<void> {
    const response = await fetch(`${API_URL}/api/projects/${projectId}/prompt-history/${historyId}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'プロンプト履歴の削除に失敗しました' }));
      throw new ApiError(response.status, errorData.detail || 'プロンプト履歴の削除に失敗しました');
    }
  },

  async getCommitHistory(sessionId: string, limit: number = 20): Promise<Commit[]> {
    const response = await fetch(`${API_URL}/api/sessions/${sessionId}/commits?limit=${limit}`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'コミット履歴の取得に失敗しました' }));
      throw new ApiError(response.status, errorData.detail || 'コミット履歴の取得に失敗しました');
    }

    return await response.json();
  },

  async getCommitDiff(sessionId: string, commitHash: string): Promise<CommitDiff> {
    const response = await fetch(`${API_URL}/api/sessions/${sessionId}/commits/${commitHash}/diff`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'コミットのdiff取得に失敗しました' }));
      throw new ApiError(response.status, errorData.detail || 'コミットのdiff取得に失敗しました');
    }

    return await response.json();
  },

  async resetToCommit(sessionId: string, commitHash: string): Promise<ResetResult> {
    const response = await fetch(`${API_URL}/api/sessions/${sessionId}/commits/${commitHash}/reset`, {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'コミットへのリセットに失敗しました' }));
      throw new ApiError(response.status, errorData.detail || 'コミットへのリセットに失敗しました');
    }

    return await response.json();
  },

  // Run Scripts
  async getRunScripts(projectId: string): Promise<RunScript[]> {
    const response = await fetch(`${API_URL}/api/projects/${projectId}/run-scripts`, {
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'ランスクリプト一覧の取得に失敗しました' }));
      throw new ApiError(response.status, errorData.detail || 'ランスクリプト一覧の取得に失敗しました');
    }

    return await response.json();
  },

  async createRunScript(projectId: string, name: string, command: string): Promise<RunScript> {
    const response = await fetch(`${API_URL}/api/projects/${projectId}/run-scripts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, command }),
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'ランスクリプトの作成に失敗しました' }));
      throw new ApiError(response.status, errorData.detail || 'ランスクリプトの作成に失敗しました');
    }

    return await response.json();
  },

  async updateRunScript(projectId: string, scriptId: number, name: string, command: string): Promise<RunScript> {
    const response = await fetch(`${API_URL}/api/projects/${projectId}/run-scripts/${scriptId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, command }),
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'ランスクリプトの更新に失敗しました' }));
      throw new ApiError(response.status, errorData.detail || 'ランスクリプトの更新に失敗しました');
    }

    return await response.json();
  },

  async deleteRunScript(projectId: string, scriptId: number): Promise<void> {
    const response = await fetch(`${API_URL}/api/projects/${projectId}/run-scripts/${scriptId}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'ランスクリプトの削除に失敗しました' }));
      throw new ApiError(response.status, errorData.detail || 'ランスクリプトの削除に失敗しました');
    }
  },

  async executeRunScript(sessionId: string, scriptId: number): Promise<ScriptExecutionResult> {
    const response = await fetch(`${API_URL}/api/execute-script/${sessionId}/${scriptId}`, {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'スクリプトの実行に失敗しました' }));
      throw new ApiError(response.status, errorData.detail || 'スクリプトの実行に失敗しました');
    }

    return await response.json();
  },
};
