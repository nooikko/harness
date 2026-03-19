type QueryLokiParams = {
  lokiUrl: string;
  query: string;
  start: string;
  end: string;
  limit: number;
};

type LogEntry = {
  timestamp: string;
  line: string;
};

type QueryLokiResult = {
  entries: LogEntry[];
  error?: string;
};

type QueryLoki = (params: QueryLokiParams) => Promise<QueryLokiResult>;

export const queryLoki: QueryLoki = async ({
  lokiUrl,
  query,
  start,
  end,
  limit,
}) => {
  try {
    const url = new URL("/loki/api/v1/query_range", lokiUrl);
    url.searchParams.set("query", query);
    url.searchParams.set("start", start);
    url.searchParams.set("end", end);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("direction", "backward");

    const response = await fetch(url.toString());
    if (!response.ok) {
      const body = await response.text();
      return { entries: [], error: `Loki returned ${response.status}: ${body}` };
    }

    const data = (await response.json()) as {
      data?: {
        result?: Array<{
          values?: Array<[string, string]>;
        }>;
      };
    };

    const entries: LogEntry[] = [];
    for (const stream of data.data?.result ?? []) {
      for (const [ts, line] of stream.values ?? []) {
        entries.push({ timestamp: ts, line });
      }
    }

    // Sort by timestamp descending (newest first)
    entries.sort((a, b) =>
      BigInt(b.timestamp) > BigInt(a.timestamp) ? 1 : -1,
    );

    return { entries: entries.slice(0, limit) };
  } catch (err) {
    return {
      entries: [],
      error: `Failed to query Loki: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
};
