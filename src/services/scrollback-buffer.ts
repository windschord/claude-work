/**
 * ScrollbackBuffer
 *
 * セッションごとのターミナル出力をチャンクキューで保持する。
 * 新しいWebSocketクライアントが接続した際に、過去の出力を再送するために使用する。
 *
 * バッファサイズはバイト数（UTF-8）で制限される。
 */

const DEFAULT_MAX_BUFFER_SIZE = 100 * 1024; // 100KB per session (bytes)

interface SessionBuffer {
  chunks: string[];
  byteSize: number;
}

export class ScrollbackBuffer {
  private buffers: Map<string, SessionBuffer> = new Map();
  private maxSize: number;

  constructor(maxSize: number = DEFAULT_MAX_BUFFER_SIZE) {
    this.maxSize = maxSize;
  }

  /**
   * セッションのバッファにデータを追加する。
   * バッファサイズがmaxSizeバイトを超えた場合、先頭チャンクから切り捨てる。
   */
  append(sessionId: string, data: string): void {
    let buf = this.buffers.get(sessionId);
    if (!buf) {
      buf = { chunks: [], byteSize: 0 };
      this.buffers.set(sessionId, buf);
    }

    const dataBytes = Buffer.byteLength(data, 'utf8');

    // データ自体がmaxSizeを超える場合は末尾のみ保持
    if (dataBytes >= this.maxSize) {
      const encoded = Buffer.from(data, 'utf8');
      const trimmed = encoded.subarray(encoded.length - this.maxSize).toString('utf8');
      buf.chunks = [trimmed];
      buf.byteSize = Buffer.byteLength(trimmed, 'utf8');
      return;
    }

    buf.chunks.push(data);
    buf.byteSize += dataBytes;

    // 先頭チャンクを削除してサイズ制限内に収める
    while (buf.byteSize > this.maxSize && buf.chunks.length > 1) {
      const removed = buf.chunks.shift()!;
      buf.byteSize -= Buffer.byteLength(removed, 'utf8');
    }

    // チャンク数が多い場合は結合して最適化（メモリ断片化防止）
    if (buf.chunks.length > 100) {
      const merged = buf.chunks.join('');
      buf.chunks = [merged];
      buf.byteSize = Buffer.byteLength(merged, 'utf8');
    }
  }

  /**
   * セッションのバッファ内容を取得する。
   */
  getBuffer(sessionId: string): string | null {
    const buf = this.buffers.get(sessionId);
    if (!buf || buf.chunks.length === 0) return null;
    return buf.chunks.join('');
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

  /**
   * セッションのバッファサイズ（バイト数）を取得する。
   */
  getByteSize(sessionId: string): number {
    return this.buffers.get(sessionId)?.byteSize ?? 0;
  }
}

export const scrollbackBuffer = new ScrollbackBuffer();
