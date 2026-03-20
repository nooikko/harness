import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { parseDuration, queryFile } from "../query-file";

describe("parseDuration", () => {
  it("parses minutes", () => {
    expect(parseDuration("5m")).toBe(5 * 60 * 1000);
  });

  it("parses hours", () => {
    expect(parseDuration("1h")).toBe(60 * 60 * 1000);
  });

  it("parses days", () => {
    expect(parseDuration("2d")).toBe(2 * 24 * 60 * 60 * 1000);
  });

  it("parses large values", () => {
    expect(parseDuration("100m")).toBe(100 * 60 * 1000);
  });

  it("returns default 15m for invalid input", () => {
    expect(parseDuration("abc")).toBe(15 * 60 * 1000);
  });

  it("returns default 15m for empty string", () => {
    expect(parseDuration("")).toBe(15 * 60 * 1000);
  });

  it("returns default 15m for unsupported unit", () => {
    expect(parseDuration("5s")).toBe(15 * 60 * 1000);
  });

  it("returns default 15m for missing number", () => {
    expect(parseDuration("m")).toBe(15 * 60 * 1000);
  });
});

describe("queryFile", () => {
  let tempDir: string;
  let logFilePath: string;

  const now = Date.now();
  const fiveMinAgo = now - 5 * 60 * 1000;
  const thirtyMinAgo = now - 30 * 60 * 1000;

  const logLines = [
    JSON.stringify({
      level: 30,
      time: fiveMinAgo,
      msg: "Server started",
      pluginName: "web",
      threadId: "thread-1",
      traceId: "trace-1",
    }),
    JSON.stringify({
      level: 50,
      time: fiveMinAgo,
      msg: "Connection failed",
      pluginName: "discord",
      threadId: "thread-2",
      traceId: "trace-2",
    }),
    JSON.stringify({
      level: 40,
      time: now,
      msg: "High memory usage warning",
      pluginName: "identity",
      threadId: "thread-1",
      traceId: "trace-3",
    }),
    JSON.stringify({
      level: 20,
      time: thirtyMinAgo,
      msg: "Debug detail",
      pluginName: "cron",
      threadId: "thread-3",
      traceId: "trace-4",
    }),
    "this is not valid json",
    JSON.stringify({
      level: 30,
      time: now,
      msg: "Pipeline complete",
      pluginName: "activity",
      threadId: "thread-1",
      traceId: "trace-1",
    }),
  ];

  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), "logs-test-"));
    logFilePath = join(tempDir, "test.log");
    writeFileSync(logFilePath, logLines.join("\n") + "\n");
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns all entries within time window", async () => {
    const result = await queryFile({
      filePath: logFilePath,
      since: new Date(now - 10 * 60 * 1000),
      limit: 100,
    });

    expect(result.error).toBeUndefined();
    // Should get 4 entries (lines 1, 2, 3, 5 — excluding the 30min ago entry and non-JSON)
    expect(result.entries).toHaveLength(4);
  });

  it("filters by level", async () => {
    const result = await queryFile({
      filePath: logFilePath,
      level: "error",
      since: new Date(now - 10 * 60 * 1000),
      limit: 100,
    });

    expect(result.error).toBeUndefined();
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toContain("Connection failed");
  });

  it("filters by warn level includes warn and above", async () => {
    const result = await queryFile({
      filePath: logFilePath,
      level: "warn",
      since: new Date(now - 10 * 60 * 1000),
      limit: 100,
    });

    expect(result.error).toBeUndefined();
    expect(result.entries).toHaveLength(2);
  });

  it("treats unknown level string as minLevel 0", async () => {
    const result = await queryFile({
      filePath: logFilePath,
      level: "unknown-level",
      since: new Date(now - 60 * 60 * 1000),
      limit: 100,
    });

    expect(result.error).toBeUndefined();
    // minLevel=0 means all entries pass the level filter
    expect(result.entries).toHaveLength(5);
  });

  it("filters by source/pluginName", async () => {
    const result = await queryFile({
      filePath: logFilePath,
      source: "web",
      since: new Date(now - 10 * 60 * 1000),
      limit: 100,
    });

    expect(result.error).toBeUndefined();
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toContain("Server started");
  });

  it("filters by source case-insensitively", async () => {
    const result = await queryFile({
      filePath: logFilePath,
      source: "WEB",
      since: new Date(now - 10 * 60 * 1000),
      limit: 100,
    });

    expect(result.error).toBeUndefined();
    expect(result.entries).toHaveLength(1);
  });

  it("falls back to prefix field for source matching", async () => {
    const prefixLog = join(tempDir, "prefix.log");
    const lines = [
      JSON.stringify({
        level: 30,
        time: now,
        msg: "From prefix source",
        prefix: "my-plugin",
      }),
      JSON.stringify({
        level: 30,
        time: now,
        msg: "No source fields",
      }),
    ];
    writeFileSync(prefixLog, lines.join("\n") + "\n");

    const result = await queryFile({
      filePath: prefixLog,
      source: "my-plugin",
      since: new Date(now - 60 * 1000),
      limit: 100,
    });

    expect(result.error).toBeUndefined();
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toContain("From prefix source");
  });

  it("excludes entries with no pluginName or prefix when source is set", async () => {
    const noSourceLog = join(tempDir, "no-source.log");
    const lines = [
      JSON.stringify({
        level: 30,
        time: now,
        msg: "No source at all",
      }),
    ];
    writeFileSync(noSourceLog, lines.join("\n") + "\n");

    const result = await queryFile({
      filePath: noSourceLog,
      source: "anything",
      since: new Date(now - 60 * 1000),
      limit: 100,
    });

    expect(result.error).toBeUndefined();
    expect(result.entries).toHaveLength(0);
  });

  it("filters by threadId", async () => {
    const result = await queryFile({
      filePath: logFilePath,
      threadId: "thread-1",
      since: new Date(now - 10 * 60 * 1000),
      limit: 100,
    });

    expect(result.error).toBeUndefined();
    expect(result.entries).toHaveLength(3);
  });

  it("filters by traceId", async () => {
    const result = await queryFile({
      filePath: logFilePath,
      traceId: "trace-2",
      since: new Date(now - 10 * 60 * 1000),
      limit: 100,
    });

    expect(result.error).toBeUndefined();
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toContain("Connection failed");
  });

  it("filters by search text", async () => {
    const result = await queryFile({
      filePath: logFilePath,
      search: "memory",
      since: new Date(now - 10 * 60 * 1000),
      limit: 100,
    });

    expect(result.error).toBeUndefined();
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toContain("High memory usage");
  });

  it("filters by search text case-insensitively", async () => {
    const result = await queryFile({
      filePath: logFilePath,
      search: "MEMORY",
      since: new Date(now - 10 * 60 * 1000),
      limit: 100,
    });

    expect(result.error).toBeUndefined();
    expect(result.entries).toHaveLength(1);
  });

  it("falls back to message field for search matching", async () => {
    const messageLog = join(tempDir, "message-field.log");
    const lines = [
      JSON.stringify({
        level: 30,
        time: now,
        message: "Found via message field",
      }),
    ];
    writeFileSync(messageLog, lines.join("\n") + "\n");

    const result = await queryFile({
      filePath: messageLog,
      search: "message field",
      since: new Date(now - 60 * 1000),
      limit: 100,
    });

    expect(result.error).toBeUndefined();
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toContain("Found via message field");
  });

  it("excludes entries with no msg or message when search is set", async () => {
    const noMsgLog = join(tempDir, "no-msg.log");
    const lines = [
      JSON.stringify({
        level: 30,
        time: now,
        data: "some other field",
      }),
    ];
    writeFileSync(noMsgLog, lines.join("\n") + "\n");

    const result = await queryFile({
      filePath: noMsgLog,
      search: "anything",
      since: new Date(now - 60 * 1000),
      limit: 100,
    });

    expect(result.error).toBeUndefined();
    expect(result.entries).toHaveLength(0);
  });

  it("filters by since time", async () => {
    const result = await queryFile({
      filePath: logFilePath,
      since: new Date(now - 1 * 60 * 1000),
      limit: 100,
    });

    expect(result.error).toBeUndefined();
    // Only entries with time >= 1 min ago (the "now" entries)
    expect(result.entries).toHaveLength(2);
  });

  it("respects limit", async () => {
    const result = await queryFile({
      filePath: logFilePath,
      since: new Date(now - 60 * 60 * 1000),
      limit: 2,
    });

    expect(result.error).toBeUndefined();
    expect(result.entries).toHaveLength(2);
  });

  it("returns error for non-existent file", async () => {
    const result = await queryFile({
      filePath: "/nonexistent/path/to/log.file",
      since: new Date(now - 60 * 60 * 1000),
      limit: 100,
    });

    expect(result.entries).toHaveLength(0);
    expect(result.error).toContain("Log file not found");
  });

  it("skips non-JSON lines gracefully", async () => {
    const result = await queryFile({
      filePath: logFilePath,
      since: new Date(now - 60 * 60 * 1000),
      limit: 100,
    });

    expect(result.error).toBeUndefined();
    // 5 valid JSON lines total, non-JSON line is skipped
    expect(result.entries).toHaveLength(5);
  });

  it("combines multiple filters", async () => {
    const result = await queryFile({
      filePath: logFilePath,
      level: "info",
      threadId: "thread-1",
      source: "activity",
      since: new Date(now - 10 * 60 * 1000),
      limit: 100,
    });

    expect(result.error).toBeUndefined();
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toContain("Pipeline complete");
  });

  it("skips empty lines", async () => {
    const emptyLinesLog = join(tempDir, "empty-lines.log");
    const lines = [
      "",
      "   ",
      JSON.stringify({ level: 30, time: now, msg: "valid" }),
      "",
    ];
    writeFileSync(emptyLinesLog, lines.join("\n") + "\n");

    const result = await queryFile({
      filePath: emptyLinesLog,
      since: new Date(now - 60 * 1000),
      limit: 100,
    });

    expect(result.error).toBeUndefined();
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toContain("valid");
  });

  it("treats entries with non-numeric time as time 0", async () => {
    const badTimeLog = join(tempDir, "bad-time.log");
    const lines = [
      JSON.stringify({
        level: 30,
        time: "not-a-number",
        msg: "bad time",
      }),
      JSON.stringify({
        level: 30,
        msg: "missing time",
      }),
    ];
    writeFileSync(badTimeLog, lines.join("\n") + "\n");

    // since is in the past, but entries have time=0 which is before since
    const result = await queryFile({
      filePath: badTimeLog,
      since: new Date(now - 60 * 1000),
      limit: 100,
    });

    expect(result.error).toBeUndefined();
    expect(result.entries).toHaveLength(0);
  });

  it("treats entries with non-numeric level as level 0", async () => {
    const badLevelLog = join(tempDir, "bad-level.log");
    const lines = [
      JSON.stringify({
        level: "info",
        time: now,
        msg: "string level",
      }),
      JSON.stringify({
        time: now,
        msg: "missing level",
      }),
    ];
    writeFileSync(badLevelLog, lines.join("\n") + "\n");

    // Filter by warn — entries with level=0 should be excluded
    const result = await queryFile({
      filePath: badLevelLog,
      level: "warn",
      since: new Date(now - 60 * 1000),
      limit: 100,
    });

    expect(result.error).toBeUndefined();
    expect(result.entries).toHaveLength(0);
  });

  it("includes entries with non-numeric level when no level filter", async () => {
    const badLevelLog = join(tempDir, "bad-level-no-filter.log");
    const lines = [
      JSON.stringify({
        level: "info",
        time: now,
        msg: "string level",
      }),
    ];
    writeFileSync(badLevelLog, lines.join("\n") + "\n");

    const result = await queryFile({
      filePath: badLevelLog,
      since: new Date(now - 60 * 1000),
      limit: 100,
    });

    expect(result.error).toBeUndefined();
    // minLevel=0, entryLevel=0, so 0 >= 0 passes
    expect(result.entries).toHaveLength(1);
  });

  it("returns empty entries for an empty file", async () => {
    const emptyLog = join(tempDir, "empty.log");
    writeFileSync(emptyLog, "");

    const result = await queryFile({
      filePath: emptyLog,
      since: new Date(now - 60 * 1000),
      limit: 100,
    });

    expect(result.error).toBeUndefined();
    expect(result.entries).toHaveLength(0);
  });

  it("returns error when stream fails mid-read", async () => {
    // Use a directory path as filePath — access() succeeds but createReadStream fails
    const result = await queryFile({
      filePath: tempDir,
      since: new Date(now - 60 * 1000),
      limit: 100,
    });

    // createReadStream on a directory triggers an error on the stream
    expect(result.error).toContain("Error reading log file");
  });

  it("returns partial entries collected before stream error", async () => {
    // The stream error branch returns { entries, error } where entries
    // contains whatever was collected before the error. With a directory
    // path, no entries are collected before the error.
    const result = await queryFile({
      filePath: tempDir,
      since: new Date(now - 60 * 1000),
      limit: 100,
    });

    expect(result.entries).toEqual([]);
    expect(result.error).toBeDefined();
  });
});
