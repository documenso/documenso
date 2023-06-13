import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { compare } from 'bcrypt';
import { AuthOptions, Session, User } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';

import { prisma } from '@documenso/prisma';

import { getUserByEmail } from '../server-only/user/get-user-by-email';

export const NEXT_AUTH_OPTIONS: AuthOptions = {
  adapter: PrismaAdapter(prisma),
  secret: process.env.NEXTAUTH_SECRET ?? 'secret',
  session: {
    strategy: 'jwt',
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials, _req) => {
        if (!credentials) {
          return null;
        }

        const { email, password } = credentials;

        const user = await getUserByEmail({ email }).catch(() => null);

        if (!user || !user.password) {
          console.log('no user');
          return null;
        }

        const isPasswordsSame = compare(password, user.password);

        if (!isPasswordsSame) {
          return null;
        }

        return {
          id: String(user.id) as any,
          email: user.email,
          name: user.name,
        } satisfies User;
      },
    }),
    GoogleProvider({
      clientId: process.env.NEXT_PRIVATE_GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.NEXT_PRIVATE_GOOGLE_CLIENT_SECRET ?? '',
      allowDangerousEmailAccountLinking: true,
      profile(profile) {
        return {
          id: profile.sub as any,
          name: profile.name,
          email: profile.email,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      const dbUser = await prisma.user.findFirst({
        where: {
          email: token.email as string,
        },
      });

      if (!dbUser) {
        if (user) {
          token.id = user?.id;
        }
        return token;
      }

      return {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
      };
    },
    async session({ token, session }) {
      console.log('session', { token, session });
      if (token) {
        const documensoSession = {
          ...session,
          user: {
            id: Number(token.id),
            name: token.name,
            email: token.email,
          },
        } as Session;

        return documensoSession;
      }
      return session;
    },
  },
};
