import type { Logger } from "@harness/logger";
import type { PluginDefinition } from "@harness/plugin-contract";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPluginLoader } from "../index";

const makePlugin = (overrides?: Partial<PluginDefinition>): PluginDefinition => ({
  name: "test-plugin",
  version: "1.0.0",
  register: vi.fn().mockResolvedValue({}),
  ...overrides,
});

const makeMockLogger = (): Logger =>
  ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }) as unknown as Logger;

describe("createPluginLoader", () => {
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = makeMockLogger();
  });

  describe("empty plugin list", () => {
    it("returns empty loaded and results arrays when no plugins are provided", () => {
      const loader = createPluginLoader({ plugins: [], logger: mockLogger });
      const result = loader.loadAll();

      expect(result.loaded).toEqual([]);
      expect(result.results).toEqual([]);
    });

    it("logs that there are no plugins to load when the list is empty", () => {
      const loader = createPluginLoader({ plugins: [], logger: mockLogger });
      loader.loadAll();

      expect(mockLogger.info).toHaveBeenCalledWith("No plugins to load");
    });
  });

  describe("loading valid plugins", () => {
    it("loads a single valid plugin successfully", () => {
      const plugin = makePlugin();
      const loader = createPluginLoader({ plugins: [plugin], logger: mockLogger });
      const result = loader.loadAll();

      expect(result.loaded).toHaveLength(1);
      expect(result.loaded[0]).toBe(plugin);
      expect(result.results).toHaveLength(1);
      expect(result.results[0]).toMatchObject({ status: "loaded", definition: plugin });
    });

    it("loads multiple valid plugins successfully", () => {
      const pluginA = makePlugin({ name: "plugin-a" });
      const pluginB = makePlugin({ name: "plugin-b", version: "2.0.0" });
      const loader = createPluginLoader({
        plugins: [pluginA, pluginB],
        logger: mockLogger,
      });
      const result = loader.loadAll();

      expect(result.loaded).toHaveLength(2);
      expect(result.results).toHaveLength(2);
      expect(result.results[0]).toMatchObject({ status: "loaded" });
      expect(result.results[1]).toMatchObject({ status: "loaded" });
    });

    it("returns each loaded plugin's definition in the loaded array", () => {
      const pluginA = makePlugin({ name: "plugin-a" });
      const pluginB = makePlugin({ name: "plugin-b" });
      const loader = createPluginLoader({
        plugins: [pluginA, pluginB],
        logger: mockLogger,
      });
      const result = loader.loadAll();

      expect(result.loaded).toContain(pluginA);
      expect(result.loaded).toContain(pluginB);
    });
  });

  describe("handling invalid plugins", () => {
    it("reports a failed result for a plugin with missing required fields", () => {
      const invalidPlugin = { name: "", version: "", register: null } as unknown as PluginDefinition;
      const loader = createPluginLoader({
        plugins: [invalidPlugin],
        logger: mockLogger,
      });
      const result = loader.loadAll();

      expect(result.loaded).toHaveLength(0);
      expect(result.results).toHaveLength(1);
      expect(result.results[0]).toMatchObject({ status: "failed" });
    });

    it("includes validation errors in the failed result", () => {
      const invalidPlugin = { name: "", version: "", register: null } as unknown as PluginDefinition;
      const loader = createPluginLoader({
        plugins: [invalidPlugin],
        logger: mockLogger,
      });
      const result = loader.loadAll();

      const failedResult = result.results[0]!;
      expect(failedResult.status).toBe("failed");
      if (failedResult.status === "failed") {
        expect(failedResult.errors.length).toBeGreaterThan(0);
      }
    });

    it("uses 'unknown' as fallback name when plugin.name is undefined", () => {
      const invalidPlugin = { version: "", register: null } as unknown as PluginDefinition;
      const loader = createPluginLoader({
        plugins: [invalidPlugin],
        logger: mockLogger,
      });
      const result = loader.loadAll();

      const failedResult = result.results[0]!;
      expect(failedResult.status).toBe("failed");
      if (failedResult.status === "failed") {
        expect(failedResult.name).toBe("unknown");
      }
    });
  });

  describe("mixed valid and invalid plugins", () => {
    it("loads valid plugins and reports failures for invalid ones", () => {
      const validPlugin = makePlugin({ name: "valid-plugin" });
      const invalidPlugin = { name: "", version: "", register: null } as unknown as PluginDefinition;
      const loader = createPluginLoader({
        plugins: [validPlugin, invalidPlugin],
        logger: mockLogger,
      });
      const result = loader.loadAll();

      expect(result.loaded).toHaveLength(1);
      expect(result.loaded[0]).toBe(validPlugin);
      expect(result.results).toHaveLength(2);

      const loadedResult = result.results.find((r) => r.status === "loaded");
      const failedResult = result.results.find((r) => r.status === "failed");

      expect(loadedResult).toBeDefined();
      expect(failedResult).toBeDefined();
    });

    it("preserves the order of results to match the order of input plugins", () => {
      const validPlugin = makePlugin({ name: "valid-plugin" });
      const invalidPlugin = { name: "", version: "", register: null } as unknown as PluginDefinition;
      const loader = createPluginLoader({
        plugins: [validPlugin, invalidPlugin],
        logger: mockLogger,
      });
      const result = loader.loadAll();

      expect(result.results[0]).toMatchObject({ status: "loaded" });
      expect(result.results[1]).toMatchObject({ status: "failed" });
    });

    it("does not include invalid plugins in the loaded array", () => {
      const validPlugin = makePlugin({ name: "valid-plugin" });
      const invalidPlugin = { name: "bad", version: "", register: "nope" } as unknown as PluginDefinition;
      const loader = createPluginLoader({
        plugins: [validPlugin, invalidPlugin],
        logger: mockLogger,
      });
      const result = loader.loadAll();

      expect(result.loaded).not.toContain(invalidPlugin);
    });
  });

  describe("logging", () => {
    it("logs a validation start message with the number of plugins", () => {
      const plugins = [makePlugin({ name: "p1" }), makePlugin({ name: "p2" })];
      const loader = createPluginLoader({ plugins, logger: mockLogger });
      loader.loadAll();

      expect(mockLogger.info).toHaveBeenCalledWith("Validating 2 plugin(s)");
    });

    it("logs a success message for each loaded plugin", () => {
      const plugin = makePlugin({ name: "my-plugin", version: "3.0.0" });
      const loader = createPluginLoader({ plugins: [plugin], logger: mockLogger });
      loader.loadAll();

      expect(mockLogger.info).toHaveBeenCalledWith("Loaded plugin: my-plugin@3.0.0");
    });

    it("logs a warning when a plugin fails validation", () => {
      const invalidPlugin = { name: "bad-plugin", version: "", register: null } as unknown as PluginDefinition;
      const loader = createPluginLoader({
        plugins: [invalidPlugin],
        logger: mockLogger,
      });
      loader.loadAll();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Plugin validation failed",
        expect.objectContaining({ name: "bad-plugin" })
      );
    });

    it("logs a summary message after all plugins are processed", () => {
      const validPlugin = makePlugin({ name: "valid" });
      const invalidPlugin = { name: "bad", version: "", register: null } as unknown as PluginDefinition;
      const loader = createPluginLoader({
        plugins: [validPlugin, invalidPlugin],
        logger: mockLogger,
      });
      loader.loadAll();

      expect(mockLogger.info).toHaveBeenCalledWith("Plugin loading complete: 1 loaded, 1 failed");
    });

    it("logs a summary with all loaded and zero failed when all plugins are valid", () => {
      const plugins = [makePlugin({ name: "p1" }), makePlugin({ name: "p2" })];
      const loader = createPluginLoader({ plugins, logger: mockLogger });
      loader.loadAll();

      expect(mockLogger.info).toHaveBeenCalledWith("Plugin loading complete: 2 loaded, 0 failed");
    });
  });
});
