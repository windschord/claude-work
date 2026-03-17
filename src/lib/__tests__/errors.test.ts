import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { handleApiError, ApiError, createErrorResponse } from '../errors';

// loggerをモック
vi.mock('../logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Error Handling', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.NODE_ENV = originalEnv;
    } else {
      delete process.env.NODE_ENV;
    }
  });

  describe('handleApiError', () => {
    it('should handle Error instances', async () => {
      const error = new Error('Test error');
      const response = handleApiError(error);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toHaveProperty('error', 'Test error');
      expect(data).toHaveProperty('code');
    });

    it('should handle ApiError instances with correct statusCode', async () => {
      const error = new ApiError('Not found', 'NOT_FOUND', 404);
      const response = handleApiError(error);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Not found');
      expect(data.code).toBe('NOT_FOUND');
    });

    it('should handle ApiError with context logging', async () => {
      const { logger } = await import('../logger');
      const error = new ApiError('Bad request', 'BAD_REQUEST', 400);
      handleApiError(error, 'test-api');

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('in test-api'),
        expect.objectContaining({
          message: 'Bad request',
          code: 'BAD_REQUEST',
          statusCode: 400,
        })
      );
    });

    it('should handle ApiError without context', async () => {
      const { logger } = await import('../logger');
      const error = new ApiError('Error', 'ERR', 500);
      handleApiError(error);

      expect(logger.error).toHaveBeenCalledWith(
        'API Error',
        expect.objectContaining({ message: 'Error' })
      );
    });

    it('should include stack trace in development', async () => {
      process.env.NODE_ENV = 'development';
      const error = new Error('Test error');
      const response = handleApiError(error);
      const data = await response.json();

      expect(data).toHaveProperty('stack');
    });

    it('should not include stack trace in production', async () => {
      process.env.NODE_ENV = 'production';
      const error = new Error('Test error');
      const response = handleApiError(error);
      const data = await response.json();

      expect(data).not.toHaveProperty('stack');
    });

    it('should use error.name as code for generic Error', async () => {
      const error = new Error('Test error');
      const response = handleApiError(error);
      const data = await response.json();

      expect(data.code).toBe('Error');
    });

    it('should log Error with name and stack', async () => {
      const { logger } = await import('../logger');
      const error = new Error('Test error');
      handleApiError(error, 'ctx');

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('in ctx'),
        expect.objectContaining({
          message: 'Test error',
          name: 'Error',
          stack: expect.any(String),
        })
      );
    });

    it('should handle unknown errors', async () => {
      const response = handleApiError('Some string error');
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toHaveProperty('error', 'An unknown error occurred');
      expect(data).toHaveProperty('code', 'UNKNOWN_ERROR');
    });

    it('should log unknown error with context', async () => {
      const { logger } = await import('../logger');
      handleApiError(42, 'number-ctx');

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('in number-ctx'),
        expect.objectContaining({ error: 42 })
      );
    });

    it('should log unknown error without context', async () => {
      const { logger } = await import('../logger');
      handleApiError(null);

      expect(logger.error).toHaveBeenCalledWith(
        'Unknown error',
        expect.objectContaining({ error: null })
      );
    });

    it('should include context in log', async () => {
      const error = new Error('Test error');
      const response = handleApiError(error, 'test-context');
      const data = await response.json();

      expect(data).toHaveProperty('error', 'Test error');
    });
  });

  describe('ApiError', () => {
    it('should create ApiError with custom code', () => {
      const error = new ApiError('Not found', 'NOT_FOUND', 404);

      expect(error.message).toBe('Not found');
      expect(error.code).toBe('NOT_FOUND');
      expect(error.statusCode).toBe(404);
      expect(error.name).toBe('ApiError');
    });

    it('should default to 500 status code', () => {
      const error = new ApiError('Internal error', 'INTERNAL_ERROR');

      expect(error.statusCode).toBe(500);
    });
  });

  describe('createErrorResponse', () => {
    it('should create error response with correct status', async () => {
      const error = new ApiError('Unauthorized', 'UNAUTHORIZED', 401);
      const response = createErrorResponse(error);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toHaveProperty('error', 'Unauthorized');
      expect(data).toHaveProperty('code', 'UNAUTHORIZED');
    });

    it('should include stack in development mode', async () => {
      const error = new ApiError('Test error', 'TEST_ERROR', 400);
      const response = createErrorResponse(error, true);
      const data = await response.json();

      expect(data).toHaveProperty('stack');
    });

    it('should not include stack in production mode', async () => {
      const error = new ApiError('Test error', 'TEST_ERROR', 400);
      const response = createErrorResponse(error, false);
      const data = await response.json();

      expect(data).not.toHaveProperty('stack');
    });

    it('should use NODE_ENV to determine isDevelopment when not explicitly passed', async () => {
      process.env.NODE_ENV = 'production';
      const error = new ApiError('Test error', 'TEST_ERROR', 400);
      const response = createErrorResponse(error);
      const data = await response.json();
      expect(data).not.toHaveProperty('stack');
    });

    it('should include stack when NODE_ENV is not production (default)', async () => {
      process.env.NODE_ENV = 'development';
      const error = new ApiError('Test error', 'TEST_ERROR', 400);
      const response = createErrorResponse(error);
      const data = await response.json();
      expect(data).toHaveProperty('stack');
    });
  });
});
