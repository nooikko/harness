import { createCipheriv, randomBytes } from 'node:crypto';
import { getEncryptionKey } from './get-encryption-key';

const ALGORITHM = 'aes-256-gcm';

type EncryptToken = (plaintext: string) => string;

const encryptToken: EncryptToken = (plaintext) => {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Format: iv:authTag:ciphertext (all base64)
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
};

export { encryptToken };
