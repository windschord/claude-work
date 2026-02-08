/**
 * ScrollbackBuffer
 *
 * セッションごとのターミナル出力をリングバッファで保持する。
 * 新しいWebSocketクライアントが接続した際に、過去の出力を再送するために使用する。
 */

const DEFAULT_MAX_BUFFER_SIZE = 100 * 1024; // 100KB per session

export class ScrollbackBuffer {
  private buffers: Map<string, string> = new Map();
  private maxSize: number;

  constructor(maxSize: number = DEFAULT_MAX_BUFFER_SIZE) {
    this.maxSize = maxSize;
  }

  /**
   * セッションのバッファにデータを追加する。
   * バッファサイズがmaxSizeを超えた場合、先頭から切り捨てる。
   */
  append(sessionId: string, data: string): void {
    const current = this.buffers.get(sessionId) || '';
    let newBuffer = current + data;

    if (newBuffer.length > this.maxSize) {
      // 古いデータを切り捨て（末尾のmaxSize分を保持）
      newBuffer = newBuffer.slice(newBuffer.length - this.maxSize);
    }

    this.buffers.set(sessionId, newBuffer);
  }

  /**
   * セッションのバッファ内容を取得する。
   */
  getBuffer(sessionId: string): string | null {
    return this.buffers.get(sessionId) || null;
  }

  /**
   * セッションのバッファをクリアする。
   */
  clear(sessionId: string): void {
    this.buffers.delete(sessionId);
  }

  /**
   * セッションのバッファが存在するか確認する。
   */
  has(sessionId: string): boolean {
    return this.buffers.has(sessionId);
  }
}

export const scrollbackBuffer = new ScrollbackBuffer();
