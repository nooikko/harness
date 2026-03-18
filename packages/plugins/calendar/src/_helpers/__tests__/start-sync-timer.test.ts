import { afterEach, describe, expect, it, vi } from 'vitest';
import { startSyncTimer, stopSyncTimer } from '../start-sync-timer';

const mockSync = vi.fn().mockResolvedValue(undefined);
const mockProject = vi.fn().mockResolvedValue(undefined);

vi.mock('../sync-outlook-calendars', () => ({
  syncOutlookCalendars: (...args: unknown[]) => mockSync(...args),
}));
vi.mock('../project-virtual-events', () => ({
  projectVirtualEvents: (...args: unknown[]) => mockProject(...args),
}));

const ctx = {
  logger: { info: vi.fn(), warn: vi.fn() },
} as unknown as Parameters<typeof startSyncTimer>[0];

describe('startSyncTimer', () => {
  afterEach(() => {
    stopSyncTimer();
    vi.clearAllMocks();
  });

  it('starts timers and logs', () => {
    startSyncTimer(ctx);
    expect(ctx.logger.info).toHaveBeenCalledWith(expect.stringContaining('sync timer started'));
  });

  it('stopSyncTimer clears intervals without error', () => {
    startSyncTimer(ctx);
    expect(() => stopSyncTimer()).not.toThrow();
  });

  it('stopSyncTimer is safe to call when no timer is running', () => {
    expect(() => stopSyncTimer()).not.toThrow();
  });

  it('calling startSyncTimer twice stops the first timer', () => {
    startSyncTimer(ctx);
    startSyncTimer(ctx);
    expect(ctx.logger.info).toHaveBeenCalledTimes(2);
  });

  it('sync timer fires successfully', async () => {
    vi.useFakeTimers();
    mockSync.mockResolvedValueOnce(undefined);

    startSyncTimer(ctx);
    await vi.advanceTimersByTimeAsync(15 * 60 * 1000);
    stopSyncTimer();

    expect(mockSync).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('projection timer fires successfully', async () => {
    vi.useFakeTimers();
    mockProject.mockResolvedValueOnce(undefined);

    startSyncTimer(ctx);
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    stopSyncTimer();

    expect(mockProject).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('sync timer fires and catches sync errors', async () => {
    vi.useFakeTimers();
    mockSync.mockRejectedValueOnce(new Error('sync failed'));

    startSyncTimer(ctx);
    await vi.advanceTimersByTimeAsync(15 * 60 * 1000);
    stopSyncTimer();

    expect(ctx.logger.warn).toHaveBeenCalledWith(expect.stringContaining('sync timer error'));
    vi.useRealTimers();
  });

  it('projection timer fires and catches projection errors', async () => {
    vi.useFakeTimers();
    mockProject.mockRejectedValueOnce(new Error('projection failed'));

    startSyncTimer(ctx);
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    stopSyncTimer();

    expect(ctx.logger.warn).toHaveBeenCalledWith(expect.stringContaining('projection timer error'));
    vi.useRealTimers();
  });
});
