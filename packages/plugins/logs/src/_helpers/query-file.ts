import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import { createInterface } from "node:readline";

type QueryFileParams = {
  filePath: string;
  level?: string;
  source?: string;
  threadId?: string;
  traceId?: string;
  search?: string;
  since: Date;
  limit: number;
};

type QueryFileResult = {
  entries: string[];
  error?: string;
};

type ParseDuration = (duration: string) => number;

export const parseDuration: ParseDuration = (duration) => {
  const match = /^(\d+)(m|h|d)$/.exec(duration);
  if (!match) return 15 * 60 * 1000; // default 15m
  const value = Number(match[1]);
  const unit = match[2] ?? "m";
  const multipliers: Record<string, number> = { m: 60_000, h: 3_600_000, d: 86_400_000 };
  return value * (multipliers[unit] ?? 60_000);
};

const LEVEL_VALUES: Record<string, number> = {
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

type QueryFile = (params: QueryFileParams) => Promise<QueryFileResult>;

export const queryFile: QueryFile = async ({
  filePath,
  level,
  source,
  threadId,
  traceId,
  search,
  since,
  limit,
}) => {
  try {
    await access(filePath);
  } catch {
    return { entries: [], error: `Log file not found: ${filePath}` };
  }

  const entries: string[] = [];
  const minLevel = level ? (LEVEL_VALUES[level] ?? 0) : 0;
  const sinceMs = since.getTime();

  try {
    const stream = createReadStream(filePath, { encoding: "utf-8" });
    const rl = createInterface({ input: stream, crlfDelay: Infinity });

    for await (const line of rl) {
      if (entries.length >= limit) break;
      if (!line.trim()) continue;

      try {
        const entry = JSON.parse(line) as Record<string, unknown>;

        // Filter by time
        const entryTime = typeof entry.time === "number" ? entry.time : 0;
        if (entryTime < sinceMs) continue;

        // Filter by level
        const entryLevel =
          typeof entry.level === "number" ? entry.level : 0;
        if (entryLevel < minLevel) continue;

        // Filter by source/pluginName
        if (source) {
          const entrySource =
            (entry.pluginName as string) ??
            (entry.prefix as string) ??
            "";
          if (
            !entrySource.toLowerCase().includes(source.toLowerCase())
          )
            continue;
        }

        // Filter by threadId
        if (threadId && entry.threadId !== threadId) continue;

        // Filter by traceId
        if (traceId && entry.traceId !== traceId) continue;

        // Filter by search text
        if (search) {
          const msg =
            (entry.msg as string) ?? (entry.message as string) ?? "";
          if (!msg.toLowerCase().includes(search.toLowerCase()))
            continue;
        }

        entries.push(line);
      } catch {
        // Skip non-JSON lines
        continue;
      }
    }

    return { entries };
  } catch (err) {
    return {
      entries,
      error: `Error reading log file: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
};
