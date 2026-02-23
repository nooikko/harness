import type { Logger } from "@harness/logger";
import type { PluginHooks } from "@harness/plugin-contract";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runNotifyHooks } from "../run-notify-hooks";

const makeLogger = (): Logger =>
  ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }) as unknown as Logger;

describe("runNotifyHooks", () => {
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = makeLogger();
  });

  it("calls all hooks even when some return undefined", async () => {
    const calledWith: PluginHooks[] = [];
    const hookObjects: PluginHooks[] = [{}, {}, {}];

    const callHook = vi.fn((hooks: PluginHooks) => {
      calledWith.push(hooks);
      return undefined;
    });

    await runNotifyHooks(hookObjects, "onMessage", callHook, mockLogger);

    expect(callHook).toHaveBeenCalledTimes(3);
    expect(calledWith).toEqual(hookObjects);
  });

  it("awaits hooks that return a promise", async () => {
    const resolved: string[] = [];
    const hookObjects: PluginHooks[] = [{}, {}];

    const callHook = vi.fn(async (hooks: PluginHooks) => {
      const label = hooks === hookObjects[0] ? "first" : "second";
      await Promise.resolve();
      resolved.push(label);
    });

    await runNotifyHooks(hookObjects, "onMessage", callHook, mockLogger);

    expect(resolved).toEqual(["first", "second"]);
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it("catches errors from hooks and continues to next hook", async () => {
    const secondCallHook = vi.fn().mockResolvedValue(undefined);
    let callCount = 0;

    const callHook = vi.fn((hooks: PluginHooks) => {
      callCount++;
      if (callCount === 1) {
        return Promise.reject(new Error("hook failed"));
      }
      return secondCallHook(hooks);
    });

    const hookObjects: PluginHooks[] = [{}, {}];

    await runNotifyHooks(hookObjects, "onMessage", callHook, mockLogger);

    expect(callHook).toHaveBeenCalledTimes(2);
    expect(secondCallHook).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
  });

  it("logs error with hook name on failure", async () => {
    const hookObjects: PluginHooks[] = [{}];

    const callHook = vi.fn(() => Promise.reject(new Error("something went wrong")));

    await runNotifyHooks(hookObjects, "onAfterInvoke", callHook, mockLogger);

    expect(mockLogger.error).toHaveBeenCalledWith('Hook "onAfterInvoke" threw: something went wrong');
  });

  it("logs error with hook name for non-Error thrown values", async () => {
    const hookObjects: PluginHooks[] = [{}];

    const callHook = vi.fn(() => Promise.reject("unexpected rejection value"));

    await runNotifyHooks(hookObjects, "onTaskCreate", callHook, mockLogger);

    expect(mockLogger.error).toHaveBeenCalledWith('Hook "onTaskCreate" threw: unexpected rejection value');
  });

  it("does not call logger.error when all hooks succeed", async () => {
    const hookObjects: PluginHooks[] = [{}, {}];

    const callHook = vi.fn(() => Promise.resolve());

    await runNotifyHooks(hookObjects, "onMessage", callHook, mockLogger);

    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it("completes without error when allHooks is empty", async () => {
    const callHook = vi.fn();

    await runNotifyHooks([], "onMessage", callHook, mockLogger);

    expect(callHook).not.toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it("passes each hooks object to callHook in order", async () => {
    const hookA: PluginHooks = { onMessage: vi.fn() };
    const hookB: PluginHooks = { onMessage: vi.fn() };
    const hookC: PluginHooks = { onMessage: vi.fn() };
    const hookObjects = [hookA, hookB, hookC];

    const callOrder: PluginHooks[] = [];
    const callHook = vi.fn((hooks: PluginHooks) => {
      callOrder.push(hooks);
      return undefined;
    });

    await runNotifyHooks(hookObjects, "onMessage", callHook, mockLogger);

    expect(callOrder).toEqual([hookA, hookB, hookC]);
  });
});
