type GetOrchestratorUrl = () => string;

export const getOrchestratorUrl: GetOrchestratorUrl = () => {
  return process.env.ORCHESTRATOR_URL ?? 'http://localhost:4001';
};
