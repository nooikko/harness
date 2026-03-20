import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreate = vi.fn();
const mockRevalidatePath = vi.fn();
const mockEncryptValue = vi.fn((val: string, _key: string) => `encrypted:${val}`);
const mockLoadEnv = vi.fn(() => ({ HARNESS_ENCRYPTION_KEY: 'a'.repeat(64) }));
const mockLogServerError = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    sshHost: {
      create: (...args: unknown[]) => mockCreate(...args),
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

const { createSshHost } = await import('../create-ssh-host');

const validInput = {
  name: 'My Server',
  hostname: 'example.com',
  port: 22,
  username: 'admin',
  authMethod: 'key',
  tags: [],
};

describe('createSshHost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadEnv.mockReturnValue({ HARNESS_ENCRYPTION_KEY: 'a'.repeat(64) });
    mockEncryptValue.mockImplementation((val: string) => `encrypted:${val}`);
  });

  it('creates host and returns success with id', async () => {
    mockCreate.mockResolvedValue({ id: 'host-1' });

    const result = await createSshHost(validInput);

    expect(result).toEqual({ success: true, id: 'host-1' });
  });

  it('calls prisma.sshHost.create with correct data', async () => {
    mockCreate.mockResolvedValue({ id: 'host-1' });

    await createSshHost(validInput);

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        name: 'My Server',
        hostname: 'example.com',
        port: 22,
        username: 'admin',
        authMethod: 'key',
        privateKey: null,
        tags: [],
        enabled: true,
      },
    });
  });

  it('revalidates /admin/ssh-hosts on success', async () => {
    mockCreate.mockResolvedValue({ id: 'host-1' });

    await createSshHost(validInput);

    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/ssh-hosts');
  });

  describe('validation', () => {
    it('returns error when name is empty', async () => {
      const result = await createSshHost({ ...validInput, name: '' });

      expect(result).toEqual({ error: 'Name is required' });
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('returns error when name is whitespace only', async () => {
      const result = await createSshHost({ ...validInput, name: '   ' });

      expect(result).toEqual({ error: 'Name is required' });
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('returns error when hostname is empty', async () => {
      const result = await createSshHost({ ...validInput, hostname: '' });

      expect(result).toEqual({ error: 'Hostname is required' });
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('returns error when username is empty', async () => {
      const result = await createSshHost({ ...validInput, username: '' });

      expect(result).toEqual({ error: 'Username is required' });
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('returns error when port is below 1', async () => {
      const result = await createSshHost({ ...validInput, port: 0 });

      expect(result).toEqual({ error: 'Port must be between 1 and 65535' });
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('returns error when port exceeds 65535', async () => {
      const result = await createSshHost({ ...validInput, port: 65536 });

      expect(result).toEqual({ error: 'Port must be between 1 and 65535' });
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('returns error when hostname has invalid format', async () => {
      const result = await createSshHost({ ...validInput, hostname: 'bad hostname!' });

      expect(result).toEqual({
        error: 'Invalid hostname format. Use an IP address or domain name.',
      });
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('accepts valid IP address as hostname', async () => {
      mockCreate.mockResolvedValue({ id: 'host-ip' });

      const result = await createSshHost({ ...validInput, hostname: '192.168.1.1' });

      expect(result).toEqual({ success: true, id: 'host-ip' });
    });

    it('accepts valid domain name as hostname', async () => {
      mockCreate.mockResolvedValue({ id: 'host-domain' });

      const result = await createSshHost({ ...validInput, hostname: 'my-server.example.com' });

      expect(result).toEqual({ success: true, id: 'host-domain' });
    });
  });

  describe('privateKey encryption', () => {
    it('encrypts privateKey when provided', async () => {
      mockCreate.mockResolvedValue({ id: 'host-1' });

      await createSshHost({ ...validInput, privateKey: 'my-private-key' });

      expect(mockEncryptValue).toHaveBeenCalledWith('my-private-key', 'a'.repeat(64));
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ privateKey: 'encrypted:my-private-key' }),
        }),
      );
    });

    it('stores null privateKey when not provided', async () => {
      mockCreate.mockResolvedValue({ id: 'host-1' });

      await createSshHost(validInput);

      expect(mockEncryptValue).not.toHaveBeenCalled();
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ privateKey: null }),
        }),
      );
    });

    it('returns error when HARNESS_ENCRYPTION_KEY is not set and privateKey is provided', async () => {
      mockLoadEnv.mockReturnValue({ HARNESS_ENCRYPTION_KEY: undefined as unknown as string });

      const result = await createSshHost({ ...validInput, privateKey: 'my-key' });

      expect(result).toEqual({
        error: 'Cannot store private key: HARNESS_ENCRYPTION_KEY is not configured',
      });
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('returns error when encryptValue throws', async () => {
      mockEncryptValue.mockImplementation(() => {
        throw new Error('bad key format');
      });

      const result = await createSshHost({ ...validInput, privateKey: 'my-key' });

      expect(result).toEqual({
        error: 'Failed to encrypt private key — check HARNESS_ENCRYPTION_KEY format',
      });
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  describe('database errors', () => {
    it('returns friendly error when unique constraint is violated', async () => {
      mockCreate.mockRejectedValue(new Error('Unique constraint failed on the fields: (`name`)'));

      const result = await createSshHost(validInput);

      expect(result).toEqual({ error: 'An SSH host named "My Server" already exists' });
    });

    it('returns generic error for other database failures', async () => {
      mockCreate.mockRejectedValue(new Error('Connection refused'));

      const result = await createSshHost(validInput);

      expect(result).toEqual({ error: 'Failed to create SSH host' });
    });

    it('logs error when database throws', async () => {
      const dbError = new Error('Connection refused');
      mockCreate.mockRejectedValue(dbError);

      await createSshHost(validInput);

      expect(mockLogServerError).toHaveBeenCalledWith(expect.objectContaining({ action: 'createSshHost', error: dbError }));
    });

    it('does not revalidate when database throws', async () => {
      mockCreate.mockRejectedValue(new Error('DB error'));

      await createSshHost(validInput);

      expect(mockRevalidatePath).not.toHaveBeenCalled();
    });
  });
});
