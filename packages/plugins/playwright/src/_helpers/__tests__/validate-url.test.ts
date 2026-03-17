import { describe, expect, it } from 'vitest';
import { validateUrl } from '../validate-url';

describe('validateUrl', () => {
  it('accepts http URLs', () => {
    expect(validateUrl('http://example.com')).toEqual({ valid: true });
  });

  it('accepts https URLs', () => {
    expect(validateUrl('https://example.com/path?q=1')).toEqual({ valid: true });
  });

  it('rejects file:// scheme', () => {
    const result = validateUrl('file:///etc/passwd');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Blocked scheme');
  });

  it('rejects data: scheme', () => {
    const result = validateUrl('data:text/html,<h1>hi</h1>');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Blocked scheme');
  });

  it('rejects javascript: scheme', () => {
    const result = validateUrl('javascript:alert(1)');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Blocked scheme');
  });

  it('rejects ftp scheme', () => {
    const result = validateUrl('ftp://files.example.com');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Unsupported scheme');
  });

  it('rejects invalid URL format', () => {
    const result = validateUrl('not-a-url');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Invalid URL format');
  });

  it('rejects localhost', () => {
    const result = validateUrl('http://localhost:3000');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('private/internal');
  });

  it('rejects 127.x.x.x', () => {
    const result = validateUrl('http://127.0.0.1:8080');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('private/internal');
  });

  it('rejects 10.x.x.x', () => {
    const result = validateUrl('http://10.0.0.1');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('private/internal');
  });

  it('rejects 172.16-31.x.x', () => {
    const result = validateUrl('http://172.16.0.1');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('private/internal');
  });

  it('accepts 172.32.x.x (not private range)', () => {
    expect(validateUrl('http://172.32.0.1')).toEqual({ valid: true });
  });

  it('rejects 192.168.x.x', () => {
    const result = validateUrl('http://192.168.1.1');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('private/internal');
  });

  it('rejects 169.254.x.x (link-local)', () => {
    const result = validateUrl('http://169.254.1.1');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('private/internal');
  });

  it('rejects IPv6 loopback', () => {
    const result = validateUrl('http://[::1]:3000');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('private/internal');
  });
});
