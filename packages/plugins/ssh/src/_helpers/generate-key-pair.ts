import { generateKeyPairSync } from 'node:crypto';

type KeyPairResult = {
  privateKey: string;
  publicKey: string;
};

type GenerateKeyPair = () => KeyPairResult;

export const generateKeyPair: GenerateKeyPair = () => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519', {
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
    publicKeyEncoding: {
      type: 'spki',
      format: 'der',
    },
  });

  // Build OpenSSH wire format: string "ssh-ed25519" + string <32-byte raw key>
  // SPKI DER for ed25519 is always 44 bytes: 12-byte header + 32-byte raw key
  const rawKey = publicKey.subarray(12);

  const typeStr = 'ssh-ed25519';
  const typeLen = Buffer.alloc(4);
  typeLen.writeUInt32BE(typeStr.length);

  const keyLen = Buffer.alloc(4);
  keyLen.writeUInt32BE(rawKey.length);

  const opensshBlob = Buffer.concat([typeLen, Buffer.from(typeStr), keyLen, rawKey]);

  return {
    privateKey,
    publicKey: `ssh-ed25519 ${opensshBlob.toString('base64')} harness-generated`,
  };
};
