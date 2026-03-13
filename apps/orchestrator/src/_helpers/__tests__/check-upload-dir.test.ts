import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockMkdir = vi.fn();
const mockAccess = vi.fn();

vi.mock('node:fs/promises', () => ({
  mkdir: (...args: unknown[]) => mockMkdir(...args),
  access: (...args: unknown[]) => mockAccess(...args),
  constants: { W_OK: 2 },
}));

const { checkUploadDir } = await import('../check-upload-dir');

describe('checkUploadDir', () => {
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockMkdir.mockResolvedValue(undefined);
    mockAccess.mockResolvedValue(undefined);
  });

  it('creates the directory recursively', async () => {
    await checkUploadDir('/data/uploads', logger);

    expect(mockMkdir).toHaveBeenCalledWith('/data/uploads', { recursive: true });
  });

  it('checks write access', async () => {
    await checkUploadDir('/data/uploads', logger);

    expect(mockAccess).toHaveBeenCalledWith('/data/uploads', 2);
  });

  it('logs info on success', async () => {
    await checkUploadDir('/data/uploads', logger);

    expect(logger.info).toHaveBeenCalledWith('Upload directory verified', { dir: '/data/uploads' });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('logs warning when mkdir fails', async () => {
    mockMkdir.mockRejectedValue(new Error('Permission denied'));

    await checkUploadDir('/data/uploads', logger);

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Permission denied'));
  });

  it('logs warning when access check fails', async () => {
    mockAccess.mockRejectedValue(new Error('EACCES'));

    await checkUploadDir('/data/uploads', logger);

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('EACCES'));
  });

  it('handles non-Error thrown values', async () => {
    mockMkdir.mockRejectedValue('string error');

    await checkUploadDir('/data/uploads', logger);

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('string error'));
  });

  it('does not throw on failure', async () => {
    mockMkdir.mockRejectedValue(new Error('fail'));

    await expect(checkUploadDir('/data/uploads', logger)).resolves.toBeUndefined();
  });
});
