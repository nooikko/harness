import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('startOAuthFlow', () => {
  beforeEach(() => {
    vi.stubEnv('MICROSOFT_CLIENT_ID', 'test-client-id');
    vi.stubEnv('MICROSOFT_CLIENT_SECRET', 'test-secret');
    vi.stubEnv('MICROSOFT_TENANT_ID', 'test-tenant');
    vi.stubEnv('MICROSOFT_REDIRECT_URI', 'http://localhost:3000/api/oauth/callback');
  });

  it('generates an auth URL and state for microsoft provider', async () => {
    vi.resetModules();
    const { startOAuthFlow } = await import('../start-oauth-flow');

    const result = startOAuthFlow('microsoft');

    expect(result.state).toHaveLength(64); // 32 bytes hex
    expect(result.authUrl).toContain('login.microsoftonline.com');
    expect(result.authUrl).toContain('test-client-id');
    expect(result.authUrl).toContain('test-tenant');
    expect(result.authUrl).toContain('response_type=code');
  });

  it('throws for unsupported provider', async () => {
    vi.resetModules();
    const { startOAuthFlow } = await import('../start-oauth-flow');

    expect(() => startOAuthFlow('github')).toThrow('Unsupported OAuth provider: github');
  });
});
