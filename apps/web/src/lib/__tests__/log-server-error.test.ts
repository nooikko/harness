import { describe, expect, it, vi } from 'vitest';

// Mock @harness/logger before importing
vi.mock('@harness/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { logServerError } from '../log-server-error';

describe('logServerError', () => {
  it('does not throw when called with an Error', () => {
    expect(() =>
      logServerError({
        action: 'testAction',
        error: new Error('test error'),
      }),
    ).not.toThrow();
  });

  it('does not throw when called with a string error', () => {
    expect(() =>
      logServerError({
        action: 'testAction',
        error: 'string error',
      }),
    ).not.toThrow();
  });

  it('does not throw when called with context', () => {
    expect(() =>
      logServerError({
        action: 'testAction',
        error: new Error('test'),
        context: { threadId: 't1', fileName: 'file.txt' },
      }),
    ).not.toThrow();
  });

  it('does not throw when called with null error', () => {
    expect(() =>
      logServerError({
        action: 'testAction',
        error: null,
      }),
    ).not.toThrow();
  });
});
