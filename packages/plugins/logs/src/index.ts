import type {
  PluginContext,
  PluginDefinition,
  PluginHooks,
  PluginTool,
} from "@harness/plugin-contract";
import { loadLogsEnv } from "./env";
import { parseDuration, queryFile } from "./_helpers/query-file";
import { queryLoki } from "./_helpers/query-loki";

type CreateTools = () => PluginTool[];

const createTools: CreateTools = () => [
  {
    name: "query",
    description: `Search structured logs from the running Harness instance. Use this to diagnose errors, trace pipeline execution, or investigate plugin behavior.

Diagnostic workflow:
1. Start with errorsOnly=true to quickly find errors
2. If you have a threadId (from the URL of the page you're testing), filter by it
3. Use source to narrow to a specific plugin (e.g., "identity", "cron", "delegation")
4. Use search for text matching in log messages
5. Expand the time window with since if needed (default: 15m)

When diagnosing Playwright test failures:
- The threadId is in the URL path (/chat/{threadId})
- Query with that threadId and since="5m" to find related errors
- Check errorsOnly first, then widen to level="info" for context`,
    schema: {
      type: "object",
      properties: {
        level: {
          type: "string",
          enum: ["debug", "info", "warn", "error"],
          description:
            "Minimum log level to return (default: all levels)",
        },
        source: {
          type: "string",
          description:
            "Filter by plugin name or service (e.g., 'identity', 'cron', 'web', 'orchestrator')",
        },
        threadId: {
          type: "string",
          description:
            "Filter by thread ID — use this to correlate with Playwright test targets",
        },
        traceId: {
          type: "string",
          description:
            "Filter by trace ID for a specific pipeline execution",
        },
        search: {
          type: "string",
          description: "Text search in log messages (case-insensitive)",
        },
        since: {
          type: "string",
          description:
            "Time window to search (e.g., '5m', '1h', '2h'). Default: '15m'",
        },
        limit: {
          type: "number",
          description:
            "Maximum number of log entries to return. Default: 100",
        },
        errorsOnly: {
          type: "boolean",
          description:
            "If true, reads from the error-only log file for faster diagnosis. Default: false",
        },
      },
    },
    handler: async (ctx, input) => {
      const params = input as {
        level?: string;
        source?: string;
        threadId?: string;
        traceId?: string;
        search?: string;
        since?: string;
        limit?: number;
        errorsOnly?: boolean;
      };

      const sinceStr = params.since ?? "15m";
      const limit = params.limit ?? 100;
      const durationMs = parseDuration(sinceStr);
      const since = new Date(Date.now() - durationMs);

      const env = loadLogsEnv();

      // Strategy 1: Query Loki if available
      if (env.lokiUrl) {
        // Build LogQL query
        const labelFilters: string[] = ['app="harness"'];
        if (params.source) {
          labelFilters.push(`pluginName="${params.source}"`);
        }

        let logqlQuery = `{${labelFilters.join(", ")}}`;

        // Add JSON parser for structured filtering
        logqlQuery += " | json";

        if (params.level) {
          const levelNum =
            params.level === "debug"
              ? 20
              : params.level === "info"
                ? 30
                : params.level === "warn"
                  ? 40
                  : 50;
          logqlQuery += ` | level >= ${levelNum}`;
        }
        if (params.threadId) {
          logqlQuery += ` | threadId="${params.threadId}"`;
        }
        if (params.traceId) {
          logqlQuery += ` | traceId="${params.traceId}"`;
        }
        if (params.search) {
          logqlQuery += ` |~ \`(?i)${params.search}\``;
        }

        const startNano = String(since.getTime() * 1_000_000);
        const endNano = String(Date.now() * 1_000_000);

        const result = await queryLoki({
          lokiUrl: env.lokiUrl,
          query: logqlQuery,
          start: startNano,
          end: endNano,
          limit,
        });

        if (result.error) {
          ctx.logger.warn(
            `logs query: Loki query failed, falling back to file: ${result.error}`,
          );
          // Fall through to file query below
        } else {
          const formatted = result.entries
            .map((e) => e.line)
            .join("\n");
          return (
            formatted ||
            `No log entries found matching query (Loki, last ${sinceStr})`
          );
        }
      }

      // Strategy 2: Query log files
      if (env.logFile) {
        const filePath = params.errorsOnly
          ? `${env.logFile}.error`
          : env.logFile;

        const result = await queryFile({
          filePath,
          level: params.errorsOnly ? "error" : params.level,
          source: params.source,
          threadId: params.threadId,
          traceId: params.traceId,
          search: params.search,
          since,
          limit,
        });

        if (result.error) {
          return `Log query error: ${result.error}`;
        }

        return (
          result.entries.join("\n") ||
          `No log entries found matching query (file, last ${sinceStr})`
        );
      }

      return "No log backend configured. Set LOG_FILE for file-based logging or LOKI_URL for Loki-based logging.";
    },
  },
];

type CreateRegister = () => PluginDefinition["register"];

const createRegister: CreateRegister = () => {
  const register = async (ctx: PluginContext): Promise<PluginHooks> => {
    const env = loadLogsEnv();
    ctx.logger.info(
      `Logs plugin registered [loki=${Boolean(env.lokiUrl)}, file=${Boolean(env.logFile)}]`,
    );
    return {};
  };

  return register;
};

export const plugin: PluginDefinition = {
  name: "logs",
  version: "1.0.0",
  register: createRegister(),
  tools: createTools(),
};
