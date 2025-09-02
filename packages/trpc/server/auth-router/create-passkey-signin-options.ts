import { createPasskeySigninOptions } from '@documenso/lib/server-only/auth/create-passkey-signin-options';
import { nanoid } from '@documenso/lib/universal/id';

import { procedure } from '../trpc';
import {
  ZCreatePasskeySigninOptionsRequestSchema,
  ZCreatePasskeySigninOptionsResponseSchema,
} from './create-passkey-signin-options.types';

export const createPasskeySigninOptionsRoute = procedure
  .input(ZCreatePasskeySigninOptionsRequestSchema)
  .output(ZCreatePasskeySigninOptionsResponseSchema)
  .mutation(async () => {
    const sessionIdToken = nanoid(16);

    const [sessionId] = decodeURI(sessionIdToken).split('|');

    const options = await createPasskeySigninOptions({ sessionId });

    return {
      options,
      sessionId,
    };
  });
