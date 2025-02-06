import type { RegistrationResponseJSON } from '@simplewebauthn/types';
import { TRPCError } from '@trpc/server';
import { parse } from 'cookie-es';
import { env } from 'next-runtime-env';

import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { formatSecureCookieName } from '@documenso/lib/constants/auth';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { jobsClient } from '@documenso/lib/jobs/client';
import { ErrorCode } from '@documenso/lib/next-auth/error-codes';
import { createPasskey } from '@documenso/lib/server-only/auth/create-passkey';
import { createPasskeyAuthenticationOptions } from '@documenso/lib/server-only/auth/create-passkey-authentication-options';
import { createPasskeyRegistrationOptions } from '@documenso/lib/server-only/auth/create-passkey-registration-options';
import { createPasskeySigninOptions } from '@documenso/lib/server-only/auth/create-passkey-signin-options';
import { deletePasskey } from '@documenso/lib/server-only/auth/delete-passkey';
import { findPasskeys } from '@documenso/lib/server-only/auth/find-passkeys';
import { compareSync } from '@documenso/lib/server-only/auth/hash';
import { updatePasskey } from '@documenso/lib/server-only/auth/update-passkey';
import { createUser } from '@documenso/lib/server-only/user/create-user';

import { authenticatedProcedure, procedure, router } from '../trpc';
import {
  ZCreatePasskeyAuthenticationOptionsMutationSchema,
  ZCreatePasskeyMutationSchema,
  ZDeletePasskeyMutationSchema,
  ZFindPasskeysQuerySchema,
  ZSignUpMutationSchema,
  ZUpdatePasskeyMutationSchema,
  ZVerifyPasswordMutationSchema,
} from './schema';

const NEXT_PUBLIC_DISABLE_SIGNUP = () => env('NEXT_PUBLIC_DISABLE_SIGNUP');

export const authRouter = router({
  signup: procedure.input(ZSignUpMutationSchema).mutation(async ({ input }) => {
    if (NEXT_PUBLIC_DISABLE_SIGNUP() === 'true') {
      throw new AppError('SIGNUP_DISABLED', {
        message: 'Signups are disabled.',
      });
    }

    const { name, email, password, signature, url } = input;

    if (IS_BILLING_ENABLED() && url && url.length < 6) {
      throw new AppError(AppErrorCode.PREMIUM_PROFILE_URL, {
        message: 'Only subscribers can have a username shorter than 6 characters',
      });
    }

    const user = await createUser({ name, email, password, signature, url });

    await jobsClient.triggerJob({
      name: 'send.signup.confirmation.email',
      payload: {
        email: user.email,
      },
    });

    return user;
  }),

  verifyPassword: authenticatedProcedure
    .input(ZVerifyPasswordMutationSchema)
    .mutation(({ ctx, input }) => {
      const user = ctx.user;

      const { password } = input;

      if (!user.password) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: ErrorCode.INCORRECT_PASSWORD,
        });
      }

      const valid = compareSync(password, user.password);

      return valid;
    }),

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

  createPasskeySigninOptions: procedure.mutation(async ({ ctx }) => {
    const cookies = parse(ctx.req.headers.cookie ?? '');

    const sessionIdToken =
      cookies[formatSecureCookieName('__Host-next-auth.csrf-token')] ||
      cookies[formatSecureCookieName('next-auth.csrf-token')];

    if (!sessionIdToken) {
      throw new Error('Missing CSRF token');
    }

    const [sessionId] = decodeURI(sessionIdToken).split('|');

    return await createPasskeySigninOptions({ sessionId });
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
});
