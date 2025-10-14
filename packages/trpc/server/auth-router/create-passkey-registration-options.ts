import { createPasskeyRegistrationOptions } from '@documenso/lib/server-only/auth/create-passkey-registration-options';

import { authenticatedProcedure } from '../trpc';
import {
  ZCreatePasskeyRegistrationOptionsRequestSchema,
  ZCreatePasskeyRegistrationOptionsResponseSchema,
} from './create-passkey-registration-options.types';

export const createPasskeyRegistrationOptionsRoute = authenticatedProcedure
  .input(ZCreatePasskeyRegistrationOptionsRequestSchema)
  .output(ZCreatePasskeyRegistrationOptionsResponseSchema)
  .mutation(async ({ ctx }) => {
    return await createPasskeyRegistrationOptions({
      userId: ctx.user.id,
    });
  });
