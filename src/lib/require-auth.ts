import { auth } from '@/lib/auth';
import { prisma, setAgencyContext, setSuperadminContext } from '@/lib/db';
import { redirect } from 'next/navigation';

/**
 * Check if an email is listed in SUPERADMIN_EMAILS
 */
export function isSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const adminEmails = (process.env.SUPERADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(email.toLowerCase());
}

/**
 * Server-side helper: require authenticated superadmin user.
 * Only the system owner has access to billing admin panel.
 */
export async function requireSuperAdmin() {
  const session = await auth();

  if (!session?.user?.email) {
    redirect('/auth/signin');
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, agencyId: true, role: true, email: true, name: true },
  });

  const isSuper = user?.role === 'SUPERADMIN' || isSuperAdminEmail(session.user.email);

  if (!user || !isSuper) {
    redirect('/dashboard?error=unauthorized');
  }

  // Set RLS bypass for superadmin
  await setSuperadminContext();

  return {
    userId: user.id,
    agencyId: user.agencyId,
    role: user.role,
    email: user.email!,
    name: user.name,
    isSuperAdmin: true,
  };
}

/**
 * Server-side helper: get the current session and enforce agency context.
 * Use at the top of any Server Component or Server Action that needs
 * authenticated, agency-scoped data.
 */
export async function requireAuth() {
  const session = await auth();

  if (!session?.user?.email) {
    redirect('/auth/signin');
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, agencyId: true, role: true, email: true, name: true },
  });

  if (!user || !user.agencyId) {
    redirect('/onboarding');
  }

  // Set RLS context for this request
  await setAgencyContext(user.agencyId);

  return {
    userId: user.id,
    agencyId: user.agencyId,
    role: user.role,
    email: user.email!,
    name: user.name,
  };
}
