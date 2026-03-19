import { afterEach, describe, expect, it, vi } from 'vitest';
import { startSyncTimer, stopSyncTimer } from '../start-sync-timer';

const mockOutlookSync = vi.fn().mockResolvedValue(undefined);
const mockGoogleSync = vi.fn().mockResolvedValue(undefined);
const mockProject = vi.fn().mockResolvedValue(undefined);

vi.mock('../sync-outlook-calendars', () => ({
  syncOutlookCalendars: (...args: unknown[]) => mockOutlookSync(...args),
}));
vi.mock('../sync-google-calendars', () => ({
  syncGoogleCalendars: (...args: unknown[]) => mockGoogleSync(...args),
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
    expect(ctx.logger.info).toHaveBeenCalledWith(expect.stringContaining('sync timers started'));
  });

  it('stopSyncTimer clears active intervals', () => {
    const clearSpy = vi.spyOn(globalThis, 'clearInterval');
    startSyncTimer(ctx);
    stopSyncTimer();
    expect(clearSpy).toHaveBeenCalledTimes(3); // outlook + google + projection
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
    // stopSyncTimer is called inside startSyncTimer, which clears 3 intervals
    expect(clearSpy).toHaveBeenCalledTimes(3);
    clearSpy.mockRestore();
  });

  it('google sync timer fires at 5-minute interval', async () => {
    vi.useFakeTimers();
    mockGoogleSync.mockResolvedValueOnce(undefined);

    startSyncTimer(ctx);
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    stopSyncTimer();

    expect(mockGoogleSync).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('outlook sync timer fires at 30-minute interval', async () => {
    vi.useFakeTimers();
    mockOutlookSync.mockResolvedValueOnce(undefined);

    startSyncTimer(ctx);
    await vi.advanceTimersByTimeAsync(30 * 60 * 1000);
    stopSyncTimer();

    expect(mockOutlookSync).toHaveBeenCalledTimes(1);
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

  it('outlook sync timer catches errors', async () => {
    vi.useFakeTimers();
    mockOutlookSync.mockRejectedValueOnce(new Error('sync failed'));

    startSyncTimer(ctx);
    await vi.advanceTimersByTimeAsync(30 * 60 * 1000);
    stopSyncTimer();

    expect(ctx.logger.warn).toHaveBeenCalledWith(expect.stringContaining('outlook sync timer error'));
    vi.useRealTimers();
  });

  it('google sync timer catches errors', async () => {
    vi.useFakeTimers();
    mockGoogleSync.mockRejectedValueOnce(new Error('sync failed'));

    startSyncTimer(ctx);
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    stopSyncTimer();

    expect(ctx.logger.warn).toHaveBeenCalledWith(expect.stringContaining('google sync timer error'));
    vi.useRealTimers();
  });

  it('projection timer catches errors', async () => {
    vi.useFakeTimers();
    mockProject.mockRejectedValueOnce(new Error('projection failed'));

    startSyncTimer(ctx);
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    stopSyncTimer();

    expect(ctx.logger.warn).toHaveBeenCalledWith(expect.stringContaining('projection timer error'));
    vi.useRealTimers();
  });
});
