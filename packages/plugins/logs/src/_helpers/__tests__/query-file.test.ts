import { writeFileSync, mkdtempSync, unlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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

  it("returns default 15m for invalid input", () => {
    expect(parseDuration("abc")).toBe(15 * 60 * 1000);
  });

  it("returns default 15m for empty string", () => {
    expect(parseDuration("")).toBe(15 * 60 * 1000);
  });

  it("returns default 15m for unsupported unit", () => {
    expect(parseDuration("5s")).toBe(15 * 60 * 1000);
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
});
