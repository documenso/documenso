import { decryptData } from '@documenso/lib/server-only/crypto/decrypt';
import { encryptData } from '@documenso/lib/server-only/crypto/encrypt';

import { procedure, router } from '../trpc';
import { ZDecryptDataMutationSchema, ZEncryptDataMutationSchema } from './schema';

export const cryptoRouter = router({
  encrypt: procedure.input(ZEncryptDataMutationSchema).mutation(({ input }) => {
    try {
      return encryptData(input);
    } catch {
      // Never leak errors for crypto.
      throw new Error('Failed to encrypt data');
    }
  }),

  decrypt: procedure.input(ZDecryptDataMutationSchema).mutation(({ input }) => {
    try {
      return decryptData(input.data);
    } catch {
      // Never leak errors for crypto.
      return null;
    }
  }),
});
