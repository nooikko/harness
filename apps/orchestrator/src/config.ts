// Orchestrator configuration

export type OrchestratorConfig = {
  databaseUrl: string;
  timezone: string;
  maxConcurrentAgents: number;
};

type LoadConfig = () => OrchestratorConfig;

export const loadConfig: LoadConfig = () => ({
  databaseUrl: process.env.DATABASE_URL ?? "",
  timezone: process.env.TZ ?? "America/Phoenix",
  maxConcurrentAgents: Number(process.env.MAX_CONCURRENT_AGENTS ?? "3"),
});
