import { User } from '@documenso/prisma/client';

import { DOCUMENSO_ENCRYPTION_KEY } from '../../constants/crypto';

type IsTwoFactorAuthenticationEnabledOptions = {
  user: User;
};

export const isTwoFactorAuthenticationEnabled = ({
  user,
}: IsTwoFactorAuthenticationEnabledOptions) => {
  return (
    user.twoFactorEnabled &&
    user.identityProvider === 'DOCUMENSO' &&
    typeof DOCUMENSO_ENCRYPTION_KEY === 'string'
  );
};
