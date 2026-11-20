/**
 * Seed script: creates a demo agency and admin user for local development.
 * Run with: npm run db:seed
 */
import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1. Create Superadmin User (system owner)
  const superadmin = await prisma.user.upsert({
    where: { email: 'admin@policydiff.com' },
    update: { role: UserRole.SUPERADMIN },
    create: {
      email: 'admin@policydiff.com',
      name: 'Platform Superadmin',
      role: UserRole.SUPERADMIN,
      emailVerified: new Date(),
    },
  });

  // 2. Create Demo Agency
  const agency = await prisma.agency.upsert({
    where: { slug: 'demo-agency' },
    update: {},
    create: {
      name: 'Demo Insurance Agency',
      slug: 'demo-agency',
      billingContactEmail: 'billing@demo-agency.com',
      retentionDays: 90,
    },
  });

  // 3. Create Subscription for Demo Agency
  const trialEnds = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await prisma.subscription.upsert({
    where: { agencyId: agency.id },
    update: {},
    create: {
      agencyId: agency.id,
      plan: 'TRIAL',
      billingPeriod: 'MONTHLY',
      status: 'TRIAL',
      currentPeriodStart: new Date(),
      currentPeriodEnd: trialEnds,
      trialEndsAt: trialEnds,
      checksLimit: 3,
      checksUsed: 0,
    },
  });

  // 4. Create Agency Admin user
  const user = await prisma.user.upsert({
    where: { email: 'admin@demo-agency.com' },
    update: {},
    create: {
      email: 'admin@demo-agency.com',
      name: 'Demo Agency Admin',
      role: UserRole.ADMIN,
      agencyId: agency.id,
      emailVerified: new Date(),
    },
  });

  console.log(`Seeded Superadmin: ${superadmin.email}`);
  console.log(`Seeded Agency: ${agency.name} (${agency.id})`);
  console.log(`Seeded Agency Admin: ${user.email} (${user.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
