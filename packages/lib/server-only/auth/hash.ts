<<<<<<< HEAD
import { hashSync as bcryptHashSync } from 'bcrypt';
=======
import { compareSync as bcryptCompareSync, hashSync as bcryptHashSync } from '@node-rs/bcrypt';
import crypto from 'crypto';
>>>>>>> main

import { SALT_ROUNDS } from '../../constants/auth';

/**
 * @deprecated Use the methods built into `bcrypt` instead
 */
export const hashSync = (password: string) => {
  return bcryptHashSync(password, SALT_ROUNDS);
};
<<<<<<< HEAD
=======

export const compareSync = (password: string, hash: string) => {
  return bcryptCompareSync(password, hash);
};

export const hashString = (input: string) => {
  return crypto.createHash('sha512').update(input).digest('hex');
};
>>>>>>> main
