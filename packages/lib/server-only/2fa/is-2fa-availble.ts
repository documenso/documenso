import type { User } from '@prisma/client';

import { DOKU_SEAL_ENCRYPTION_KEY } from '../../constants/crypto';

type IsTwoFactorAuthenticationEnabledOptions = {
  user: User;
};

export const isTwoFactorAuthenticationEnabled = ({
  user,
}: IsTwoFactorAuthenticationEnabledOptions) => {
  return user.twoFactorEnabled && typeof DOKU_SEAL_ENCRYPTION_KEY === 'string';
};
