import { UserRole } from '@prisma/client';
import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      agencyId: string | null;
      role: UserRole;
    } & DefaultSession['user'];
  }
}
