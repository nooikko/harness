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

  it('stopSyncTimer clears active intervals', () => {
    const clearSpy = vi.spyOn(globalThis, 'clearInterval');
    startSyncTimer(ctx);
    stopSyncTimer();
    expect(clearSpy).toHaveBeenCalledTimes(2); // sync + projection
    clearSpy.mockRestore();
  });

  it('stopSyncTimer is a no-op when no timer is running', () => {
    const clearSpy = vi.spyOn(globalThis, 'clearInterval');
    stopSyncTimer();
    expect(clearSpy).not.toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it('calling startSyncTimer twice clears the first set of intervals', () => {
    const clearSpy = vi.spyOn(globalThis, 'clearInterval');
    startSyncTimer(ctx);
    startSyncTimer(ctx); // should clear previous intervals before setting new ones
    // stopSyncTimer is called inside startSyncTimer, which clears 2 intervals
    expect(clearSpy).toHaveBeenCalledTimes(2);
    clearSpy.mockRestore();
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
