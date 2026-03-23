import { describe, expect, it } from "vitest";
import { ToolError } from "../index";

describe("ToolError", () => {
  it("defaults code to TOOL_ERROR", () => {
    const err = new ToolError("something broke");
    expect(err.code).toBe("TOOL_ERROR");
  });

  it("preserves a custom code", () => {
    const err = new ToolError("not found", "NOT_FOUND");
    expect(err.code).toBe("NOT_FOUND");
  });

  it("is an instance of Error", () => {
    const err = new ToolError("boom");
    expect(err).toBeInstanceOf(Error);
  });

  it("has name set to ToolError", () => {
    const err = new ToolError("boom");
    expect(err.name).toBe("ToolError");
  });

  it("preserves the message", () => {
    const err = new ToolError("detailed failure reason");
    expect(err.message).toBe("detailed failure reason");
  });
});
