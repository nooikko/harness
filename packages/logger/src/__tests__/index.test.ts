import { describe, expect, it, vi } from 'vitest';
import { createLogger } from '../index';

describe('createLogger', () => {
  it('logs info messages with timestamp and prefix', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createLogger('test');

    logger.info('hello');

    expect(spy).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-.*T.*Z \[test\] hello$/), '');
    spy.mockRestore();
  });

  it('logs warn messages with timestamp and prefix', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logger = createLogger('app');

    logger.warn('caution');

    expect(spy).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-.*T.*Z \[app\] caution$/), '');
    spy.mockRestore();
  });

  it('logs error messages with timestamp and prefix', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logger = createLogger('svc');

    logger.error('failure');

    expect(spy).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-.*T.*Z \[svc\] failure$/), '');
    spy.mockRestore();
  });

  it('logs debug messages with timestamp and prefix', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const logger = createLogger('dbg');

    logger.debug('trace');

    expect(spy).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-.*T.*Z \[dbg\] trace$/), '');
    spy.mockRestore();
  });

  it('passes metadata when provided', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createLogger('api');
    const meta = { userId: '123' };

    logger.info('request', meta);

    expect(spy).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-.*T.*Z \[api\] request$/), meta);
    spy.mockRestore();
  });
});
