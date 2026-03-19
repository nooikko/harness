import pino from 'pino';
import { describe, expect, it } from 'vitest';
import { createHttpLogger } from '../create-http-logger';

describe('createHttpLogger', () => {
  const pinoInstance = pino({ level: 'silent' });

  it('returns a function (middleware)', () => {
    const middleware = createHttpLogger({ pinoInstance });
    expect(typeof middleware).toBe('function');
  });

  it('middleware accepts req, res, next arguments', () => {
    const middleware = createHttpLogger({ pinoInstance });
    // pino-http middleware has arity of 3 (req, res, next)
    expect(middleware.length).toBe(3);
  });

  it('does not throw when created with a child logger', () => {
    const child = pinoInstance.child({ prefix: 'test' });
    expect(() => createHttpLogger({ pinoInstance: child })).not.toThrow();
  });
});
