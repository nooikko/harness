import { describe, expect, it } from "vitest";
import { buildSourceId, extractChannelId, resolveChannel } from "../channel-resolver";

describe("channel-resolver", () => {
  describe("resolveChannel", () => {
    it("resolves a text channel to a sourceId", () => {
      const mockChannel = {
        id: "123456789",
        name: "general",
        isThread: () => false,
      };

      const result = resolveChannel(mockChannel as never);

      expect(result).toEqual({
        sourceId: "discord:123456789",
        channelName: "general",
        isThread: false,
        parentChannelId: null,
      });
    });

    it("resolves a thread channel with parent reference", () => {
      const mockThread = {
        id: "987654321",
        name: "task-thread",
        isThread: () => true,
        parentId: "123456789",
      };

      const result = resolveChannel(mockThread as never);

      expect(result).toEqual({
        sourceId: "discord:987654321",
        channelName: "task-thread",
        isThread: true,
        parentChannelId: "123456789",
      });
    });

    it("handles thread with null name", () => {
      const mockThread = {
        id: "987654321",
        name: null,
        isThread: () => true,
        parentId: "123456789",
      };

      const result = resolveChannel(mockThread as never);

      expect(result.channelName).toBe("thread-987654321");
    });

    it("falls back to channel id when name is not present", () => {
      const mockChannel = {
        id: "111222333",
        isThread: () => false,
      };

      const result = resolveChannel(mockChannel as never);

      expect(result.channelName).toBe("111222333");
    });
  });

  describe("buildSourceId", () => {
    it("creates a sourceId from a channel id", () => {
      expect(buildSourceId("123456789")).toBe("discord:123456789");
    });

    it("creates a sourceId from a thread id", () => {
      expect(buildSourceId("987654321")).toBe("discord:987654321");
    });
  });

  describe("extractChannelId", () => {
    it("extracts channel id from a discord sourceId", () => {
      expect(extractChannelId("discord:123456789")).toBe("123456789");
    });

    it("returns null for non-discord sourceIds", () => {
      expect(extractChannelId("web:session-abc")).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(extractChannelId("")).toBeNull();
    });

    it("handles sourceId with only prefix", () => {
      expect(extractChannelId("discord:")).toBe("");
    });
  });
});
