import { describe, expect, it, vi } from 'vitest';
import { createChildLogger, createLogger } from '../index';

describe('createLogger', () => {
  it('returns a logger with info, warn, error, debug methods', () => {
    const logger = createLogger('test');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('does not throw when logging with no metadata', () => {
    const logger = createLogger('test');
    expect(() => logger.info('hello')).not.toThrow();
    expect(() => logger.warn('caution')).not.toThrow();
    expect(() => logger.error('failure')).not.toThrow();
    expect(() => logger.debug('trace')).not.toThrow();
  });

  it('does not throw when logging with metadata', () => {
    const logger = createLogger('test');
    expect(() => logger.info('hello', { key: 'value' })).not.toThrow();
    expect(() => logger.warn('warn', { code: 400 })).not.toThrow();
    expect(() => logger.error('fail', { code: 500 })).not.toThrow();
    expect(() => logger.debug('dbg', { detail: true })).not.toThrow();
  });

  it('has a _pinoInstance property for child logger support', () => {
    const logger = createLogger('test') as { _pinoInstance?: unknown };
    expect(logger._pinoInstance).toBeDefined();
  });
});

describe('createChildLogger', () => {
  it('returns a logger with the same interface', () => {
    const parent = createLogger('parent');
    const child = createChildLogger(parent, { traceId: 'abc' });
    expect(typeof child.info).toBe('function');
    expect(typeof child.warn).toBe('function');
    expect(typeof child.error).toBe('function');
    expect(typeof child.debug).toBe('function');
  });

  it('does not throw when logging with and without metadata', () => {
    const parent = createLogger('parent');
    const child = createChildLogger(parent, { traceId: 'abc', threadId: 't1' });
    expect(() => child.info('child log')).not.toThrow();
    expect(() => child.info('with meta', { extra: true })).not.toThrow();
    expect(() => child.warn('child warn')).not.toThrow();
    expect(() => child.warn('warn meta', { x: 1 })).not.toThrow();
    expect(() => child.error('child error')).not.toThrow();
    expect(() => child.error('error meta', { y: 2 })).not.toThrow();
    expect(() => child.debug('child debug')).not.toThrow();
    expect(() => child.debug('debug meta', { z: 3 })).not.toThrow();
  });

  it('supports nested child loggers', () => {
    const parent = createLogger('parent');
    const child1 = createChildLogger(parent, { traceId: 'abc' });
    const child2 = createChildLogger(child1, { threadId: 't1' });
    expect(() => child2.info('nested')).not.toThrow();
  });

  it('works with a mock/fallback logger (no _pinoInstance)', () => {
    const mockParent = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };
    const child = createChildLogger(mockParent, { source: 'test' });
    child.info('fallback log');
    child.info('with meta', { key: 'val' });
    child.warn('warn');
    child.error('error');
    child.debug('debug');
    // Fallback merges context into meta
    expect(mockParent.info).toHaveBeenCalledWith('fallback log', { source: 'test' });
    expect(mockParent.info).toHaveBeenCalledWith('with meta', { source: 'test', key: 'val' });
    expect(mockParent.warn).toHaveBeenCalledWith('warn', { source: 'test' });
    expect(mockParent.error).toHaveBeenCalledWith('error', { source: 'test' });
    expect(mockParent.debug).toHaveBeenCalledWith('debug', { source: 'test' });
  });
});
