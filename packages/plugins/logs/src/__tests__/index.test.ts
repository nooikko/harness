import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { plugin } from "../index";

describe("plugin-logs", () => {
  it("has correct name and version", () => {
    expect(plugin.name).toBe("logs");
    expect(plugin.version).toBe("1.0.0");
  });

  it("exports a tools array with one query tool", () => {
    expect(plugin.tools).toHaveLength(1);
    expect(plugin.tools?.[0]?.name).toBe("query");
  });

  it("has a register function", () => {
    expect(typeof plugin.register).toBe("function");
  });

  describe("register", () => {
    it("logs registration info", async () => {
      const mockLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      };

      const ctx = { logger: mockLogger } as never;
      await plugin.register(ctx);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("Logs plugin registered"),
      );
    });
  });

  describe("query tool handler", () => {
    let tempDir: string;
    let logFilePath: string;
    const mockCtx = {
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
    } as never;

    const now = Date.now();

    beforeAll(() => {
      tempDir = mkdtempSync(join(tmpdir(), "logs-index-test-"));
      logFilePath = join(tempDir, "test.log");
      const lines = [
        JSON.stringify({
          level: 50,
          time: now,
          msg: "Something broke",
          pluginName: "web",
          threadId: "t-1",
        }),
        JSON.stringify({
          level: 30,
          time: now,
          msg: "All good",
          pluginName: "identity",
          threadId: "t-2",
        }),
      ];
      writeFileSync(logFilePath, lines.join("\n") + "\n");
    });

    afterAll(() => {
      rmSync(tempDir, { recursive: true, force: true });
      vi.unstubAllEnvs();
    });

    beforeEach(() => {
      vi.stubEnv("LOG_FILE", logFilePath);
      vi.stubEnv("LOKI_URL", "");
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    const handler = plugin.tools?.[0]?.handler;

    it("returns matching log entries from file", async () => {
      const result = await handler?.(mockCtx, { since: "5m" }, {
        threadId: "t-1",
      } as never);

      expect(typeof result).toBe("string");
      expect(result).toContain("Something broke");
      expect(result).toContain("All good");
    });

    it("filters by errorsOnly", async () => {
      // errorsOnly appends .error to the file path — will get a file not found
      const result = await handler?.(mockCtx, { errorsOnly: true }, {
        threadId: "t-1",
      } as never);

      expect(typeof result).toBe("string");
      // The .error file doesn't exist, so we get an error message
      expect(result).toContain("Log query error");
    });

    it("returns no-backend message when neither env var is set", async () => {
      vi.stubEnv("LOG_FILE", "");
      vi.stubEnv("LOKI_URL", "");

      const result = await handler?.(mockCtx, {}, {
        threadId: "t-1",
      } as never);

      expect(result).toContain("No log backend configured");
    });

    it("filters by source", async () => {
      const result = await handler?.(mockCtx, {
        source: "web",
        since: "5m",
      }, { threadId: "t-1" } as never);

      expect(typeof result).toBe("string");
      expect(result).toContain("Something broke");
      expect(result).not.toContain("All good");
    });

    it("filters by threadId", async () => {
      const result = await handler?.(mockCtx, {
        threadId: "t-2",
        since: "5m",
      }, { threadId: "t-1" } as never);

      expect(typeof result).toBe("string");
      expect(result).toContain("All good");
      expect(result).not.toContain("Something broke");
    });
  });
});
