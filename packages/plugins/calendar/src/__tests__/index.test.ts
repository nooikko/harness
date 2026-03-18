import { beforeEach, describe, expect, it, vi } from 'vitest';
import { plugin } from '../index';

vi.mock('../_helpers/sync-outlook-calendars', () => ({
  syncOutlookCalendars: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../_helpers/project-virtual-events', () => ({
  projectVirtualEvents: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../_helpers/start-sync-timer', () => ({
  startSyncTimer: vi.fn(),
  stopSyncTimer: vi.fn(),
}));

import { projectVirtualEvents } from '../_helpers/project-virtual-events';
import { startSyncTimer, stopSyncTimer } from '../_helpers/start-sync-timer';
import { syncOutlookCalendars } from '../_helpers/sync-outlook-calendars';

const makeCtx = () =>
  ({
    logger: { warn: vi.fn(), info: vi.fn() },
  }) as unknown as Parameters<typeof plugin.register>[0];

describe('plugin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- existing metadata tests ---

  it('has correct name and version', () => {
    expect(plugin.name).toBe('calendar');
    expect(plugin.version).toBe('1.0.0');
  });

  it('defines 6 tools', () => {
    expect(plugin.tools).toHaveLength(6);
  });

  it('has expected tool names', () => {
    const toolNames = plugin.tools!.map((t) => t.name);
    expect(toolNames).toEqual(['create_event', 'update_event', 'delete_event', 'list_events', 'get_event', 'sync_now']);
  });

  it('register returns onSettingsChange hook', async () => {
    const ctx = makeCtx();
    const hooks = await plugin.register(ctx);
    expect(hooks.onSettingsChange).toBeDefined();
  });

  // --- start() ---

  it('start() triggers initial sync and starts timer', async () => {
    const ctx = makeCtx();
    await plugin.start!(ctx);

    await vi.waitFor(() => {
      expect(syncOutlookCalendars).toHaveBeenCalledWith(ctx);
      expect(projectVirtualEvents).toHaveBeenCalledWith(ctx);
    });
    expect(startSyncTimer).toHaveBeenCalledWith(ctx);
  });

  it('start() catches sync errors and still starts timer', async () => {
    const ctx = makeCtx();
    vi.mocked(syncOutlookCalendars).mockRejectedValueOnce(new Error('sync boom'));

    await plugin.start!(ctx);

    await vi.waitFor(() => {
      expect(ctx.logger.warn).toHaveBeenCalledWith(expect.stringContaining('initial sync failed'));
    });
    expect(startSyncTimer).toHaveBeenCalledWith(ctx);
  });

  // --- stop() ---

  it('stop() calls stopSyncTimer', async () => {
    const ctx = makeCtx();
    await plugin.stop!(ctx);
    expect(stopSyncTimer).toHaveBeenCalled();
  });

  // --- onSettingsChange ---

  it("onSettingsChange('calendar') stops timer, syncs, restarts timer", async () => {
    const ctx = makeCtx();
    const hooks = await plugin.register(ctx);

    await hooks.onSettingsChange!('calendar');

    expect(stopSyncTimer).toHaveBeenCalled();
    expect(syncOutlookCalendars).toHaveBeenCalledWith(ctx);
    expect(projectVirtualEvents).toHaveBeenCalledWith(ctx);
    expect(startSyncTimer).toHaveBeenCalledWith(ctx);
  });

  it('onSettingsChange ignores other plugins', async () => {
    const ctx = makeCtx();
    const hooks = await plugin.register(ctx);

    await hooks.onSettingsChange!('cron');

    expect(stopSyncTimer).not.toHaveBeenCalled();
    expect(syncOutlookCalendars).not.toHaveBeenCalled();
    expect(projectVirtualEvents).not.toHaveBeenCalled();
    expect(startSyncTimer).not.toHaveBeenCalled();
  });

  it('onSettingsChange restarts timer even when sync fails', async () => {
    const ctx = makeCtx();
    vi.mocked(syncOutlookCalendars).mockRejectedValueOnce(new Error('settings boom'));
    const hooks = await plugin.register(ctx);

    await hooks.onSettingsChange!('calendar');

    expect(stopSyncTimer).toHaveBeenCalled();
    expect(ctx.logger.warn).toHaveBeenCalledWith(expect.stringContaining('settings change sync failed'));
    expect(startSyncTimer).toHaveBeenCalledWith(ctx);
  });

  // --- sync_now tool ---

  it('sync_now handler returns immediately and triggers background sync', async () => {
    const ctx = makeCtx();
    const syncTool = plugin.tools!.find((t) => t.name === 'sync_now')!;

    const result = await syncTool.handler(ctx, {}, { threadId: 't1' });

    expect(result).toBe('Calendar sync triggered. Results will appear shortly.');

    await vi.waitFor(() => {
      expect(syncOutlookCalendars).toHaveBeenCalledWith(ctx);
      expect(projectVirtualEvents).toHaveBeenCalledWith(ctx);
    });
  });

  it('sync_now handler catches background errors', async () => {
    const ctx = makeCtx();
    vi.mocked(syncOutlookCalendars).mockRejectedValueOnce(new Error('sync tool boom'));
    const syncTool = plugin.tools!.find((t) => t.name === 'sync_now')!;

    const result = await syncTool.handler(ctx, {}, { threadId: 't1' });

    expect(result).toBe('Calendar sync triggered. Results will appear shortly.');

    await vi.waitFor(() => {
      expect(ctx.logger.warn).toHaveBeenCalledWith(expect.stringContaining('sync_now failed'));
    });
  });
});
