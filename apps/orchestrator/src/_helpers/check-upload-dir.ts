// Verify UPLOAD_DIR exists and is writable at startup

import { access, constants, mkdir } from 'node:fs/promises';

type Logger = {
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  info: (msg: string, meta?: Record<string, unknown>) => void;
};

type CheckUploadDir = (dir: string, logger: Logger) => Promise<void>;

export const checkUploadDir: CheckUploadDir = async (dir, logger) => {
  try {
    await mkdir(dir, { recursive: true });
    await access(dir, constants.W_OK);
    logger.info('Upload directory verified', { dir });
  } catch (err) {
    logger.warn(`UPLOAD_DIR '${dir}' is not writable: ${err instanceof Error ? err.message : String(err)}. File uploads will fail.`);
  }
};
