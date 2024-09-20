import { procedure, router } from '../trpc';
import { ZEncryptSecondaryDataMutationSchema } from './schema';

export const cryptoRouter = router({
  encryptSecondaryData: procedure.input(ZEncryptSecondaryDataMutationSchema).mutation(() => {
    throw new Error('Public usage of encryptSecondaryData is no longer permitted');
  }),
});
