import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { SetAvatarImageOptions } from '@documenso/lib/server-only/profile/set-avatar-image';
import { setAvatarImage } from '@documenso/lib/server-only/profile/set-avatar-image';
import { deleteUser } from '@documenso/lib/server-only/user/delete-user';
import { findUserSecurityAuditLogs } from '@documenso/lib/server-only/user/find-user-security-audit-logs';
import { submitSupportTicket } from '@documenso/lib/server-only/user/submit-support-ticket';
import { updateProfile } from '@documenso/lib/server-only/user/update-profile';

import { authenticatedProcedure, router } from '../trpc';
import { twoFactorInstanceOnly, twoFactorScope } from '../two-factor-enforcement/enforce';
import {
  ZFindUserSecurityAuditLogsSchema,
  ZSetProfileImageMutationSchema,
  ZSubmitSupportTicketMutationSchema,
  ZUpdateProfileMutationSchema,
} from './schema';

export const profileRouter = router({
  findUserSecurityAuditLogs: authenticatedProcedure
    .input(ZFindUserSecurityAuditLogsSchema)
    // 2FA enforcement: user-level security audit log; no organisation scope. Instance assert still applies.
    .use(twoFactorInstanceOnly())
    .query(async ({ input, ctx }) => {
      return await findUserSecurityAuditLogs({
        userId: ctx.user.id,
        ...input,
      });
    }),

  updateProfile: authenticatedProcedure
    .input(ZUpdateProfileMutationSchema)
    // 2FA enforcement: user-level profile update; no organisation scope. Instance assert still applies.
    .use(twoFactorInstanceOnly())
    .mutation(async ({ input, ctx }) => {
      const { name, signature } = input;

      await updateProfile({
        userId: ctx.user.id,
        name,
        signature,
        requestMetadata: ctx.metadata.requestMetadata,
      });
    }),

  deleteAccount: authenticatedProcedure
    // 2FA enforcement: user-level account deletion; a blocked user must be able to delete their own account. Instance assert still applies.
    .use(twoFactorInstanceOnly())
    .mutation(async ({ ctx }) => {
      ctx.logger.info({
        input: {
          userId: ctx.user.id,
        },
      });

      await deleteUser({
        id: ctx.user.id,
      });
    }),

  setProfileImage: authenticatedProcedure
    .input(ZSetProfileImageMutationSchema)
    .use(
      twoFactorScope((input) => ({
        organisation: input.organisationId ?? undefined,
        team: input.teamId ?? undefined,
      })),
    )
    .mutation(async ({ input, ctx }) => {
      const { bytes, teamId, organisationId } = input;

      ctx.logger.info({
        input: {
          teamId,
          organisationId,
        },
      });

      let target: SetAvatarImageOptions['target'] = {
        type: 'user',
      };

      if (teamId) {
        target = {
          type: 'team',
          teamId,
        };
      }

      if (organisationId) {
        target = {
          type: 'organisation',
          organisationId,
        };
      }

      return await setAvatarImage({
        userId: ctx.user.id,
        target,
        bytes,
        requestMetadata: ctx.metadata,
      });
    }),

  submitSupportTicket: authenticatedProcedure
    .input(ZSubmitSupportTicketMutationSchema)
    .use(
      twoFactorScope((input) => {
        // The legacy string team ID is only in scope when it parses to a real
        // ID — mirroring the handler's own validation branch; a malformed
        // value is rejected by the handler, not resolved here.
        const teamId = input.teamId ? Number(input.teamId) : null;

        return {
          organisation: input.organisationId,
          team: teamId !== null && Number.isInteger(teamId) && teamId > 0 ? teamId : undefined,
        };
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { subject, message, organisationId, teamId } = input;

      const userId = ctx.user.id;

      const parsedTeamId = teamId ? Number(teamId) : null;

      if (typeof parsedTeamId === 'number') {
        if (Number.isNaN(parsedTeamId) || parsedTeamId <= 0) {
          throw new AppError(AppErrorCode.INVALID_BODY, {
            message: 'Invalid team ID provided',
          });
        }
      }

      return await submitSupportTicket({
        subject,
        message,
        userId,
        organisationId,
        teamId: parsedTeamId,
      });
    }),
});
