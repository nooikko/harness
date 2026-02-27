import type { PrismaClient } from 'database';

type CreateScopedDb = (db: PrismaClient, pluginName: string) => PrismaClient;

export const createScopedDb: CreateScopedDb = (db, pluginName) => {
  return db.$extends({
    query: {
      pluginConfig: {
        findUnique: async ({ args, query }) => {
          return query({ ...args, where: { ...args.where, pluginName } });
        },
        upsert: async ({ args, query }) => {
          return query({
            ...args,
            where: { ...args.where, pluginName },
            create: { ...args.create, pluginName },
            update: args.update,
          });
        },
        update: async ({ args, query }) => {
          return query({ ...args, where: { ...args.where, pluginName } });
        },
      },
    },
  }) as unknown as PrismaClient;
};
