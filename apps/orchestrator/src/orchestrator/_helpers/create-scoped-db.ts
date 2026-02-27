import type { PrismaClient } from 'database';

type CreateScopedDb = (db: PrismaClient, pluginName: string) => PrismaClient;

export const createScopedDb: CreateScopedDb = (db, pluginName) => {
  return db.$extends({
    query: {
      pluginConfig: {
        async findUnique({ args, query }) {
          return query({ ...args, where: { ...args.where, pluginName } });
        },
        async upsert({ args, query }) {
          return query({
            ...args,
            where: { ...args.where, pluginName },
            create: { ...args.create, pluginName },
            update: args.update,
          });
        },
        async update({ args, query }) {
          return query({ ...args, where: { ...args.where, pluginName } });
        },
      },
    },
  }) as unknown as PrismaClient;
};
