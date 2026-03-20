import { beforeEach, describe, expect, it, vi } from 'vitest';
import { plugin } from '../index';

vi.mock('../_helpers/browser-manager', () => ({
  launchBrowser: vi.fn().mockResolvedValue(undefined),
  closeBrowser: vi.fn().mockResolvedValue(undefined),
  closePageForThread: vi.fn().mockResolvedValue(undefined),
  getPage: vi.fn(),
}));

vi.mock('../_helpers/temp-tracker', () => ({
  cleanupTrace: vi.fn(),
  cleanupAll: vi.fn(),
  ensureTraceDir: vi.fn(),
  trackFile: vi.fn(),
}));

vi.mock('../_helpers/video-recording', () => ({
  startRecording: vi.fn(),
  stopRecording: vi.fn(),
  cleanupRecordingState: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../_helpers/validate-pages', () => ({
  validatePages: vi.fn(),
}));

import { closeBrowser, closePageForThread, launchBrowser } from '../_helpers/browser-manager';
import { cleanupAll, cleanupTrace } from '../_helpers/temp-tracker';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('playwright plugin', () => {
  it('has correct name and version', () => {
    expect(plugin.name).toBe('playwright');
    expect(plugin.version).toBe('1.0.0');
  });

  it('exports 11 tools', () => {
    expect(plugin.tools).toHaveLength(11);
    const names = plugin.tools?.map((t) => t.name) ?? [];
    expect(names).toEqual([
      'navigate',
      'snapshot',
      'click',
      'fill',
      'select_option',
      'check',
      'screenshot',
      'press_key',
      'start_recording',
      'stop_recording',
      'validate_pages',
    ]);
  });

  it('all tools have description and schema', () => {
    for (const tool of plugin.tools ?? []) {
      expect(tool.description).toBeTruthy();
      expect(tool.schema).toBeTruthy();
      expect(typeof tool.handler).toBe('function');
    }
  });

  it('start launches the browser', async () => {
    const ctx = { logger: { info: vi.fn() } } as never;
    await plugin.start?.(ctx);
    expect(launchBrowser).toHaveBeenCalled();
  });

  it('stop closes browser and cleans up', async () => {
    const ctx = { logger: { info: vi.fn() } } as never;
    await plugin.stop?.(ctx);
    expect(closeBrowser).toHaveBeenCalled();
    expect(cleanupAll).toHaveBeenCalled();
  });

  it('register returns onPipelineComplete hook', async () => {
    const ctx = {} as never;
    const hooks = await plugin.register(ctx);
    expect(hooks.onPipelineComplete).toBeDefined();
  });

  it('onPipelineComplete cleans up trace and closes page', async () => {
    const ctx = {} as never;
    const hooks = await plugin.register(ctx);
    await hooks.onPipelineComplete?.('thread-1', {
      invokeResult: { output: '', durationMs: 100, exitCode: 0, traceId: 'trace-abc' },
      pipelineSteps: [],
      streamEvents: [],
    });

    expect(cleanupTrace).toHaveBeenCalledWith('trace-abc');
    expect(closePageForThread).toHaveBeenCalledWith('thread-1');
  });

  it('onPipelineComplete handles missing traceId', async () => {
    const ctx = {} as never;
    const hooks = await plugin.register(ctx);
    await hooks.onPipelineComplete?.('thread-1', {
      invokeResult: { output: '', durationMs: 100, exitCode: 0 },
      pipelineSteps: [],
      streamEvents: [],
    });

    expect(cleanupTrace).not.toHaveBeenCalled();
    expect(closePageForThread).toHaveBeenCalledWith('thread-1');
  });
});
