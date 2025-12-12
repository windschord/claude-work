import { create } from 'zustand';
import { api, Message, PermissionRequest, SessionStatus } from '@/lib/api';

interface MessagesState {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  pendingPermission: PermissionRequest | null;
  sessionStatus: SessionStatus | null;
  fetchMessages: (sessionId: string) => Promise<void>;
  sendMessage: (sessionId: string, content: string) => Promise<void>;
  respondToPermission: (sessionId: string, permissionId: string, approved: boolean) => Promise<void>;
  setPendingPermission: (permission: PermissionRequest | null) => void;
  addMessage: (message: Message) => void;
  setSessionStatus: (status: SessionStatus) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  clearMessages: () => void;
}

export const useMessagesStore = create<MessagesState>((set) => ({
  messages: [],
  isLoading: false,
  error: null,
  pendingPermission: null,
  sessionStatus: null,

  fetchMessages: async (sessionId: string) => {
    set({ isLoading: true, error: null });
    try {
      const messages = await api.getMessages(sessionId);
      set({ messages, isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'メッセージ一覧の取得に失敗しました';
      set({ isLoading: false, error: errorMessage });
    }
  },

  sendMessage: async (sessionId: string, content: string) => {
    set({ isLoading: true, error: null });
    try {
      const newMessage = await api.sendMessage(sessionId, content);
      set((state) => ({
        messages: [...state.messages, newMessage],
        isLoading: false,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'メッセージの送信に失敗しました';
      set({ isLoading: false, error: errorMessage });
      throw error;
    }
  },

  respondToPermission: async (sessionId: string, permissionId: string, approved: boolean) => {
    set({ isLoading: true, error: null });
    try {
      await api.respondToPermission(sessionId, permissionId, approved);
      set({ pendingPermission: null, isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '権限確認の応答に失敗しました';
      set({ isLoading: false, error: errorMessage });
      throw error;
    }
  },

  setPendingPermission: (permission: PermissionRequest | null) => {
    set({ pendingPermission: permission });
  },

  addMessage: (message: Message) => {
    set((state) => ({
      messages: [...state.messages, message],
    }));
  },

  setSessionStatus: (status: SessionStatus) => {
    set({ sessionStatus: status });
  },

  setError: (error: string | null) => {
    set({ error });
  },

  clearError: () => set({ error: null }),

  clearMessages: () => set({ messages: [], error: null, pendingPermission: null, sessionStatus: null }),
}));
