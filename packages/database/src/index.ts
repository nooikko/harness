import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

type CreatePrismaClient = () => PrismaClient;
const createPrismaClient: CreatePrismaClient = () => new PrismaClient();

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

globalForPrisma.prisma = prisma;

export * from '@prisma/client';
