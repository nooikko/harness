import type { PluginContext } from "@harness/plugin-contract";
import { describe, expect, it, vi } from "vitest";
import { createDelegationPlugin, parseDelegateArgs, plugin } from "../index";

type CreateMockContext = () => PluginContext;

const createMockContext: CreateMockContext = () => ({
  db: {
    thread: {
      create: vi.fn().mockResolvedValue({ id: "thread-task-1" }),
      update: vi.fn().mockResolvedValue({}),
    },
    orchestratorTask: {
      create: vi.fn().mockResolvedValue({ id: "task-1" }),
      update: vi.fn().mockResolvedValue({}),
    },
    message: {
      create: vi.fn().mockResolvedValue({}),
    },
    agentRun: {
      create: vi.fn().mockResolvedValue({}),
    },
  } as never,
  invoker: {
    invoke: vi.fn().mockResolvedValue({
      output: "Done",
      durationMs: 500,
      exitCode: 0,
    }),
  },
  config: {
    claudeModel: "claude-sonnet-4-20250514",
    databaseUrl: "",
    timezone: "UTC",
    maxConcurrentAgents: 5,
    claudeTimeout: 30000,
    discordToken: undefined,
    discordChannelId: undefined,
    port: 3001,
    logLevel: "info",
  } as never,
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  sendToThread: vi.fn(),
  broadcast: vi.fn(),
});

describe("delegation plugin", () => {
  it("has correct name and version", () => {
    expect(plugin.name).toBe("delegation");
    expect(plugin.version).toBe("1.0.0");
  });

  it("registers and returns onCommand hook", async () => {
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);

    expect(hooks.onCommand).toBeDefined();
    expect(typeof hooks.onCommand).toBe("function");
  });

  it("logs registration message", async () => {
    const ctx = createMockContext();
    await plugin.register(ctx);

    expect(ctx.logger.info).toHaveBeenCalledWith("Delegation plugin registered");
  });

  it("handles delegate command", async () => {
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);

    const handled = await hooks.onCommand?.("thread-1", "delegate", "Research something");

    expect(handled).toBe(true);
    expect(ctx.invoker.invoke).toHaveBeenCalled();
  });

  it("handles re-delegate command", async () => {
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);

    const handled = await hooks.onCommand?.("thread-1", "re-delegate", "Try again with different approach");

    expect(handled).toBe(true);
    expect(ctx.invoker.invoke).toHaveBeenCalled();
  });

  it("returns false for unknown commands", async () => {
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);

    const handled = await hooks.onCommand?.("thread-1", "unknown", "some args");

    expect(handled).toBe(false);
  });

  it("returns false for delegate with empty prompt", async () => {
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);

    const handled = await hooks.onCommand?.("thread-1", "delegate", "   ");

    expect(handled).toBe(false);
    expect(ctx.logger.warn).toHaveBeenCalledWith(expect.stringContaining("empty prompt"));
  });

  it("returns false for re-delegate with empty prompt", async () => {
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);

    const handled = await hooks.onCommand?.("thread-1", "re-delegate", "");

    expect(handled).toBe(false);
  });

  it("creates delegation plugin via factory function", () => {
    const created = createDelegationPlugin();

    expect(created.name).toBe("delegation");
    expect(created.version).toBe("1.0.0");
    expect(typeof created.register).toBe("function");
  });

  it("handles delegate command failure gracefully", async () => {
    const ctx = createMockContext();

    // Make the thread creation fail
    (ctx.db as unknown as { thread: { create: ReturnType<typeof vi.fn> } }).thread.create = vi
      .fn()
      .mockRejectedValue(new Error("DB connection failed"));

    const hooks = await plugin.register(ctx);
    const handled = await hooks.onCommand?.("thread-1", "delegate", "Do something");

    expect(handled).toBe(false);
    expect(ctx.logger.error).toHaveBeenCalledWith(expect.stringContaining("delegate command failed"));
  });
});

describe("parseDelegateArgs", () => {
  it("extracts prompt from simple args", () => {
    const result = parseDelegateArgs("Research quantum computing");

    expect(result.prompt).toBe("Research quantum computing");
    expect(result.model).toBeUndefined();
    expect(result.maxIterations).toBeUndefined();
  });

  it("extracts model parameter", () => {
    const result = parseDelegateArgs("model=claude-opus-4-20250514 Write a report");

    expect(result.model).toBe("claude-opus-4-20250514");
    expect(result.prompt).toBe("Write a report");
  });

  it("extracts maxIterations parameter", () => {
    const result = parseDelegateArgs("maxIterations=3 Write tests");

    expect(result.maxIterations).toBe(3);
    expect(result.prompt).toBe("Write tests");
  });

  it("extracts both model and maxIterations", () => {
    const result = parseDelegateArgs("model=sonnet maxIterations=10 Build a feature");

    expect(result.model).toBe("sonnet");
    expect(result.maxIterations).toBe(10);
    expect(result.prompt).toBe("Build a feature");
  });

  it("handles args with no parameters", () => {
    const result = parseDelegateArgs("Just do the work");

    expect(result.prompt).toBe("Just do the work");
    expect(result.model).toBeUndefined();
    expect(result.maxIterations).toBeUndefined();
  });

  it("trims whitespace from prompt", () => {
    const result = parseDelegateArgs("  Do work  ");

    expect(result.prompt).toBe("Do work");
  });

  it("handles empty string", () => {
    const result = parseDelegateArgs("");

    expect(result.prompt).toBe("");
  });

  it("ignores invalid maxIterations", () => {
    const result = parseDelegateArgs("maxIterations=abc Do work");

    expect(result.maxIterations).toBeUndefined();
    expect(result.prompt).toBe("Do work");
  });

  it("ignores zero maxIterations", () => {
    const result = parseDelegateArgs("maxIterations=0 Do work");

    expect(result.maxIterations).toBeUndefined();
  });

  it("ignores negative maxIterations", () => {
    const result = parseDelegateArgs("maxIterations=-5 Do work");

    expect(result.maxIterations).toBeUndefined();
  });

  it("handles parameters at end of args", () => {
    const result = parseDelegateArgs("Write code model=opus");

    expect(result.model).toBe("opus");
    expect(result.prompt).toBe("Write code");
  });
});
