import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { SetAvatarImageOptions } from '@documenso/lib/server-only/profile/set-avatar-image';
import { setAvatarImage } from '@documenso/lib/server-only/profile/set-avatar-image';
import { deleteUser } from '@documenso/lib/server-only/user/delete-user';
import { findUserSecurityAuditLogs } from '@documenso/lib/server-only/user/find-user-security-audit-logs';
import { submitSupportTicket } from '@documenso/lib/server-only/user/submit-support-ticket';
import { updateProfile } from '@documenso/lib/server-only/user/update-profile';

import { authenticatedProcedure, router } from '../trpc';
import {
  ZFindUserSecurityAuditLogsSchema,
  ZSetProfileImageMutationSchema,
  ZSubmitSupportTicketMutationSchema,
  ZUpdateProfileMutationSchema,
} from './schema';

export const profileRouter = router({
  findUserSecurityAuditLogs: authenticatedProcedure
    .input(ZFindUserSecurityAuditLogsSchema)
    .query(async ({ input, ctx }) => {
      return await findUserSecurityAuditLogs({
        userId: ctx.user.id,
        ...input,
      });
    }),

  updateProfile: authenticatedProcedure
    .input(ZUpdateProfileMutationSchema)
    .mutation(async ({ input, ctx }) => {
      const { name, signature } = input;

      await updateProfile({
        userId: ctx.user.id,
        name,
        signature,
        requestMetadata: ctx.metadata.requestMetadata,
      });
    }),

  deleteAccount: authenticatedProcedure.mutation(async ({ ctx }) => {
    await deleteUser({
      id: ctx.user.id,
    });
  }),

  setProfileImage: authenticatedProcedure
    .input(ZSetProfileImageMutationSchema)
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
    .mutation(async ({ input, ctx }) => {
      const { subject, message, organisationId, teamId } = input;

      const userId = ctx.user.id;

      const parsedTeamId = teamId ? Number(teamId) : null;

      if (Number.isNaN(parsedTeamId)) {
        throw new AppError(AppErrorCode.INVALID_BODY, {
          message: 'Invalid team ID provided',
        });
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
