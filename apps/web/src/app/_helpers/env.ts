type WebEnv = {
  UPLOAD_DIR: string;
  MAX_FILE_SIZE_MB: number;
  ORCHESTRATOR_URL: string;
};

type LoadEnv = () => WebEnv;

export const loadEnv: LoadEnv = () => ({
  UPLOAD_DIR: process.env.UPLOAD_DIR ?? './uploads',
  MAX_FILE_SIZE_MB: Number(process.env.MAX_FILE_SIZE_MB ?? '10'),
  ORCHESTRATOR_URL: process.env.ORCHESTRATOR_URL ?? 'http://localhost:4001',
});
