import type { SetAvatarImageOptions } from '@documenso/lib/server-only/profile/set-avatar-image';
import { setAvatarImage } from '@documenso/lib/server-only/profile/set-avatar-image';
import { deleteUser } from '@documenso/lib/server-only/user/delete-user';
import { findUserSecurityAuditLogs } from '@documenso/lib/server-only/user/find-user-security-audit-logs';
import { getUserById } from '@documenso/lib/server-only/user/get-user-by-id';
import { updateProfile } from '@documenso/lib/server-only/user/update-profile';

import { adminProcedure, authenticatedProcedure, router } from '../trpc';
import {
  ZFindUserSecurityAuditLogsSchema,
  ZRetrieveUserByIdQuerySchema,
  ZSetProfileImageMutationSchema,
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

  getUser: adminProcedure.input(ZRetrieveUserByIdQuerySchema).query(async ({ input }) => {
    const { id } = input;

    return await getUserById({ id });
  }),

  updateProfile: authenticatedProcedure
    .input(ZUpdateProfileMutationSchema)
    .mutation(async ({ input, ctx }) => {
      const { name, signature } = input;

      return await updateProfile({
        userId: ctx.user.id,
        name,
        signature,
        requestMetadata: ctx.metadata.requestMetadata,
      });
    }),

  deleteAccount: authenticatedProcedure.mutation(async ({ ctx }) => {
    return await deleteUser({
      id: ctx.user.id,
    });
  }),

  setProfileImage: authenticatedProcedure
    .input(ZSetProfileImageMutationSchema)
    .mutation(async ({ input, ctx }) => {
      const { bytes, teamId, organisationId } = input;

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
});
