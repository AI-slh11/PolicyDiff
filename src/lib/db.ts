import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/**
 * Set the current agency context for Row-Level Security.
 * Call this before any tenant-scoped query in a request handler.
 */
export async function setAgencyContext(agencyId: string) {
  await prisma.$executeRawUnsafe(
    `SET LOCAL app.current_agency_id = '${agencyId}'`
  );
}

/**
 * Set superadmin context for Row-Level Security to access cross-agency data.
 */
export async function setSuperadminContext() {
  await prisma.$executeRawUnsafe(
    `SET LOCAL app.is_superadmin = 'true'`
  );
}
