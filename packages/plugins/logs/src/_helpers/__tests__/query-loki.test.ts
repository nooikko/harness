import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryLoki } from "../query-loki";

const BASE_PARAMS = {
  lokiUrl: "http://localhost:3100",
  query: '{app="harness"}',
  start: "1000000000000000000",
  end: "2000000000000000000",
  limit: 100,
};

describe("queryLoki", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns parsed entries from a successful query", async () => {
    const mockResponse = {
      data: {
        result: [
          {
            values: [
              ["1700000000000000000", '{"level":30,"msg":"hello"}'],
              ["1600000000000000000", '{"level":50,"msg":"error"}'],
            ],
          },
          {
            values: [
              ["1500000000000000000", '{"level":30,"msg":"world"}'],
            ],
          },
        ],
      },
    };

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const result = await queryLoki(BASE_PARAMS);

    expect(result.error).toBeUndefined();
    expect(result.entries).toHaveLength(3);
    // Sorted by timestamp descending
    expect(result.entries[0]?.timestamp).toBe("1700000000000000000");
    expect(result.entries[1]?.timestamp).toBe("1600000000000000000");
    expect(result.entries[2]?.timestamp).toBe("1500000000000000000");
  });

  it("preserves log line content in entries", async () => {
    const logLine = '{"level":30,"msg":"hello world","extra":"data"}';
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          result: [{ values: [["1700000000000000000", logLine]] }],
        },
      }),
    } as Response);

    const result = await queryLoki(BASE_PARAMS);

    expect(result.entries[0]?.line).toBe(logLine);
  });

  it("returns empty entries for empty results", async () => {
    const mockResponse = {
      data: {
        result: [],
      },
    };

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const result = await queryLoki(BASE_PARAMS);

    expect(result.error).toBeUndefined();
    expect(result.entries).toHaveLength(0);
  });

  it("returns error for non-200 response", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => "Bad Request: invalid query",
    } as Response);

    const result = await queryLoki(BASE_PARAMS);

    expect(result.entries).toHaveLength(0);
    expect(result.error).toContain("Loki returned 400");
    expect(result.error).toContain("Bad Request: invalid query");
  });

  it("returns error for 500 server error", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    } as Response);

    const result = await queryLoki(BASE_PARAMS);

    expect(result.entries).toHaveLength(0);
    expect(result.error).toBe("Loki returned 500: Internal Server Error");
  });

  it("returns error when fetch throws an Error", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("ECONNREFUSED"));

    const result = await queryLoki(BASE_PARAMS);

    expect(result.entries).toHaveLength(0);
    expect(result.error).toContain("Failed to query Loki");
    expect(result.error).toContain("ECONNREFUSED");
  });

  it("returns error when fetch throws a non-Error value", async () => {
    vi.mocked(fetch).mockRejectedValue("socket hang up");

    const result = await queryLoki(BASE_PARAMS);

    expect(result.entries).toHaveLength(0);
    expect(result.error).toBe("Failed to query Loki: socket hang up");
  });

  it("respects the limit parameter", async () => {
    const values: Array<[string, string]> = [];
    for (let i = 0; i < 200; i++) {
      values.push([String(1700000000000000000n + BigInt(i)), `line-${i}`]);
    }

    const mockResponse = {
      data: {
        result: [{ values }],
      },
    };

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const result = await queryLoki({ ...BASE_PARAMS, limit: 50 });

    expect(result.error).toBeUndefined();
    expect(result.entries).toHaveLength(50);
  });

  it("constructs the correct URL with all query parameters", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { result: [] } }),
    } as Response);

    await queryLoki(BASE_PARAMS);

    const calledUrl = vi.mocked(fetch).mock.calls[0]?.[0] as string;
    const url = new URL(calledUrl);
    expect(url.origin).toBe("http://localhost:3100");
    expect(url.pathname).toBe("/loki/api/v1/query_range");
    expect(url.searchParams.get("query")).toBe('{app="harness"}');
    expect(url.searchParams.get("start")).toBe("1000000000000000000");
    expect(url.searchParams.get("end")).toBe("2000000000000000000");
    expect(url.searchParams.get("limit")).toBe("100");
    expect(url.searchParams.get("direction")).toBe("backward");
  });

  it("handles missing data.result gracefully", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: {} }),
    } as Response);

    const result = await queryLoki(BASE_PARAMS);

    expect(result.error).toBeUndefined();
    expect(result.entries).toHaveLength(0);
  });

  it("handles missing data property gracefully", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);

    const result = await queryLoki(BASE_PARAMS);

    expect(result.error).toBeUndefined();
    expect(result.entries).toHaveLength(0);
  });

  it("handles stream with missing values array", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          result: [
            { values: [["1700000000000000000", "line-a"]] },
            {},
            { values: [["1600000000000000000", "line-b"]] },
          ],
        },
      }),
    } as Response);

    const result = await queryLoki(BASE_PARAMS);

    expect(result.error).toBeUndefined();
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]?.line).toBe("line-a");
    expect(result.entries[1]?.line).toBe("line-b");
  });

  it("sorts entries with equal timestamps deterministically", async () => {
    const ts = "1700000000000000000";
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          result: [
            { values: [[ts, "line-a"], [ts, "line-b"]] },
          ],
        },
      }),
    } as Response);

    const result = await queryLoki(BASE_PARAMS);

    expect(result.entries).toHaveLength(2);
    // Both have the same timestamp — sort comparator returns -1 (a <= b)
    expect(result.entries[0]?.timestamp).toBe(ts);
    expect(result.entries[1]?.timestamp).toBe(ts);
  });

  it("sorts entries where earlier timestamp comes first in input", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          result: [
            {
              values: [
                ["1500000000000000000", "older"],
                ["1700000000000000000", "newer"],
              ],
            },
          ],
        },
      }),
    } as Response);

    const result = await queryLoki(BASE_PARAMS);

    expect(result.entries).toHaveLength(2);
    // Descending: newer first
    expect(result.entries[0]?.line).toBe("newer");
    expect(result.entries[1]?.line).toBe("older");
  });
});
