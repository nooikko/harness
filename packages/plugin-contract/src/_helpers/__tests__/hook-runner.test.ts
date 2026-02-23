import type { Logger } from "@harness/logger";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runChainHook, runHook, runHookWithResult } from "../hook-runner";

type TestHooks = {
  onNotify?: () => Promise<void>;
  onCommand?: () => Promise<boolean>;
  onTransform?: (value: string) => Promise<string>;
};

type MakeLogger = () => Logger;

const makeLogger: MakeLogger = () =>
  ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }) as unknown as Logger;

describe("runHook", () => {
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = makeLogger();
  });

  it("calls all hooks even when some return undefined", async () => {
    const calledWith: TestHooks[] = [];
    const hookObjects: TestHooks[] = [{}, {}, {}];

    const callHook = vi.fn((hooks: TestHooks) => {
      calledWith.push(hooks);
      return undefined;
    });

    await runHook(hookObjects, "onNotify", callHook, mockLogger);

    expect(callHook).toHaveBeenCalledTimes(3);
    expect(calledWith).toEqual(hookObjects);
  });

  it("awaits hooks that return a promise", async () => {
    const resolved: string[] = [];
    const hookObjects: TestHooks[] = [{ onNotify: vi.fn() }, { onNotify: vi.fn() }];

    const callHook = vi.fn(async (hooks: TestHooks) => {
      const label = hooks === hookObjects[0] ? "first" : "second";
      await Promise.resolve();
      resolved.push(label);
    });

    await runHook(hookObjects, "onNotify", callHook, mockLogger);

    expect(resolved).toEqual(["first", "second"]);
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it("catches errors from hooks and continues to next hook", async () => {
    const secondCallHook = vi.fn().mockResolvedValue(undefined);
    let callCount = 0;

    const callHook = vi.fn((hooks: TestHooks) => {
      callCount++;
      if (callCount === 1) {
        return Promise.reject(new Error("hook failed"));
      }
      return secondCallHook(hooks);
    });

    const hookObjects: TestHooks[] = [{}, {}];

    await runHook(hookObjects, "onNotify", callHook, mockLogger);

    expect(callHook).toHaveBeenCalledTimes(2);
    expect(secondCallHook).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
  });

  it("logs error with hook name on failure", async () => {
    const hookObjects: TestHooks[] = [{}];

    const callHook = vi.fn(() => Promise.reject(new Error("something went wrong")));

    await runHook(hookObjects, "onAfterInvoke", callHook, mockLogger);

    expect(mockLogger.error).toHaveBeenCalledWith('Hook "onAfterInvoke" threw: something went wrong');
  });

  it("logs error for non-Error thrown values", async () => {
    const hookObjects: TestHooks[] = [{}];

    const callHook = vi.fn(() => Promise.reject("unexpected rejection value"));

    await runHook(hookObjects, "onTaskCreate", callHook, mockLogger);

    expect(mockLogger.error).toHaveBeenCalledWith('Hook "onTaskCreate" threw: unexpected rejection value');
  });

  it("does not call logger.error when all hooks succeed", async () => {
    const hookObjects: TestHooks[] = [{}, {}];

    const callHook = vi.fn(() => Promise.resolve());

    await runHook(hookObjects, "onNotify", callHook, mockLogger);

    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it("completes without error when allHooks is empty", async () => {
    const callHook = vi.fn();

    await runHook([], "onNotify", callHook, mockLogger);

    expect(callHook).not.toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it("passes each hooks object to callHook in order", async () => {
    const hookA: TestHooks = { onNotify: vi.fn() };
    const hookB: TestHooks = { onNotify: vi.fn() };
    const hookC: TestHooks = { onNotify: vi.fn() };
    const hookObjects = [hookA, hookB, hookC];

    const callOrder: TestHooks[] = [];
    const callHook = vi.fn((hooks: TestHooks) => {
      callOrder.push(hooks);
      return undefined;
    });

    await runHook(hookObjects, "onNotify", callHook, mockLogger);

    expect(callOrder).toEqual([hookA, hookB, hookC]);
  });
});

describe("runHookWithResult", () => {
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = makeLogger();
  });

  it("returns false when no hooks return a result", async () => {
    const hookObjects: TestHooks[] = [{}, {}];

    const callHook = vi.fn(() => undefined);

    const result = await runHookWithResult(hookObjects, "onCommand", callHook, mockLogger);

    expect(result).toBe(false);
  });

  it("returns false when allHooks is empty", async () => {
    const callHook = vi.fn(() => undefined);

    const result = await runHookWithResult([], "onCommand", callHook, mockLogger);

    expect(result).toBe(false);
  });

  it("returns true when a hook returns true", async () => {
    const hookObjects: TestHooks[] = [{ onCommand: vi.fn().mockResolvedValue(true) }];

    const callHook = vi.fn((hooks: TestHooks) => (hooks.onCommand ? hooks.onCommand() : undefined));

    const result = await runHookWithResult(hookObjects, "onCommand", callHook, mockLogger);

    expect(result).toBe(true);
  });

  it("stops iterating after first hook returns true", async () => {
    const firstHook = vi.fn().mockResolvedValue(true);
    const secondHook = vi.fn().mockResolvedValue(true);
    const hookObjects: TestHooks[] = [{ onCommand: firstHook }, { onCommand: secondHook }];

    const callHook = vi.fn((hooks: TestHooks) => (hooks.onCommand ? hooks.onCommand() : undefined));

    const result = await runHookWithResult(hookObjects, "onCommand", callHook, mockLogger);

    expect(result).toBe(true);
    expect(firstHook).toHaveBeenCalledTimes(1);
    expect(secondHook).not.toHaveBeenCalled();
  });

  it("continues to next hook when a hook returns false", async () => {
    const firstHook = vi.fn().mockResolvedValue(false);
    const secondHook = vi.fn().mockResolvedValue(true);
    const hookObjects: TestHooks[] = [{ onCommand: firstHook }, { onCommand: secondHook }];

    const callHook = vi.fn((hooks: TestHooks) => (hooks.onCommand ? hooks.onCommand() : undefined));

    const result = await runHookWithResult(hookObjects, "onCommand", callHook, mockLogger);

    expect(result).toBe(true);
    expect(firstHook).toHaveBeenCalledTimes(1);
    expect(secondHook).toHaveBeenCalledTimes(1);
  });

  it("catches errors from hooks and continues to next hook", async () => {
    const firstHook = vi.fn().mockRejectedValue(new Error("handler crashed"));
    const secondHook = vi.fn().mockResolvedValue(true);
    const hookObjects: TestHooks[] = [{ onCommand: firstHook }, { onCommand: secondHook }];

    const callHook = vi.fn((hooks: TestHooks) => (hooks.onCommand ? hooks.onCommand() : undefined));

    const result = await runHookWithResult(hookObjects, "onCommand", callHook, mockLogger);

    expect(result).toBe(true);
    expect(mockLogger.error).toHaveBeenCalledWith('Hook "onCommand" threw: handler crashed');
    expect(secondHook).toHaveBeenCalledTimes(1);
  });

  it("logs error for non-Error thrown values", async () => {
    const hookObjects: TestHooks[] = [
      {
        onCommand: vi.fn().mockRejectedValue("a plain string error"),
      },
    ];

    const callHook = vi.fn((hooks: TestHooks) => (hooks.onCommand ? hooks.onCommand() : undefined));

    await runHookWithResult(hookObjects, "onCommand", callHook, mockLogger);

    expect(mockLogger.error).toHaveBeenCalledWith('Hook "onCommand" threw: a plain string error');
  });

  it("returns false when no hook handles the action", async () => {
    const hookObjects: TestHooks[] = [
      { onCommand: vi.fn().mockResolvedValue(false) },
      { onCommand: vi.fn().mockResolvedValue(false) },
    ];

    const callHook = vi.fn((hooks: TestHooks) => (hooks.onCommand ? hooks.onCommand() : undefined));

    const result = await runHookWithResult(hookObjects, "onCommand", callHook, mockLogger);

    expect(result).toBe(false);
  });

  it("skips hooks without the handler without error", async () => {
    const secondHook = vi.fn().mockResolvedValue(true);
    const hookObjects: TestHooks[] = [{}, { onCommand: secondHook }];

    const callHook = vi.fn((hooks: TestHooks) => (hooks.onCommand ? hooks.onCommand() : undefined));

    const result = await runHookWithResult(hookObjects, "onCommand", callHook, mockLogger);

    expect(result).toBe(true);
    expect(secondHook).toHaveBeenCalledTimes(1);
  });
});

describe("runChainHook", () => {
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = makeLogger();
  });

  it("returns initial value when no hooks have the handler", async () => {
    const hookObjects: TestHooks[] = [{}, {}];

    const callHook = vi.fn(() => undefined);

    const result = await runChainHook(hookObjects, "onTransform", "initial value", callHook, mockLogger);

    expect(result).toBe("initial value");
  });

  it("returns initial value when allHooks is empty", async () => {
    const callHook = vi.fn(() => undefined);

    const result = await runChainHook([], "onTransform", "initial value", callHook, mockLogger);

    expect(result).toBe("initial value");
  });

  it("chains value through multiple hooks", async () => {
    const hookObjects: TestHooks[] = [
      { onTransform: vi.fn().mockResolvedValue("modified once") },
      { onTransform: vi.fn().mockResolvedValue("modified twice") },
    ];

    const callHook = vi.fn((hooks: TestHooks, currentValue: string) =>
      hooks.onTransform ? hooks.onTransform(currentValue) : undefined
    );

    const result = await runChainHook(hookObjects, "onTransform", "initial value", callHook, mockLogger);

    expect(result).toBe("modified twice");
    expect(callHook).toHaveBeenNthCalledWith(1, hookObjects[0], "initial value");
    expect(callHook).toHaveBeenNthCalledWith(2, hookObjects[1], "modified once");
  });

  it("catches errors from hooks and continues with current value", async () => {
    const hookObjects: TestHooks[] = [
      { onTransform: vi.fn().mockRejectedValue(new Error("hook blew up")) },
      { onTransform: vi.fn().mockResolvedValue("from second hook") },
    ];

    const callHook = vi.fn((hooks: TestHooks, currentValue: string) =>
      hooks.onTransform ? hooks.onTransform(currentValue) : undefined
    );

    const result = await runChainHook(hookObjects, "onTransform", "initial value", callHook, mockLogger);

    expect(result).toBe("from second hook");
    expect(mockLogger.error).toHaveBeenCalledWith('Hook "onTransform" threw: hook blew up');
  });

  it("logs error for non-Error thrown values", async () => {
    const hookObjects: TestHooks[] = [{ onTransform: vi.fn().mockRejectedValue("a plain string error") }];

    const callHook = vi.fn((hooks: TestHooks, currentValue: string) =>
      hooks.onTransform ? hooks.onTransform(currentValue) : undefined
    );

    await runChainHook(hookObjects, "onTransform", "initial value", callHook, mockLogger);

    expect(mockLogger.error).toHaveBeenCalledWith('Hook "onTransform" threw: a plain string error');
  });

  it("passes current value to each hook in sequence", async () => {
    const hook1 = vi.fn().mockResolvedValue("step-1");
    const hook2 = vi.fn().mockResolvedValue("step-2");
    const hookObjects: TestHooks[] = [{ onTransform: hook1 }, { onTransform: hook2 }];

    const callHook = vi.fn((hooks: TestHooks, currentValue: string) =>
      hooks.onTransform ? hooks.onTransform(currentValue) : undefined
    );

    const result = await runChainHook(hookObjects, "onTransform", "start", callHook, mockLogger);

    expect(result).toBe("step-2");
    expect(hook1).toHaveBeenCalledWith("start");
    expect(hook2).toHaveBeenCalledWith("step-1");
  });

  it("skips hooks without the handler without affecting the chain", async () => {
    const secondHook = vi.fn().mockResolvedValue("from second hook");
    const hookObjects: TestHooks[] = [{}, { onTransform: secondHook }];

    const callHook = vi.fn((hooks: TestHooks, currentValue: string) =>
      hooks.onTransform ? hooks.onTransform(currentValue) : undefined
    );

    const result = await runChainHook(hookObjects, "onTransform", "initial value", callHook, mockLogger);

    expect(result).toBe("from second hook");
    expect(secondHook).toHaveBeenCalledWith("initial value");
  });

  it("preserves value through error and passes to next hook", async () => {
    const hookObjects: TestHooks[] = [
      { onTransform: vi.fn().mockResolvedValue("first transform") },
      { onTransform: vi.fn().mockRejectedValue(new Error("crash")) },
      { onTransform: vi.fn().mockResolvedValue("final transform") },
    ];

    const callHook = vi.fn((hooks: TestHooks, currentValue: string) =>
      hooks.onTransform ? hooks.onTransform(currentValue) : undefined
    );

    const result = await runChainHook(hookObjects, "onTransform", "start", callHook, mockLogger);

    // After first hook: "first transform"
    // Second hook errors: stays at "first transform"
    // Third hook receives "first transform" and transforms to "final transform"
    expect(result).toBe("final transform");
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
  });
});
