import type { RegistrationResponseJSON } from '@simplewebauthn/types';
import { TRPCError } from '@trpc/server';
import { parse } from 'cookie-es';
import { env } from 'next-runtime-env';

import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
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
import { extractNextApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';

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
    try {
      if (NEXT_PUBLIC_DISABLE_SIGNUP() === 'true') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Signups are disabled.',
        });
      }

      const { name, email, password, signature, url } = input;

      if (IS_BILLING_ENABLED() && url && url.length < 6) {
        throw new AppError(
          AppErrorCode.PREMIUM_PROFILE_URL,
          'Only subscribers can have a username shorter than 6 characters',
        );
      }

      const user = await createUser({ name, email, password, signature, url });

      await jobsClient.triggerJob({
        name: 'send.signup.confirmation.email',
        payload: {
          email: user.email,
        },
      });

      return user;
    } catch (err) {
      console.error(err);

      const error = AppError.parseError(err);

      if (error.code !== AppErrorCode.UNKNOWN_ERROR) {
        throw AppError.parseErrorToTRPCError(error);
      }

      let message =
        'We were unable to create your account. Please review the information you provided and try again.';

      if (err instanceof Error && err.message === 'User already exists') {
        message = 'User with this email already exists. Please use a different email address.';
      }

      throw new TRPCError({
        code: 'BAD_REQUEST',
        message,
      });
    }
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
      try {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const verificationResponse = input.verificationResponse as RegistrationResponseJSON;

        return await createPasskey({
          userId: ctx.user.id,
          verificationResponse,
          passkeyName: input.passkeyName,
          requestMetadata: extractNextApiRequestMetadata(ctx.req),
        });
      } catch (err) {
        console.error(err);

        throw AppError.parseErrorToTRPCError(err);
      }
    }),

  createPasskeyAuthenticationOptions: authenticatedProcedure
    .input(ZCreatePasskeyAuthenticationOptionsMutationSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await createPasskeyAuthenticationOptions({
          userId: ctx.user.id,
          preferredPasskeyId: input?.preferredPasskeyId,
        });
      } catch (err) {
        console.error(err);

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'We were unable to create the authentication options for the passkey. Please try again later.',
        });
      }
    }),

  createPasskeyRegistrationOptions: authenticatedProcedure.mutation(async ({ ctx }) => {
    try {
      return await createPasskeyRegistrationOptions({
        userId: ctx.user.id,
      });
    } catch (err) {
      console.error(err);

      throw new TRPCError({
        code: 'BAD_REQUEST',
        message:
          'We were unable to create the registration options for the passkey. Please try again later.',
      });
    }
  }),

  createPasskeySigninOptions: procedure.mutation(async ({ ctx }) => {
    const cookies = parse(ctx.req.headers.cookie ?? '');

    const sessionIdToken =
      cookies['__Host-next-auth.csrf-token'] || cookies['next-auth.csrf-token'];

    if (!sessionIdToken) {
      throw new Error('Missing CSRF token');
    }

    const [sessionId] = decodeURI(sessionIdToken).split('|');

    try {
      return await createPasskeySigninOptions({ sessionId });
    } catch (err) {
      console.error(err);

      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'We were unable to create the options for passkey signin. Please try again later.',
      });
    }
  }),

  deletePasskey: authenticatedProcedure
    .input(ZDeletePasskeyMutationSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const { passkeyId } = input;

        await deletePasskey({
          userId: ctx.user.id,
          passkeyId,
          requestMetadata: extractNextApiRequestMetadata(ctx.req),
        });
      } catch (err) {
        console.error(err);

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'We were unable to delete this passkey. Please try again later.',
        });
      }
    }),

  findPasskeys: authenticatedProcedure
    .input(ZFindPasskeysQuerySchema)
    .query(async ({ input, ctx }) => {
      try {
        const { page, perPage, orderBy } = input;

        return await findPasskeys({
          page,
          perPage,
          orderBy,
          userId: ctx.user.id,
        });
      } catch (err) {
        console.error(err);

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'We were unable to find passkeys. Please try again later.',
        });
      }
    }),

  updatePasskey: authenticatedProcedure
    .input(ZUpdatePasskeyMutationSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const { passkeyId, name } = input;

        await updatePasskey({
          userId: ctx.user.id,
          passkeyId,
          name,
          requestMetadata: extractNextApiRequestMetadata(ctx.req),
        });
      } catch (err) {
        console.error(err);

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'We were unable to update this passkey. Please try again later.',
        });
      }
    }),
});
