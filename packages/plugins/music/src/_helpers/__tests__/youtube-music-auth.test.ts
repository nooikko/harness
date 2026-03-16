import type { OAuthStoredCredentials } from '@harness/plugin-contract';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAccountInfo, initWithCredentials, pollDeviceCodeFlow, resetFlowState, startDeviceCodeFlow } from '../youtube-music-auth';

describe('youtube-music-auth', () => {
  afterEach(() => {
    resetFlowState();
    vi.clearAllMocks();
  });

  const createMockInnertube = () => {
    const listeners = new Map<string, ((...args: unknown[]) => void)[]>();
    return {
      session: {
        logged_in: false,
        on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
          const existing = listeners.get(event) ?? [];
          existing.push(cb);
          listeners.set(event, existing);
        }),
        signIn: vi.fn(async () => {}),
        signOut: vi.fn(async () => {}),
        oauth: {
          cacheCredentials: vi.fn(async () => {}),
          removeCache: vi.fn(async () => {}),
        },
      },
      account: {
        getInfo: vi.fn(async () => ({
          contents: {
            sections: [
              {
                contents: [
                  {
                    account_name: { toString: () => 'Test User' },
                    account_email: { toString: () => 'test@example.com' },
                    account_photo: [{ url: 'https://photo.jpg' }],
                  },
                ],
              },
            ],
          },
        })),
      },
      _emit: (event: string, ...args: unknown[]) => {
        const cbs = listeners.get(event) ?? [];
        for (const cb of cbs) {
          cb(...args);
        }
      },
    };
  };

  describe('initWithCredentials', () => {
    it('calls signIn with mapped OAuth credentials', async () => {
      const innertube = createMockInnertube();
      const credentials: OAuthStoredCredentials = {
        authMethod: 'oauth',
        accessToken: 'access-123',
        refreshToken: 'refresh-456',
        expiresAt: '2026-12-31T00:00:00Z',
      };

      await initWithCredentials(innertube, credentials);

      expect(innertube.session.signIn).toHaveBeenCalledWith(
        expect.objectContaining({
          access_token: 'access-123',
          refresh_token: 'refresh-456',
          expiry_date: '2026-12-31T00:00:00Z',
        }),
      );
    });

    it('returns early for cookie auth method', async () => {
      const innertube = createMockInnertube();
      const credentials: OAuthStoredCredentials = {
        authMethod: 'cookie',
      };

      await initWithCredentials(innertube, credentials);

      expect(innertube.session.signIn).not.toHaveBeenCalled();
    });

    it('returns early when accessToken is missing', async () => {
      const innertube = createMockInnertube();
      const credentials: OAuthStoredCredentials = {
        authMethod: 'oauth',
        refreshToken: 'refresh-456',
      };

      await initWithCredentials(innertube, credentials);

      expect(innertube.session.signIn).not.toHaveBeenCalled();
    });

    it('returns early when refreshToken is missing', async () => {
      const innertube = createMockInnertube();
      const credentials: OAuthStoredCredentials = {
        authMethod: 'oauth',
        accessToken: 'access-123',
      };

      await initWithCredentials(innertube, credentials);

      expect(innertube.session.signIn).not.toHaveBeenCalled();
    });

    it('spreads providerMeta into OAuth credentials', async () => {
      const innertube = createMockInnertube();
      const credentials: OAuthStoredCredentials = {
        authMethod: 'oauth',
        accessToken: 'access-123',
        refreshToken: 'refresh-456',
        providerMeta: { client_id: 'abc', client_secret: 'def' },
      };

      await initWithCredentials(innertube, credentials);

      expect(innertube.session.signIn).toHaveBeenCalledWith(
        expect.objectContaining({
          client_id: 'abc',
          client_secret: 'def',
        }),
      );
    });

    it('registers update-credentials listener', async () => {
      const innertube = createMockInnertube();
      const credentials: OAuthStoredCredentials = {
        authMethod: 'oauth',
        accessToken: 'access-123',
        refreshToken: 'refresh-456',
      };

      await initWithCredentials(innertube, credentials);

      expect(innertube.session.on).toHaveBeenCalledWith('update-credentials', expect.any(Function));
    });
  });

  describe('startDeviceCodeFlow', () => {
    it('resolves with device code data when auth-pending fires', async () => {
      const innertube = createMockInnertube();
      innertube.session.signIn.mockImplementation(async () => {
        innertube._emit('auth-pending', {
          user_code: 'ABCD-EFGH',
          verification_url: 'https://google.com/device',
          interval: 5,
          expires_in: 300,
        });
      });

      const result = await startDeviceCodeFlow(innertube);

      expect(result).toEqual({
        userCode: 'ABCD-EFGH',
        verificationUrl: 'https://google.com/device',
        interval: 5,
        expiresIn: 300,
      });
    });

    it('uses default values when interval and expires_in are missing', async () => {
      const innertube = createMockInnertube();
      innertube.session.signIn.mockImplementation(async () => {
        innertube._emit('auth-pending', {
          user_code: 'XYZ',
          verification_url: 'https://google.com/device',
        });
      });

      const result = await startDeviceCodeFlow(innertube);

      expect(result.interval).toBe(5);
      expect(result.expiresIn).toBe(300);
    });

    it('rejects when signIn throws before auth-pending', async () => {
      const innertube = createMockInnertube();
      innertube.session.signIn.mockRejectedValue(new Error('Network error'));

      await expect(startDeviceCodeFlow(innertube)).rejects.toThrow('Network error');
    });
  });

  describe('pollDeviceCodeFlow', () => {
    it('returns pending when no flow result yet', () => {
      const result = pollDeviceCodeFlow();
      expect(result.status).toBe('pending');
    });

    it('returns completed with credentials when auth fires', async () => {
      const innertube = createMockInnertube();
      innertube.session.signIn.mockImplementation(async () => {
        innertube._emit('auth-pending', {
          user_code: 'CODE',
          verification_url: 'https://google.com/device',
        });
        // Simulate auth completion after a tick
        setTimeout(() => {
          innertube._emit('auth', {
            credentials: {
              access_token: 'new-access',
              refresh_token: 'new-refresh',
              expiry_date: '2026-12-31T00:00:00Z',
            },
          });
        }, 10);
      });

      await startDeviceCodeFlow(innertube);

      // Wait for the auth event
      await new Promise((r) => setTimeout(r, 20));

      const result = pollDeviceCodeFlow();
      expect(result.status).toBe('completed');
      expect(result.credentials?.access_token).toBe('new-access');
    });

    it('returns error when auth-error fires', async () => {
      const innertube = createMockInnertube();
      innertube.session.signIn.mockImplementation(async () => {
        innertube._emit('auth-pending', {
          user_code: 'CODE',
          verification_url: 'https://google.com/device',
        });
        setTimeout(() => {
          innertube._emit('auth-error', new Error('Auth failed'));
        }, 10);
      });

      await startDeviceCodeFlow(innertube);
      await new Promise((r) => setTimeout(r, 20));

      const result = pollDeviceCodeFlow();
      expect(result.status).toBe('error');
      expect(result.error).toBe('Auth failed');
    });

    it('clears error after reading it', async () => {
      const innertube = createMockInnertube();
      innertube.session.signIn.mockImplementation(async () => {
        innertube._emit('auth-pending', {
          user_code: 'CODE',
          verification_url: 'https://google.com/device',
        });
        setTimeout(() => {
          innertube._emit('auth-error', 'Some error');
        }, 10);
      });

      await startDeviceCodeFlow(innertube);
      await new Promise((r) => setTimeout(r, 20));

      pollDeviceCodeFlow(); // reads the error
      const result2 = pollDeviceCodeFlow();
      expect(result2.status).toBe('pending');
    });
  });

  describe('getAccountInfo', () => {
    it('returns account info when logged in', async () => {
      const innertube = createMockInnertube();
      innertube.session.logged_in = true;

      const info = await getAccountInfo(innertube);

      expect(info).toEqual({
        email: 'test@example.com',
        name: 'Test User',
        photo: 'https://photo.jpg',
      });
    });

    it('returns null when not logged in', async () => {
      const innertube = createMockInnertube();
      innertube.session.logged_in = false;

      const info = await getAccountInfo(innertube);
      expect(info).toBeNull();
    });

    it('returns null when account.getInfo is missing', async () => {
      const innertube = createMockInnertube();
      innertube.session.logged_in = true;
      innertube.account = {} as never;

      const info = await getAccountInfo(innertube as unknown as Parameters<typeof getAccountInfo>[0]);
      expect(info).toBeNull();
    });

    it('returns null when account info has no sections', async () => {
      const innertube = createMockInnertube();
      innertube.session.logged_in = true;
      innertube.account.getInfo = vi.fn(async () => ({
        contents: { sections: [] },
      }));

      const info = await getAccountInfo(innertube);
      expect(info).toBeNull();
    });

    it('returns null when getInfo throws', async () => {
      const innertube = createMockInnertube();
      innertube.session.logged_in = true;
      innertube.account.getInfo = vi.fn(async () => {
        throw new Error('Network error');
      });

      const info = await getAccountInfo(innertube);
      expect(info).toBeNull();
    });
  });

  describe('resetFlowState', () => {
    it('resets flow state so poll returns pending', async () => {
      const innertube = createMockInnertube();
      innertube.session.signIn.mockImplementation(async () => {
        innertube._emit('auth-pending', {
          user_code: 'CODE',
          verification_url: 'https://google.com/device',
        });
        setTimeout(() => {
          innertube._emit('auth', {
            credentials: { access_token: 'x', refresh_token: 'y', expiry_date: 'z' },
          });
        }, 10);
      });

      await startDeviceCodeFlow(innertube);
      await new Promise((r) => setTimeout(r, 20));

      resetFlowState();
      const result = pollDeviceCodeFlow();
      expect(result.status).toBe('pending');
    });
  });
});
