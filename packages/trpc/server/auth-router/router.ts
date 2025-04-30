import type { RegistrationResponseJSON } from '@simplewebauthn/types';

import { AppError } from '@documenso/lib/errors/app-error';
import {
  sendEmailVerification,
  verifyEmailCode,
} from '@documenso/lib/server-only/2fa/send-email-verification';
import { createPasskey } from '@documenso/lib/server-only/auth/create-passkey';
import { createPasskeyAuthenticationOptions } from '@documenso/lib/server-only/auth/create-passkey-authentication-options';
import { createPasskeyRegistrationOptions } from '@documenso/lib/server-only/auth/create-passkey-registration-options';
import { createPasskeySigninOptions } from '@documenso/lib/server-only/auth/create-passkey-signin-options';
import { deletePasskey } from '@documenso/lib/server-only/auth/delete-passkey';
import { findPasskeys } from '@documenso/lib/server-only/auth/find-passkeys';
import { updatePasskey } from '@documenso/lib/server-only/auth/update-passkey';
import { nanoid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure, procedure, router } from '../trpc';
import {
  ZCreatePasskeyAuthenticationOptionsMutationSchema,
  ZCreatePasskeyMutationSchema,
  ZDeletePasskeyMutationSchema,
  ZFindPasskeysQuerySchema,
  ZSendEmailVerificationMutationSchema,
  ZUpdatePasskeyMutationSchema,
  ZVerifyEmailCodeMutationSchema,
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

  // Email verification for document signing
  sendEmailVerification: authenticatedProcedure
    .input(ZSendEmailVerificationMutationSchema)
    .mutation(async ({ ctx, input }) => {
      const { recipientId } = input;
      const userId = ctx.user.id;
      let email = ctx.user.email;

      // If recipientId is provided, fetch that recipient's details
      if (recipientId) {
        const recipient = await prisma.recipient.findUnique({
          where: {
            id: recipientId,
          },
          select: {
            email: true,
          },
        });

        if (!recipient) {
          throw new AppError('NOT_FOUND', {
            message: 'Recipient not found',
          });
        }

        email = recipient.email;
      }

      return sendEmailVerification({
        userId,
        email,
      });
    }),

  verifyEmailCode: authenticatedProcedure
    .input(ZVerifyEmailCodeMutationSchema)
    .mutation(async ({ ctx, input }) => {
      const { code, recipientId } = input;
      const userId = ctx.user.id;

      // If recipientId is provided, check that the user has access to it
      if (recipientId) {
        const recipient = await prisma.recipient.findUnique({
          where: {
            id: recipientId,
          },
          select: {
            email: true,
          },
        });

        if (!recipient) {
          throw new AppError('NOT_FOUND', {
            message: 'Recipient not found',
          });
        }
      }

      return verifyEmailCode({
        userId,
        code,
      });
    }),
});
