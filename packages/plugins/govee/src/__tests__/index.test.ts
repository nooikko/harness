import type { PluginContext } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../_helpers/govee-client', () => ({
  createGoveeClient: vi.fn(() => ({
    listDevices: vi.fn().mockResolvedValue([]),
    getDeviceState: vi.fn().mockResolvedValue({ sku: '', device: '', capabilities: [] }),
    controlDevice: vi.fn().mockResolvedValue(undefined),
  })),
}));

import { goveePlugin } from '../index';

const makeCtx = (): PluginContext =>
  ({
    db: {},
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    config: {},
    getSettings: vi.fn().mockResolvedValue({}),
    notifySettingsChange: vi.fn(),
    reportStatus: vi.fn(),
    broadcast: vi.fn(),
  }) as unknown as PluginContext;

describe('goveePlugin', () => {
  it('has correct name and version', () => {
    expect(goveePlugin.name).toBe('govee');
    expect(goveePlugin.version).toBe('1.0.0');
  });

  it('exports a settingsSchema', () => {
    expect(goveePlugin.settingsSchema).toBeDefined();
    expect(goveePlugin.settingsSchema?.toFieldArray).toBeDefined();
  });

  it('has settings fields for apiKey, defaultTransitionMs', () => {
    const fields = goveePlugin.settingsSchema?.toFieldArray() ?? [];
    const names = fields.map((f) => f.name);
    expect(names).toContain('apiKey');
    expect(names).toContain('defaultTransitionMs');
  });

  describe('tools', () => {
    const toolNames = [
      'list_devices',
      'set_light',
      'toggle_light',
      'set_scene',
      'list_scenes',
      'set_group',
      'list_groups',
      'create_group',
      'delete_group',
      'get_status',
    ];

    it('registers 10 MCP tools', () => {
      expect(goveePlugin.tools).toHaveLength(10);
    });

    for (const name of toolNames) {
      it(`has tool: ${name}`, () => {
        const tool = goveePlugin.tools?.find((t) => t.name === name);
        expect(tool).toBeDefined();
        expect(tool?.description).toBeTruthy();
        expect(tool?.handler).toBeTypeOf('function');
      });
    }
  });

  describe('lifecycle', () => {
    it('has start function', () => {
      expect(goveePlugin.start).toBeTypeOf('function');
    });

    it('has stop function', () => {
      expect(goveePlugin.stop).toBeTypeOf('function');
    });

    it('start reports degraded when no API key configured', async () => {
      const ctx = makeCtx();
      (ctx.getSettings as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await goveePlugin.start?.(ctx);

      expect(ctx.reportStatus).toHaveBeenCalledWith('degraded', expect.stringContaining('API key'), expect.any(Object));
    });

    it('stop clears state without error', async () => {
      const ctx = makeCtx();
      await goveePlugin.stop?.(ctx);
      expect(ctx.logger.info).toHaveBeenCalledWith(expect.stringContaining('Stopped'));
    });
  });

  describe('register', () => {
    it('returns onSettingsChange hook', async () => {
      const ctx = makeCtx();
      const hooks = await goveePlugin.register(ctx);
      expect(hooks.onSettingsChange).toBeTypeOf('function');
    });

    it('onSettingsChange ignores other plugins', async () => {
      const ctx = makeCtx();
      const hooks = await goveePlugin.register(ctx);
      await hooks.onSettingsChange?.('music');
      expect(ctx.getSettings).not.toHaveBeenCalled();
    });
  });
});
