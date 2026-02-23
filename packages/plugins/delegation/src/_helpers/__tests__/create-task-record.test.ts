// Tests for create-task-record helper

import type { PluginContext } from "@harness/plugin-contract";
import { describe, expect, it, vi } from "vitest";
import { createTaskRecord } from "../create-task-record";

type CreateMockContext = () => PluginContext;

const createMockContext: CreateMockContext = () =>
  ({
    db: {
      orchestratorTask: {
        create: vi.fn().mockResolvedValue({ id: "task-xyz-789" }),
      },
    },
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  }) as unknown as PluginContext;

describe("createTaskRecord", () => {
  it("creates a task with the correct threadId", async () => {
    const ctx = createMockContext();

    await createTaskRecord(ctx, "thread-1", "Write tests", 5);

    const createCall = (ctx.db as unknown as { orchestratorTask: { create: ReturnType<typeof vi.fn> } })
      .orchestratorTask.create.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(createCall.data.threadId).toBe("thread-1");
  });

  it("stores the prompt in the task record", async () => {
    const ctx = createMockContext();

    await createTaskRecord(ctx, "thread-1", "Build a feature", 3);

    const createCall = (ctx.db as unknown as { orchestratorTask: { create: ReturnType<typeof vi.fn> } })
      .orchestratorTask.create.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(createCall.data.prompt).toBe("Build a feature");
  });

  it("sets status to pending", async () => {
    const ctx = createMockContext();

    await createTaskRecord(ctx, "thread-1", "Do work", 5);

    const createCall = (ctx.db as unknown as { orchestratorTask: { create: ReturnType<typeof vi.fn> } })
      .orchestratorTask.create.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(createCall.data.status).toBe("pending");
  });

  it("stores maxIterations in the task record", async () => {
    const ctx = createMockContext();

    await createTaskRecord(ctx, "thread-1", "Do work", 10);

    const createCall = (ctx.db as unknown as { orchestratorTask: { create: ReturnType<typeof vi.fn> } })
      .orchestratorTask.create.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(createCall.data.maxIterations).toBe(10);
  });

  it("sets currentIteration to 0", async () => {
    const ctx = createMockContext();

    await createTaskRecord(ctx, "thread-1", "Do work", 5);

    const createCall = (ctx.db as unknown as { orchestratorTask: { create: ReturnType<typeof vi.fn> } })
      .orchestratorTask.create.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(createCall.data.currentIteration).toBe(0);
  });

  it("returns the created task id", async () => {
    const ctx = createMockContext();

    const result = await createTaskRecord(ctx, "thread-1", "Do work", 5);

    expect(result.taskId).toBe("task-xyz-789");
  });
});
