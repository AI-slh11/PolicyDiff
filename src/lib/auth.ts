import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import EmailProvider from 'next-auth/providers/email';
import { prisma } from '@/lib/db';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: Number(process.env.EMAIL_SERVER_PORT),
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM,
    }),
  ],
  session: {
    strategy: 'database',
  },
  pages: {
    signIn: '/auth/signin',
    verifyRequest: '/auth/verify',
    error: '/auth/error',
  },
  callbacks: {
    async session({ session, user }) {
      // Attach agency info to the session for per-agency isolation
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, agencyId: true, role: true },
      });

      if (dbUser) {
        session.user.id = dbUser.id;
        (session.user as any).agencyId = dbUser.agencyId;
        (session.user as any).role = dbUser.role;
      }

      return session;
    },
  },
  events: {
    async createUser({ user }) {
      // Log user creation in audit log if they have an agency
      // (new users may not have an agency yet — they get assigned on onboarding)
      console.log(`[auth] New user created: ${user.email}`);
    },
  },
});
