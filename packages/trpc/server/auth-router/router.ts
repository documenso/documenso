import type { RegistrationResponseJSON } from '@simplewebauthn/types';

import { createPasskey } from '@documenso/lib/server-only/auth/create-passkey';
import { createPasskeyAuthenticationOptions } from '@documenso/lib/server-only/auth/create-passkey-authentication-options';
import { createPasskeyRegistrationOptions } from '@documenso/lib/server-only/auth/create-passkey-registration-options';
import { createPasskeySigninOptions } from '@documenso/lib/server-only/auth/create-passkey-signin-options';
import { deletePasskey } from '@documenso/lib/server-only/auth/delete-passkey';
import { findPasskeys } from '@documenso/lib/server-only/auth/find-passkeys';
import { getActiveUserSessions } from '@documenso/lib/server-only/auth/get-active-user-sessions';
import { updatePasskey } from '@documenso/lib/server-only/auth/update-passkey';
import { nanoid } from '@documenso/lib/universal/id';

import { authenticatedProcedure, procedure, router } from '../trpc';
import {
  ZCreatePasskeyAuthenticationOptionsMutationSchema,
  ZCreatePasskeyMutationSchema,
  ZDeletePasskeyMutationSchema,
  ZFindPasskeysQuerySchema,
  ZUpdatePasskeyMutationSchema,
} from './schema';

export const authRouter = router({
  createPasskey: authenticatedProcedure
    .input(ZCreatePasskeyMutationSchema)
    .mutation(async ({ ctx, input }) => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const verificationResponse = input.verificationResponse as RegistrationResponseJSON;

      return await createPasskey({
        userId: ctx.user.id,
        verificationResponse,
        passkeyName: input.passkeyName,
        requestMetadata: ctx.metadata.requestMetadata,
      });
    }),

  createPasskeyAuthenticationOptions: authenticatedProcedure
    .input(ZCreatePasskeyAuthenticationOptionsMutationSchema)
    .mutation(async ({ ctx, input }) => {
      return await createPasskeyAuthenticationOptions({
        userId: ctx.user.id,
        preferredPasskeyId: input?.preferredPasskeyId,
      });
    }),

  createPasskeyRegistrationOptions: authenticatedProcedure.mutation(async ({ ctx }) => {
    return await createPasskeyRegistrationOptions({
      userId: ctx.user.id,
    });
  }),

  createPasskeySigninOptions: procedure.mutation(async () => {
    const sessionIdToken = nanoid(16);

    const [sessionId] = decodeURI(sessionIdToken).split('|');

    const options = await createPasskeySigninOptions({ sessionId });

    return {
      options,
      sessionId,
    };
  }),

  deletePasskey: authenticatedProcedure
    .input(ZDeletePasskeyMutationSchema)
    .mutation(async ({ ctx, input }) => {
      const { passkeyId } = input;

      await deletePasskey({
        userId: ctx.user.id,
        passkeyId,
        requestMetadata: ctx.metadata.requestMetadata,
      });
    }),

  findPasskeys: authenticatedProcedure
    .input(ZFindPasskeysQuerySchema)
    .query(async ({ input, ctx }) => {
      const { page, perPage, orderBy } = input;

      return await findPasskeys({
        page,
        perPage,
        orderBy,
        userId: ctx.user.id,
      });
    }),

  updatePasskey: authenticatedProcedure
    .input(ZUpdatePasskeyMutationSchema)
    .mutation(async ({ ctx, input }) => {
      const { passkeyId, name } = input;

      await updatePasskey({
        userId: ctx.user.id,
        passkeyId,
        name,
        requestMetadata: ctx.metadata.requestMetadata,
      });
    }),

  getActiveSessions: authenticatedProcedure.query(async ({ ctx }) => {
    return await getActiveUserSessions({
      id: ctx.user.id,
    });
  }),
});
