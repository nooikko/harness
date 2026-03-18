import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { storyThreadGuard } from '../story-thread-guard';

// Create a minimal mock PrismaClient with $extends that simulates the guard behavior
type MockQuery = ReturnType<typeof vi.fn>;

const createMockClient = () => {
  const mockQuery = vi.fn().mockResolvedValue({ id: 'thread-1' });

  // $extends captures the extension config and returns a client that applies it
  const mockClient = {
    $extends: (extension: {
      query: {
        thread: {
          create: (params: { args: { data: Record<string, unknown> }; query: MockQuery }) => unknown;
          update: (params: { args: { data: Record<string, unknown> }; query: MockQuery }) => unknown;
        };
      };
    }) => {
      // Return a client-like object that calls the extension interceptors
      return {
        thread: {
          create: (args: { data: Record<string, unknown> }) => extension.query.thread.create({ args, query: mockQuery }),
          update: (args: { data: Record<string, unknown> }) => extension.query.thread.update({ args, query: mockQuery }),
        },
      };
    },
  };

  return { mockClient, mockQuery };
};

describe('storyThreadGuard', () => {
  it('rejects thread.create with both storyId and projectId', async () => {
    const { mockClient } = createMockClient();
    const guarded = storyThreadGuard(mockClient as never);
    const client = guarded as unknown as {
      thread: { create: (args: { data: Record<string, unknown> }) => Promise<unknown> };
    };

    expect(() => client.thread.create({ data: { storyId: 'story-1', projectId: 'proj-1' } })).toThrow(Prisma.PrismaClientValidationError);
  });

  it('rejects thread.update with both storyId and projectId', () => {
    const { mockClient } = createMockClient();
    const guarded = storyThreadGuard(mockClient as never);
    const client = guarded as unknown as {
      thread: { update: (args: { data: Record<string, unknown> }) => unknown };
    };

    expect(() => client.thread.update({ data: { storyId: 'story-1', projectId: 'proj-1' } })).toThrow(Prisma.PrismaClientValidationError);
  });

  it('allows thread.create with only storyId', async () => {
    const { mockClient, mockQuery } = createMockClient();
    const guarded = storyThreadGuard(mockClient as never);
    const client = guarded as unknown as {
      thread: { create: (args: { data: Record<string, unknown> }) => Promise<unknown> };
    };

    await client.thread.create({ data: { storyId: 'story-1' } });
    expect(mockQuery).toHaveBeenCalled();
  });

  it('allows thread.create with only projectId', async () => {
    const { mockClient, mockQuery } = createMockClient();
    const guarded = storyThreadGuard(mockClient as never);
    const client = guarded as unknown as {
      thread: { create: (args: { data: Record<string, unknown> }) => Promise<unknown> };
    };

    await client.thread.create({ data: { projectId: 'proj-1' } });
    expect(mockQuery).toHaveBeenCalled();
  });

  it('allows thread.create with neither storyId nor projectId', async () => {
    const { mockClient, mockQuery } = createMockClient();
    const guarded = storyThreadGuard(mockClient as never);
    const client = guarded as unknown as {
      thread: { create: (args: { data: Record<string, unknown> }) => Promise<unknown> };
    };

    await client.thread.create({ data: { name: 'standalone' } });
    expect(mockQuery).toHaveBeenCalled();
  });
});
