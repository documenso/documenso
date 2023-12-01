import { IdentityProvider } from '@documenso/prisma/client';

export const identityProviderName: { [key in IdentityProvider]: string } = {
  [IdentityProvider.DOCUMENSO]: 'Documenso',
  [IdentityProvider.GOOGLE]: 'Google',
};
