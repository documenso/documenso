import { IdentityProvider } from '@documenso/prisma/client';

export const SALT_ROUNDS = 12;

export const IDENTITY_PROVIDER_NAME: { [key in IdentityProvider]: string } = {
  [IdentityProvider.DOCUMENSO]: 'Documenso',
  [IdentityProvider.GOOGLE]: 'Google',
};

export const IS_GOOGLE_SSO_ENABLED = Boolean(
  process.env.NEXT_PRIVATE_GOOGLE_CLIENT_ID && process.env.NEXT_PRIVATE_GOOGLE_CLIENT_SECRET,
);
