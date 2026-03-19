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

  it("returns error when fetch throws", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("ECONNREFUSED"));

    const result = await queryLoki(BASE_PARAMS);

    expect(result.entries).toHaveLength(0);
    expect(result.error).toContain("Failed to query Loki");
    expect(result.error).toContain("ECONNREFUSED");
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

  it("constructs the correct URL with query parameters", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { result: [] } }),
    } as Response);

    await queryLoki(BASE_PARAMS);

    const calledUrl = vi.mocked(fetch).mock.calls[0]?.[0] as string;
    const url = new URL(calledUrl);
    expect(url.pathname).toBe("/loki/api/v1/query_range");
    expect(url.searchParams.get("query")).toBe('{app="harness"}');
    expect(url.searchParams.get("direction")).toBe("backward");
    expect(url.searchParams.get("limit")).toBe("100");
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
});
