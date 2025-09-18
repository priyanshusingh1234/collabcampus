import { PrismaClient } from '@prisma/client';

// Ensure we reuse a single Prisma instance across HMR in Next.js dev
const globalForPrisma = global as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
