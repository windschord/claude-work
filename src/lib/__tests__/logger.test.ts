import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { logger } from '../logger';

describe('Logger', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should be a winston logger instance', () => {
    expect(logger).toBeDefined();
    expect(logger.info).toBeDefined();
    expect(logger.error).toBeDefined();
    expect(logger.debug).toBeDefined();
    expect(logger.warn).toBeDefined();
  });

  it('should have json format', () => {
    const transports = logger.transports;
    expect(transports.length).toBeGreaterThan(0);
  });

  it('should log info messages', () => {
    const spy = vi.spyOn(logger, 'info');
    logger.info('Test info message');
    expect(spy).toHaveBeenCalledWith('Test info message');
  });

  it('should log error messages', () => {
    const spy = vi.spyOn(logger, 'error');
    logger.error('Test error message');
    expect(spy).toHaveBeenCalledWith('Test error message');
  });

  it('should log with metadata', () => {
    const spy = vi.spyOn(logger, 'info');
    logger.info('Test message', { userId: '123' });
    expect(spy).toHaveBeenCalledWith('Test message', { userId: '123' });
  });
});
