import { create } from 'zustand';

/**
 * スクリプトログエントリー
 */
export interface ScriptLogEntry {
  /** タイムスタンプ */
  timestamp: number;
  /** ログレベル */
  level: 'info' | 'error';
  /** ログ内容 */
  content: string;
}

/**
 * ランスクリプトの実行情報
 */
export interface ScriptRunInfo {
  /** 実行ID */
  runId: string;
  /** スクリプトID */
  scriptId: string;
  /** スクリプト名 */
  scriptName: string;
  /** 実行中かどうか */
  isRunning: boolean;
  /** 開始時刻 */
  startTime: number;
  /** 終了時刻（未終了の場合はnull） */
  endTime: number | null;
  /** 終了コード */
  exitCode: number | null;
  /** シグナル */
  signal: string | null;
  /** 実行時間（ミリ秒） */
  executionTime: number | null;
  /** ログエントリー */
  logs: ScriptLogEntry[];
}

/**
 * スクリプトログ状態管理インターフェース
 */
export interface ScriptLogState {
  /** 実行中・完了したスクリプトの情報（runId -> ScriptRunInfo） */
  runs: Map<string, ScriptRunInfo>;

  /**
   * 新しいスクリプト実行を開始
   * @param runId 実行ID
   * @param scriptId スクリプトID
   * @param scriptName スクリプト名
   */
  startRun: (runId: string, scriptId: string, scriptName: string) => void;

  /**
   * ログエントリーを追加
   * @param runId 実行ID
   * @param entry ログエントリー
   */
  addLog: (runId: string, entry: ScriptLogEntry) => void;

  /**
   * スクリプト実行を終了
   * @param runId 実行ID
   * @param exitCode 終了コード
   * @param signal シグナル
   * @param executionTime 実行時間
   */
  endRun: (
    runId: string,
    exitCode: number | null,
    signal: string | null,
    executionTime: number
  ) => void;

  /**
   * 特定のrunIdのログをクリア
   * @param runId 実行ID
   */
  clearRun: (runId: string) => void;

  /**
   * すべてのログをクリア
   */
  clearAll: () => void;

  /**
   * 古い実行データを自動クリーンアップ（最新maxRuns件のみ保持）
   * @param maxRuns 保持する最大実行数（デフォルト: 100）
   */
  cleanup: (maxRuns?: number) => void;
}

/**
 * スクリプトログ状態管理ストア
 */
export const useScriptLogStore = create<ScriptLogState>((set) => ({
  runs: new Map(),

  startRun: (runId: string, scriptId: string, scriptName: string) => {
    set((state) => {
      const newRuns = new Map(state.runs);
      newRuns.set(runId, {
        runId,
        scriptId,
        scriptName,
        isRunning: true,
        startTime: Date.now(),
        endTime: null,
        exitCode: null,
        signal: null,
        executionTime: null,
        logs: [],
      });

      // 古い実行データを自動クリーンアップ（メモリリーク防止）
      const maxRuns = 100;
      if (newRuns.size > maxRuns) {
        const entries = Array.from(newRuns.entries());
        entries.sort((a, b) => b[1].startTime - a[1].startTime);
        const trimmedEntries = entries.slice(0, maxRuns);
        return { runs: new Map(trimmedEntries) };
      }

      return { runs: newRuns };
    });
  },

  addLog: (runId: string, entry: ScriptLogEntry) => {
    set((state) => {
      const newRuns = new Map(state.runs);
      const run = newRuns.get(runId);
      if (run) {
        newRuns.set(runId, {
          ...run,
          logs: [...run.logs, entry],
        });
      }
      return { runs: newRuns };
    });
  },

  endRun: (
    runId: string,
    exitCode: number | null,
    signal: string | null,
    executionTime: number
  ) => {
    set((state) => {
      const newRuns = new Map(state.runs);
      const run = newRuns.get(runId);
      if (run) {
        newRuns.set(runId, {
          ...run,
          isRunning: false,
          endTime: Date.now(),
          exitCode,
          signal,
          executionTime,
        });
      }
      return { runs: newRuns };
    });
  },

  clearRun: (runId: string) => {
    set((state) => {
      const newRuns = new Map(state.runs);
      newRuns.delete(runId);
      return { runs: newRuns };
    });
  },

  clearAll: () => {
    set({ runs: new Map() });
  },

  cleanup: (maxRuns: number = 100) => {
    set((state) => {
      const entries = Array.from(state.runs.entries());
      if (entries.length <= maxRuns) return state;

      // startTimeでソートし、新しいものからmaxRuns件のみ保持
      entries.sort((a, b) => b[1].startTime - a[1].startTime);
      const newRuns = new Map(entries.slice(0, maxRuns));
      return { runs: newRuns };
    });
  },
}));
