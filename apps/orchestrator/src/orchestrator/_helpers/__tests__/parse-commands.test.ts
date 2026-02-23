import { describe, expect, it } from "vitest";
import { parseCommands } from "../parse-commands";

describe("parseCommands", () => {
  it("parses a single slash command", () => {
    const result = parseCommands('/delegate agent "do this"');

    expect(result).toEqual([{ command: "delegate", args: 'agent "do this"' }]);
  });

  it("parses multiple commands from multiline output", () => {
    const output = `Some text here
/start worker-1
More text
/stop worker-2`;

    const result = parseCommands(output);

    expect(result).toEqual([
      { command: "start", args: "worker-1" },
      { command: "stop", args: "worker-2" },
    ]);
  });

  it("returns empty array when no commands found", () => {
    expect(parseCommands("just regular text")).toEqual([]);
  });

  it("handles commands with no arguments", () => {
    const result = parseCommands("/status");

    expect(result).toEqual([{ command: "status", args: "" }]);
  });

  it("handles commands with leading whitespace", () => {
    const result = parseCommands("  /health check");

    expect(result).toEqual([{ command: "health", args: "check" }]);
  });

  it("ignores commands with uppercase letters", () => {
    expect(parseCommands("/NotACommand")).toEqual([]);
  });

  it("can be called multiple times (regex resets)", () => {
    parseCommands("/first");
    const result = parseCommands("/second arg");

    expect(result).toEqual([{ command: "second", args: "arg" }]);
  });
});
