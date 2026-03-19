type LogsEnv = {
  lokiUrl: string | undefined;
  logFile: string | undefined;
};

type LoadLogsEnv = () => LogsEnv;

export const loadLogsEnv: LoadLogsEnv = () => ({
  lokiUrl: process.env.LOKI_URL,
  logFile: process.env.LOG_FILE,
});
