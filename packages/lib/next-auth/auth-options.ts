import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { compare } from 'bcrypt';
import { AuthOptions, User } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

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
          image: '',
        } satisfies User;
      },
    }),
  ],
  // callbacks: {
  //   jwt: async ({ token, user: _user }) => {
  //     return {
  //       ...token,
  //     };
  //   },
  // },
};
