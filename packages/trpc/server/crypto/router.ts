import { encryptSecondaryData } from '@documenso/lib/server-only/crypto/encrypt';

import { procedure, router } from '../trpc';
import { ZEncryptSecondaryDataMutationSchema } from './schema';

export const cryptoRouter = router({
  encryptSecondaryData: procedure
    .input(ZEncryptSecondaryDataMutationSchema)
    .mutation(({ input }) => {
      try {
        return encryptSecondaryData(input);
      } catch {
        // Never leak errors for crypto.
        throw new Error('Failed to encrypt data');
      }
    }),
});
