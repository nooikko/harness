import { Prisma, type PrismaClient } from '@prisma/client';

type StoryThreadGuard = (client: PrismaClient) => PrismaClient;

/**
 * Prisma extension that enforces mutual exclusivity of storyId and projectId on Thread.
 * A thread can belong to a Story OR a Project, not both.
 */
export const storyThreadGuard: StoryThreadGuard = (client) =>
  client.$extends({
    query: {
      thread: {
        create({ args, query }) {
          const data = args.data as Record<string, unknown>;
          if (data.storyId && data.projectId) {
            throw new Prisma.PrismaClientValidationError(
              'Thread cannot have both storyId and projectId set. A thread belongs to either a Story or a Project, not both.',
              { clientVersion: '6' },
            );
          }
          return query(args);
        },
        update({ args, query }) {
          const data = args.data as Record<string, unknown>;
          if (data.storyId && data.projectId) {
            throw new Prisma.PrismaClientValidationError(
              'Thread cannot have both storyId and projectId set. A thread belongs to either a Story or a Project, not both.',
              { clientVersion: '6' },
            );
          }
          return query(args);
        },
      },
    },
  }) as unknown as PrismaClient;
