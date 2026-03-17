type LoggerEnv = {
  LOG_FILE: string | undefined;
  LOG_LEVEL: string;
  NODE_ENV: string;
};

type LoadLoggerEnv = () => LoggerEnv;

export const loadLoggerEnv: LoadLoggerEnv = () => ({
  LOG_FILE: process.env.LOG_FILE,
  LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',
  NODE_ENV: process.env.NODE_ENV ?? 'development',
});
