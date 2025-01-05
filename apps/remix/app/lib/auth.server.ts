import { compare, hash } from '@node-rs/bcrypt';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { twoFactor } from 'better-auth/plugins';

import { getAuthenticatorOptions } from '@documenso/lib/utils/authenticator';
import { prisma } from '@documenso/prisma';

import { passkeyPlugin } from './auth/passkey-plugin';

// todo: import from @documenso/lib/constants/auth
export const SALT_ROUNDS = 12;

const passkeyOptions = getAuthenticatorOptions();

export const auth = betterAuth({
  appName: 'Documenso',
  plugins: [
    twoFactor({
      issuer: 'Documenso',
      skipVerificationOnEnable: true,
      // totpOptions: {

      // },
      schema: {
        twoFactor: {
          modelName: 'TwoFactor',
          fields: {
            userId: 'userId',
            secret: 'secret',
            backupCodes: 'backupCodes',
          },
        },
      },
      // todo: add options
    }),
    passkeyPlugin(),
    // passkey({
    //   rpID: passkeyOptions.rpId,
    //   rpName: passkeyOptions.rpName,
    //   origin: passkeyOptions.origin,
    //   schema: {
    //     passkey: {
    //       fields: {
    //         publicKey: 'credentialPublicKey',
    //         credentialID: 'credentialId',
    //         deviceType: 'credentialDeviceType',
    //         backedUp: 'credentialBackedUp',
    //         // transports: '',
    //       },
    //     },
    //   },
    // }),
  ],
  secret: 'secret', // todo
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  databaseHooks: {
    account: {
      create: {
        before: (session) => {
          return {
            data: {
              ...session,
              accountId: session.accountId.toString(),
            },
          };
        },
      },
    },
  },
  session: {
    fields: {
      token: 'sessionToken',
      expiresAt: 'expires',
    },
  },
  user: {
    fields: {
      emailVerified: 'isEmailVerified',
    },
  },
  account: {
    fields: {
      providerId: 'provider',
      accountId: 'providerAccountId',
      refreshToken: 'refresh_token',
      accessToken: 'access_token',
      idToken: 'id_token',
    },
  },
  advanced: {
    generateId: false,
  },
  socialProviders: {
    google: {
      clientId: '',
      clientSecret: '',
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    // maxPasswordLength: 128,
    // minPasswordLength: 8,
    password: {
      hash: async (password) => hash(password, SALT_ROUNDS),
      verify: async ({ hash, password }) => compare(password, hash),
    },
  },
});
