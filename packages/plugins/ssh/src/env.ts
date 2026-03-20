type SshEnv = {
  encryptionKey: string | undefined;
};

type LoadSshEnv = () => SshEnv;

export const loadSshEnv: LoadSshEnv = () => ({
  encryptionKey: process.env.HARNESS_ENCRYPTION_KEY,
});
