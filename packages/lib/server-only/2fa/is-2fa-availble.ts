import { User } from '@documenso/prisma/client';

import { DOCUMENSO_ENCRYPTION_KEY } from '../../constants/crypto';

type isTwoFactorAuthEnabledOptions = {
  user: User;
};

export const isTwoFactorAuthEnabled = ({ user }: isTwoFactorAuthEnabledOptions) => {
  return (
    user.twoFactorEnabled &&
    user.identityProvider === 'DOCUMENSO' &&
    typeof DOCUMENSO_ENCRYPTION_KEY === 'string'
  );
};
