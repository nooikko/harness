import { describe, expect, it } from 'vitest';
import { assertTestDatabaseUrl } from '../assert-test-database-url';

describe('assertTestDatabaseUrl', () => {
  it('accepts a localhost testcontainer URL', () => {
    const url = 'postgresql://test:test@localhost:54321/test?schema=public';
    expect(() => assertTestDatabaseUrl(url)).not.toThrow();
  });

  it('accepts a 127.0.0.1 testcontainer URL', () => {
    const url = 'postgresql://test:test@127.0.0.1:54321/test';
    expect(() => assertTestDatabaseUrl(url)).not.toThrow();
  });

  it('rejects a remote database URL', () => {
    const url = 'postgresql://user:pass@db.example.com:5432/harness';
    expect(() => assertTestDatabaseUrl(url)).toThrow('does not point to localhost');
  });

  it('rejects a Supabase-style URL', () => {
    const url = 'postgresql://postgres:pass@db.supabase.co:5432/postgres';
    expect(() => assertTestDatabaseUrl(url)).toThrow('does not point to localhost');
  });

  it('rejects an empty string', () => {
    expect(() => assertTestDatabaseUrl('')).toThrow('DATABASE_URL is empty');
  });
});
