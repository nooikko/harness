import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InvokerConfig } from "../index";
import { createInvoker } from "../index";

vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

const mockSpawn = vi.mocked(spawn);

const createMockChild = () => {
  const child = new EventEmitter() as any;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.killed = false;
  child.kill = vi.fn(() => {
    child.killed = true;
  });
  return child;
};

const defaultConfig: InvokerConfig = {
  defaultModel: "claude-sonnet-4-6",
  defaultTimeout: 30000,
};

describe("createInvoker", () => {
  let mockChild: ReturnType<typeof createMockChild>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockChild = createMockChild();
    mockSpawn.mockReturnValue(mockChild);
  });

  it("spawns claude with correct args for the given prompt", async () => {
    const invoker = createInvoker(defaultConfig);

    const resultPromise = invoker.invoke("hello world");

    mockChild.stdout.emit("data", Buffer.from(""));
    mockChild.emit("close", 0);

    await resultPromise;

    expect(mockSpawn).toHaveBeenCalledWith(
      "claude",
      expect.arrayContaining(["-p", "hello world", "--model", "claude-sonnet-4-6", "--output-format", "text"]),
      expect.objectContaining({ stdio: ["pipe", "pipe", "pipe"] })
    );
  });

  it("returns trimmed stdout output on success", async () => {
    const invoker = createInvoker(defaultConfig);

    const resultPromise = invoker.invoke("test prompt");

    mockChild.stdout.emit("data", Buffer.from("  result text  "));
    mockChild.emit("close", 0);

    const result = await resultPromise;

    expect(result.output).toBe("result text");
    expect(result.exitCode).toBe(0);
    expect(result.error).toBeUndefined();
  });

  it("concatenates multiple stdout chunks", async () => {
    const invoker = createInvoker(defaultConfig);

    const resultPromise = invoker.invoke("test prompt");

    mockChild.stdout.emit("data", Buffer.from("part one "));
    mockChild.stdout.emit("data", Buffer.from("part two"));
    mockChild.emit("close", 0);

    const result = await resultPromise;

    expect(result.output).toBe("part one part two");
  });

  it("returns stderr as error when process exits with non-zero code", async () => {
    const invoker = createInvoker(defaultConfig);

    const resultPromise = invoker.invoke("bad prompt");

    mockChild.stderr.emit("data", Buffer.from("something went wrong"));
    mockChild.emit("close", 1);

    const result = await resultPromise;

    expect(result.error).toBe("something went wrong");
    expect(result.exitCode).toBe(1);
  });

  it("returns no error when stderr is empty and process succeeds", async () => {
    const invoker = createInvoker(defaultConfig);

    const resultPromise = invoker.invoke("good prompt");

    mockChild.emit("close", 0);

    const result = await resultPromise;

    expect(result.error).toBeUndefined();
    expect(result.exitCode).toBe(0);
  });

  it("handles spawn error emitted by the child process", async () => {
    const invoker = createInvoker(defaultConfig);

    const resultPromise = invoker.invoke("any prompt");

    mockChild.emit("error", new Error("ENOENT: claude not found"));

    const result = await resultPromise;

    expect(result.output).toBe("");
    expect(result.error).toBe("Failed to spawn claude: ENOENT: claude not found");
    expect(result.exitCode).toBeNull();
  });

  it("uses default model from config when no model option is provided", async () => {
    const config: InvokerConfig = { defaultModel: "claude-opus-4-6", defaultTimeout: 10000 };
    const invoker = createInvoker(config);

    const resultPromise = invoker.invoke("prompt");

    mockChild.emit("close", 0);

    await resultPromise;

    const spawnArgs = mockSpawn.mock.calls[0]![1] as string[];
    const modelIndex = spawnArgs.indexOf("--model");
    expect(spawnArgs[modelIndex + 1]).toBe("claude-opus-4-6");
  });

  it("uses model from options when provided, overriding config default", async () => {
    const invoker = createInvoker(defaultConfig);

    const resultPromise = invoker.invoke("prompt", { model: "claude-haiku-4-6" });

    mockChild.emit("close", 0);

    await resultPromise;

    const spawnArgs = mockSpawn.mock.calls[0]![1] as string[];
    const modelIndex = spawnArgs.indexOf("--model");
    expect(spawnArgs[modelIndex + 1]).toBe("claude-haiku-4-6");
  });

  it("includes durationMs in the result", async () => {
    const invoker = createInvoker(defaultConfig);

    const resultPromise = invoker.invoke("timed prompt");

    mockChild.emit("close", 0);

    const result = await resultPromise;

    expect(typeof result.durationMs).toBe("number");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("passes allowedTools args when provided in options", async () => {
    const invoker = createInvoker(defaultConfig);

    const resultPromise = invoker.invoke("prompt", { allowedTools: ["Bash", "Read"] });

    mockChild.emit("close", 0);

    await resultPromise;

    const spawnArgs = mockSpawn.mock.calls[0]![1] as string[];
    expect(spawnArgs).toContain("--allowedTools");
    expect(spawnArgs).toContain("Bash");
    expect(spawnArgs).toContain("Read");
  });

  it("passes maxTokens arg when provided in options", async () => {
    const invoker = createInvoker(defaultConfig);

    const resultPromise = invoker.invoke("prompt", { maxTokens: 4096 });

    mockChild.emit("close", 0);

    await resultPromise;

    const spawnArgs = mockSpawn.mock.calls[0]![1] as string[];
    expect(spawnArgs).toContain("--max-tokens");
    expect(spawnArgs).toContain("4096");
  });

  it("kills child process after timeout and returns timeout error", async () => {
    vi.useFakeTimers();

    const config: InvokerConfig = { defaultModel: "sonnet", defaultTimeout: 500 };
    const invoker = createInvoker(config);

    const resultPromise = invoker.invoke("slow prompt");

    await vi.advanceTimersByTimeAsync(500);

    expect(mockChild.kill).toHaveBeenCalledWith("SIGTERM");

    mockChild.emit("close", null);

    const result = await resultPromise;

    expect(result.error).toBe("Timed out after 500ms");

    vi.useRealTimers();
  });

  it("uses timeout from options when provided, overriding config default", async () => {
    vi.useFakeTimers();

    const config: InvokerConfig = { defaultModel: "sonnet", defaultTimeout: 60000 };
    const invoker = createInvoker(config);

    const resultPromise = invoker.invoke("prompt", { timeout: 1000 });

    // Config default (60000ms) should NOT have fired yet but options timeout (1000ms) should
    await vi.advanceTimersByTimeAsync(1000);

    expect(mockChild.kill).toHaveBeenCalledWith("SIGTERM");

    mockChild.emit("close", null);

    const result = await resultPromise;

    expect(result.error).toBe("Timed out after 1000ms");

    vi.useRealTimers();
  });

  it("does not report timeout error when process finishes before deadline", async () => {
    vi.useFakeTimers();

    const config: InvokerConfig = { defaultModel: "sonnet", defaultTimeout: 5000 };
    const invoker = createInvoker(config);

    const resultPromise = invoker.invoke("fast prompt");

    mockChild.stdout.emit("data", Buffer.from("done"));
    mockChild.emit("close", 0);

    await vi.advanceTimersByTimeAsync(5000);

    const result = await resultPromise;

    expect(result.error).toBeUndefined();
    expect(mockChild.kill).not.toHaveBeenCalled();

    vi.useRealTimers();
  });
});
