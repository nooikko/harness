// Orchestrator configuration

type OrchestratorConfig = {
  databaseUrl: string;
  timezone: string;
  maxConcurrentAgents: number;
};

const loadConfig = (): OrchestratorConfig => ({
  databaseUrl: process.env.DATABASE_URL ?? "",
  timezone: process.env.TZ ?? "America/Phoenix",
  maxConcurrentAgents: Number(process.env.MAX_CONCURRENT_AGENTS ?? "3"),
});

export { loadConfig };
export type { OrchestratorConfig };
