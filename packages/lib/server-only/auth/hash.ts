import { hashSync as bcryptHashSync } from 'bcrypt';

import { SALT_ROUNDS } from '../../constants/auth';

/**
 * @deprecated Use the methods built into `bcrypt` instead
 */
export const hashSync = (password: string) => {
  return bcryptHashSync(password, SALT_ROUNDS);
};
