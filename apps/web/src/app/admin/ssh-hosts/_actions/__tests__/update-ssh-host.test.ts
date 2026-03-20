import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUpdate = vi.fn();
const mockRevalidatePath = vi.fn();
const mockEncryptValue = vi.fn((val: string, _key: string) => `encrypted:${val}`);
const mockLoadEnv = vi.fn(() => ({ HARNESS_ENCRYPTION_KEY: 'a'.repeat(64) }));
const mockLogServerError = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    sshHost: {
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

vi.mock('@harness/plugin-contract', () => ({
  encryptValue: (val: string, key: string) => mockEncryptValue(val, key),
}));

vi.mock('@/app/_helpers/env', () => ({
  loadEnv: () => mockLoadEnv(),
}));

vi.mock('@/lib/log-server-error', () => ({
  logServerError: (...args: unknown[]) => mockLogServerError(...args),
}));

const { updateSshHost } = await import('../update-ssh-host');

const validInput = {
  id: 'host-1',
  name: 'My Server',
  hostname: 'example.com',
  port: 22,
  username: 'admin',
  authMethod: 'key',
  tags: [],
};

describe('updateSshHost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadEnv.mockReturnValue({ HARNESS_ENCRYPTION_KEY: 'a'.repeat(64) });
    mockEncryptValue.mockImplementation((val: string) => `encrypted:${val}`);
  });

  it('updates host and returns success', async () => {
    mockUpdate.mockResolvedValue({});

    const result = await updateSshHost(validInput);

    expect(result).toEqual({ success: true });
  });

  it('calls prisma.sshHost.update with correct data', async () => {
    mockUpdate.mockResolvedValue({});

    await updateSshHost(validInput);

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'host-1' },
      data: {
        name: 'My Server',
        hostname: 'example.com',
        port: 22,
        username: 'admin',
        authMethod: 'key',
        tags: [],
      },
    });
  });

  it('revalidates /admin/ssh-hosts on success', async () => {
    mockUpdate.mockResolvedValue({});

    await updateSshHost(validInput);

    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/ssh-hosts');
  });

  describe('validation', () => {
    it('returns error when name is empty', async () => {
      const result = await updateSshHost({ ...validInput, name: '' });

      expect(result).toEqual({ error: 'Name is required' });
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('returns error when name is whitespace only', async () => {
      const result = await updateSshHost({ ...validInput, name: '   ' });

      expect(result).toEqual({ error: 'Name is required' });
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('returns error when hostname is empty', async () => {
      const result = await updateSshHost({ ...validInput, hostname: '' });

      expect(result).toEqual({ error: 'Hostname is required' });
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('returns error when username is empty', async () => {
      const result = await updateSshHost({ ...validInput, username: '' });

      expect(result).toEqual({ error: 'Username is required' });
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('returns error when port is below 1', async () => {
      const result = await updateSshHost({ ...validInput, port: 0 });

      expect(result).toEqual({ error: 'Port must be between 1 and 65535' });
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('returns error when port exceeds 65535', async () => {
      const result = await updateSshHost({ ...validInput, port: 65536 });

      expect(result).toEqual({ error: 'Port must be between 1 and 65535' });
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('returns error when hostname has invalid format', async () => {
      const result = await updateSshHost({ ...validInput, hostname: 'bad hostname!' });

      expect(result).toEqual({
        error: 'Invalid hostname format. Use an IP address or domain name.',
      });
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  describe('privateKey handling', () => {
    it('encrypts and includes privateKey when a non-empty value is provided', async () => {
      mockUpdate.mockResolvedValue({});

      await updateSshHost({ ...validInput, privateKey: 'my-private-key' });

      expect(mockEncryptValue).toHaveBeenCalledWith('my-private-key', 'a'.repeat(64));
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ privateKey: 'encrypted:my-private-key' }),
        }),
      );
    });

    it('skips privateKey update when empty string is provided', async () => {
      mockUpdate.mockResolvedValue({});

      await updateSshHost({ ...validInput, privateKey: '' });

      expect(mockEncryptValue).not.toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({ privateKey: expect.anything() }),
        }),
      );
    });

    it('skips privateKey update when privateKey is undefined', async () => {
      mockUpdate.mockResolvedValue({});

      await updateSshHost(validInput);

      expect(mockEncryptValue).not.toHaveBeenCalled();
    });

    it('returns error when HARNESS_ENCRYPTION_KEY is not set and privateKey is provided', async () => {
      mockLoadEnv.mockReturnValue({ HARNESS_ENCRYPTION_KEY: undefined as unknown as string });

      const result = await updateSshHost({ ...validInput, privateKey: 'my-key' });

      expect(result).toEqual({
        error: 'Cannot store private key: HARNESS_ENCRYPTION_KEY is not configured',
      });
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('returns error when encryptValue throws', async () => {
      mockEncryptValue.mockImplementation(() => {
        throw new Error('bad key format');
      });

      const result = await updateSshHost({ ...validInput, privateKey: 'my-key' });

      expect(result).toEqual({
        error: 'Failed to encrypt private key — check HARNESS_ENCRYPTION_KEY format',
      });
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  describe('database errors', () => {
    it('returns friendly error when unique constraint is violated', async () => {
      mockUpdate.mockRejectedValue(new Error('Unique constraint failed on the fields: (`name`)'));

      const result = await updateSshHost(validInput);

      expect(result).toEqual({ error: 'An SSH host named "My Server" already exists' });
    });

    it('returns generic error for other database failures', async () => {
      mockUpdate.mockRejectedValue(new Error('Connection refused'));

      const result = await updateSshHost(validInput);

      expect(result).toEqual({ error: 'Failed to update SSH host' });
    });

    it('logs error when database throws', async () => {
      const dbError = new Error('Connection refused');
      mockUpdate.mockRejectedValue(dbError);

      await updateSshHost(validInput);

      expect(mockLogServerError).toHaveBeenCalledWith(expect.objectContaining({ action: 'updateSshHost', error: dbError }));
    });

    it('does not revalidate when database throws', async () => {
      mockUpdate.mockRejectedValue(new Error('DB error'));

      await updateSshHost(validInput);

      expect(mockRevalidatePath).not.toHaveBeenCalled();
    });
  });
});
