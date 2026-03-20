'use server';

type GenerateSshKeyResult = { success: true; privateKey: string; publicKey: string } | { error: string };
type GenerateSshKey = () => Promise<GenerateSshKeyResult>;

export const generateSshKey: GenerateSshKey = async () => {
  try {
    const { utils: sshUtils } = await import('ssh2');
    const keyPair = sshUtils.generateKeyPairSync('ed25519');
    return {
      success: true,
      privateKey: keyPair.private,
      publicKey: keyPair.public,
    };
  } catch (err) {
    return { error: `Key generation failed: ${err instanceof Error ? err.message : String(err)}` };
  }
};
