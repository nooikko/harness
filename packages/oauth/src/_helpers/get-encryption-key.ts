import { loadEnv } from '../env';

type GetEncryptionKey = () => Buffer;

const getEncryptionKey: GetEncryptionKey = () => {
  const env = loadEnv();
  const key = env.OAUTH_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('OAUTH_ENCRYPTION_KEY must be set (64 hex chars)');
  }
  const buf = Buffer.from(key, 'hex');
  if (buf.length !== 32) {
    throw new Error('OAUTH_ENCRYPTION_KEY must be exactly 32 bytes (64 hex chars)');
  }
  return buf;
};

/**
 * Validates OAUTH_ENCRYPTION_KEY format at startup if the env var is set.
 * Does nothing if the key is unset (OAuth is optional).
 * Throws immediately if the key is set but malformed, so typos are caught early.
 */
type ValidateEncryptionKeyIfSet = () => void;

const validateEncryptionKeyIfSet: ValidateEncryptionKeyIfSet = () => {
  const env = loadEnv();
  if (env.OAUTH_ENCRYPTION_KEY) {
    getEncryptionKey();
  }
};

export { getEncryptionKey, validateEncryptionKeyIfSet };
