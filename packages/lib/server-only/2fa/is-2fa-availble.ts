import type { User } from '@prisma/client';

import { DOCUMENSO_ENCRYPTION_KEY } from '../../constants/crypto';

type IsTwoFactorAuthenticationEnabledOptions = {
  user: Pick<User, 'twoFactorEnabled'>;
};

export const isTwoFactorAuthenticationEnabled = ({ user }: IsTwoFactorAuthenticationEnabledOptions) => {
  return user.twoFactorEnabled && typeof DOCUMENSO_ENCRYPTION_KEY === 'string';
};
