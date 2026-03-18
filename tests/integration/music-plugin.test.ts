import { PrismaClient } from '@harness/database';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TestHarness } from './helpers/create-harness';
import { createTestHarness } from './helpers/create-harness';
import { requireTestDatabaseUrl } from './setup/require-test-db';
import { resetDatabase } from './setup/reset-db';

// Mock youtubei.js — the core npm dependency for YouTube Music. The
// music plugin calls Innertube.create() on start() which makes HTTP calls.
vi.mock('youtubei.js', () => {
  const mockInnertube = {
    music: {
      search: vi.fn().mockResolvedValue({
        songs: {
          contents: [
            {
              id: 'dQw4w9WgXcQ',
              title: { toString: () => 'Never Gonna Give You Up' },
              artists: [{ name: 'Rick Astley' }],
              album: { name: 'Whenever You Need Somebody' },
              duration: { seconds: 213, toString: () => '3:33' },
              thumbnails: [{ url: 'https://i.ytimg.com/default.jpg' }],
            },
          ],
        },
      }),
      getLibrary: vi.fn().mockResolvedValue({ contents: [] }),
      getPlaylist: vi.fn().mockResolvedValue({ contents: [] }),
    },
    session: { logged_in: false },
  };

  return {
    default: {
      create: vi.fn().mockResolvedValue(mockInnertube),
    },
    UniversalCache: vi.fn(),
  };
});

// Mock Cast device discovery (bonjour/mDNS) — requires network access
vi.mock('bonjour-service', () => ({
  default: vi.fn().mockImplementation(() => ({
    find: vi.fn().mockReturnValue({
      on: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    }),
    destroy: vi.fn(),
  })),
}));

// Mock Cast client (castv2) — requires LAN device access
vi.mock('castv2-client', () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    close: vi.fn(),
    on: vi.fn(),
  })),
  DefaultMediaReceiver: vi.fn(),
}));

const { musicPlugin } = await import('@harness/plugin-music');

const prisma = new PrismaClient({ datasourceUrl: requireTestDatabaseUrl() });

beforeEach(async () => {
  await resetDatabase(prisma);
  vi.clearAllMocks();
});

afterAll(async () => {
  await prisma.$disconnect();
});

const getTool = (name: string) => {
  const tool = musicPlugin.tools!.find((t) => t.name === name)!;
  if (!tool) {
    throw new Error(`Tool "${name}" not found in music plugin`);
  }
  return tool;
};

const makeMeta = (threadId: string) => ({
  threadId,
  traceId: 'test-trace',
});

describe('music plugin integration', () => {
  let harness: TestHarness;

  afterEach(async () => {
    await harness?.cleanup();
  });

  it('registers and starts without throwing', async () => {
    await expect(
      createTestHarness(musicPlugin).then((h) => {
        harness = h;
        return h;
      }),
    ).resolves.toBeDefined();
  });

  it('search tool returns formatted results', async () => {
    harness = await createTestHarness(musicPlugin);
    const ctx = harness.orchestrator.getContext();

    const tool = getTool('search');
    const result = await tool.handler(ctx, { query: 'never gonna give you up' }, makeMeta(harness.threadId));

    const text = typeof result === 'string' ? result : result.text;
    expect(text).toContain('Never Gonna Give You Up');
    expect(text).toContain('Rick Astley');
  });

  it('play tool requires either query or videoId', async () => {
    harness = await createTestHarness(musicPlugin);
    const ctx = harness.orchestrator.getContext();

    const tool = getTool('play');
    const result = await tool.handler(ctx, {}, makeMeta(harness.threadId));

    expect(result).toContain('Please provide either a search query or a videoId');
  });

  it('my_playlists returns auth prompt when not logged in', async () => {
    harness = await createTestHarness(musicPlugin);
    const ctx = harness.orchestrator.getContext();

    const tool = getTool('my_playlists');
    const result = await tool.handler(ctx, {}, makeMeta(harness.threadId));

    expect(result).toContain('Not authenticated');
  });

  it('get_playback_settings returns defaults', async () => {
    harness = await createTestHarness(musicPlugin);
    const ctx = harness.orchestrator.getContext();

    const tool = getTool('get_playback_settings');
    const result = await tool.handler(ctx, {}, makeMeta(harness.threadId));

    expect(result).toContain('Default Volume');
    expect(result).toContain('Radio');
    expect(result).toContain('Audio Quality');
  });

  it('update_playback_settings persists to DB and triggers reload', async () => {
    harness = await createTestHarness(musicPlugin);
    const ctx = harness.orchestrator.getContext();

    const tool = getTool('update_playback_settings');
    const result = await tool.handler(ctx, { defaultVolume: 75, radioEnabled: false }, makeMeta(harness.threadId));

    expect(result).toContain('Settings updated');
    expect(result).toContain('75%');
    expect(result).toContain('disabled');

    // Verify the settings were written to the database
    const config = await prisma.pluginConfig.findUnique({
      where: { pluginName: 'music' },
    });
    expect(config).toBeDefined();
    const settings = config!.settings as Record<string, unknown>;
    expect(settings.defaultVolume).toBe(75);
    expect(settings.radioEnabled).toBe(false);
  });
});
