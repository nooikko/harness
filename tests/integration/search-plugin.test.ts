import { PrismaClient } from '@harness/database';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TestHarness } from './helpers/create-harness';
import { createTestHarness } from './helpers/create-harness';
import { requireTestDatabaseUrl } from './setup/require-test-db';
import { resetDatabase } from './setup/reset-db';

// Mock the Qdrant vector search layer — all mock values must be inline
// (no top-level const references) because vi.mock is hoisted.
vi.mock('@harness/vector-search', () => ({
  getQdrantClient: vi.fn().mockReturnValue({
    upsert: vi.fn().mockResolvedValue(undefined),
    getCollection: vi.fn().mockResolvedValue({ points_count: 0 }),
    scroll: vi.fn().mockResolvedValue({ points: [] }),
  }),
  ensureCollections: vi.fn().mockResolvedValue(undefined),
  upsertPoint: vi.fn().mockResolvedValue(undefined),
  COLLECTION_NAMES: { messages: 'messages', threads: 'threads' },
}));

// Dynamic import after mocks are set up
const { plugin: searchPlugin } = await import('@harness/plugin-search');

const prisma = new PrismaClient({ datasourceUrl: requireTestDatabaseUrl() });

beforeEach(async () => {
  await resetDatabase(prisma);
  vi.clearAllMocks();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('search plugin integration', () => {
  let harness: TestHarness;

  afterEach(async () => {
    await harness?.cleanup();
  });

  it('registers and starts without throwing', async () => {
    await expect(
      createTestHarness(searchPlugin).then((h) => {
        harness = h;
        return h;
      }),
    ).resolves.toBeDefined();
  });

  it('start() calls ensureCollections on boot', async () => {
    const { ensureCollections, getQdrantClient } = await import('@harness/vector-search');
    harness = await createTestHarness(searchPlugin);

    const qdrantClient = getQdrantClient();
    expect(ensureCollections).toHaveBeenCalledWith(qdrantClient);
  });

  it('onMessage hook indexes user messages via pipeline', async () => {
    const { upsertPoint } = await import('@harness/vector-search');
    harness = await createTestHarness(searchPlugin);

    // Create a user message that the hook can find
    await prisma.message.create({
      data: {
        threadId: harness.threadId,
        role: 'user',
        content: 'Hello, test message for indexing',
        kind: 'text',
      },
    });

    // Fire the pipeline — onMessage hook triggers indexing
    await harness.orchestrator.getContext().sendToThread(harness.threadId, 'Hello, test message for indexing');

    // Give fire-and-forget indexing a moment to complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(upsertPoint).toHaveBeenCalled();
  });

  it('onPipelineComplete hook indexes assistant response', async () => {
    const { upsertPoint } = await import('@harness/vector-search');
    harness = await createTestHarness(searchPlugin, {
      invokerOutput: 'Here is the assistant response',
    });

    await harness.orchestrator.getContext().sendToThread(harness.threadId, 'Give me a response');

    // Give fire-and-forget indexing a moment to complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    // upsertPoint should be called for both the user message index and
    // the assistant response + thread re-index
    expect(upsertPoint).toHaveBeenCalled();
  });

  it('gracefully handles Qdrant being unavailable', async () => {
    const vectorSearch = await import('@harness/vector-search');
    vi.mocked(vectorSearch.getQdrantClient).mockReturnValueOnce(null as never);

    // Plugin should still register and start without throwing
    harness = await createTestHarness(searchPlugin);

    // Pipeline should complete normally even without Qdrant
    await expect(harness.orchestrator.getContext().sendToThread(harness.threadId, 'test')).resolves.toBeUndefined();
  });
});
