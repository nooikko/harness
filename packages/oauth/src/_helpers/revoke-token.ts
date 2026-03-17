import type { PrismaClient } from '@harness/database';

type RevokeToken = (provider: string, accountId: string, db: PrismaClient) => Promise<void>;

const revokeToken: RevokeToken = async (provider, accountId, db) => {
  await db.oAuthToken.deleteMany({
    where: { provider, accountId },
  });
};

export { revokeToken };
