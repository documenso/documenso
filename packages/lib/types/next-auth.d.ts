import type { User as PrismaUser } from '@prisma/client';
import type { DefaultUser } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: User;
  }

  interface User extends Omit<DefaultUser, 'id' | 'image' | 'emailVerified'> {
    id: PrismaUser['id'];
    name?: PrismaUser['name'];
    email?: PrismaUser['email'];
    emailVerified?: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string | number;
    name?: string | null;
    email: string | null;
    emailVerified?: string | null;
    lastSignedIn?: string | null;
  }
}
