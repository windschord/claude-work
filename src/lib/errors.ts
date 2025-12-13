import { NextResponse } from 'next/server';
import { logger } from './logger';

/**
 * APIエラーレスポンスの型定義
 */
export interface ErrorResponse {
  /** エラーメッセージ */
  error: string;
  /** エラーコード */
  code: string;
  /** スタックトレース（開発環境のみ） */
  stack?: string;
}

/**
 * APIエラークラス
 *
 * カスタムエラーコードとHTTPステータスコードを持つエラークラスです。
 * handleApiError関数で適切にハンドリングされます。
 */
export class ApiError extends Error {
  /**
   * ApiErrorのインスタンスを作成
   *
   * @param message - エラーメッセージ
   * @param code - エラーコード（例: 'VALIDATION_ERROR', 'NOT_FOUND'）
   * @param statusCode - HTTPステータスコード（デフォルト: 500）
   */
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * エラーレスポンスを作成
 *
 * ApiErrorインスタンスからNextResponseを作成します。
 * 開発環境ではスタックトレースも含めます。
 *
 * @param error - ApiErrorインスタンス
 * @param isDevelopment - 開発環境かどうか（デフォルト: 環境変数から判定）
 * @returns エラーレスポンス
 */
export function createErrorResponse(
  error: ApiError,
  isDevelopment: boolean = process.env.NODE_ENV !== 'production'
): NextResponse<ErrorResponse> {
  const response: ErrorResponse = {
    error: error.message,
    code: error.code,
  };

  if (isDevelopment && error.stack) {
    response.stack = error.stack;
  }

  return NextResponse.json(response, { status: error.statusCode });
}

/**
 * APIエラーをハンドリング
 *
 * 任意のエラーオブジェクトを適切なNextResponseに変換します。
 * エラーの種類に応じて適切なステータスコードとログ出力を行います。
 *
 * @param error - ハンドリングするエラー
 * @param context - エラーが発生したコンテキスト（ログ出力用）
 * @returns エラーレスポンス
 *
 * @example
 * ```typescript
 * try {
 *   // 何らかの処理
 * } catch (error) {
 *   return handleApiError(error, 'user-registration');
 * }
 * ```
 */
export function handleApiError(error: unknown, context?: string): NextResponse<ErrorResponse> {
  const isDevelopment = process.env.NODE_ENV !== 'production';

  // ApiError instances should use their statusCode
  if (error instanceof ApiError) {
    logger.error(`API Error${context ? ` in ${context}` : ''}`, {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      stack: error.stack,
    });
    return createErrorResponse(error, isDevelopment);
  }

  if (error instanceof Error) {
    logger.error(`API Error${context ? ` in ${context}` : ''}`, {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });

    const response: ErrorResponse = {
      error: error.message,
      code: error.name || 'INTERNAL_ERROR',
    };

    if (isDevelopment && error.stack) {
      response.stack = error.stack;
    }

    return NextResponse.json(response, { status: 500 });
  }

  logger.error(`Unknown error${context ? ` in ${context}` : ''}`, { error });

  const response: ErrorResponse = {
    error: 'An unknown error occurred',
    code: 'UNKNOWN_ERROR',
  };

  return NextResponse.json(response, { status: 500 });
}
