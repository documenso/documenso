import { TRPCError } from '@trpc/server';

import { findDocuments } from '@documenso/lib/server-only/admin/get-all-documents';
import { updateRecipient } from '@documenso/lib/server-only/admin/update-recipient';
import { updateUser } from '@documenso/lib/server-only/admin/update-user';
import { sealDocument } from '@documenso/lib/server-only/document/seal-document';
import { upsertSiteSetting } from '@documenso/lib/server-only/site-settings/upsert-site-setting';
import { deleteUser } from '@documenso/lib/server-only/user/delete-user';
import { getUserById } from '@documenso/lib/server-only/user/get-user-by-id';

import { adminProcedure, router } from '../trpc';
import {
  ZAdminDeleteUserMutationSchema,
  ZAdminFindDocumentsQuerySchema,
  ZAdminResealDocumentMutationSchema,
  ZAdminUpdateProfileMutationSchema,
  ZAdminUpdateRecipientMutationSchema,
  ZAdminUpdateSiteSettingMutationSchema,
} from './schema';

export const adminRouter = router({
  findDocuments: adminProcedure.input(ZAdminFindDocumentsQuerySchema).query(async ({ input }) => {
    const { term, page, perPage } = input;

    try {
      return await findDocuments({ term, page, perPage });
    } catch (err) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'We were unable to retrieve the documents. Please try again.',
      });
    }
  }),

  updateUser: adminProcedure
    .input(ZAdminUpdateProfileMutationSchema)
    .mutation(async ({ input }) => {
      const { id, name, email, roles } = input;

      try {
        return await updateUser({ id, name, email, roles });
      } catch (err) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'We were unable to retrieve the specified account. Please try again.',
        });
      }
    }),

  updateRecipient: adminProcedure
    .input(ZAdminUpdateRecipientMutationSchema)
    .mutation(async ({ input }) => {
      const { id, name, email } = input;

      try {
        return await updateRecipient({ id, name, email });
      } catch (err) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'We were unable to update the recipient provided.',
        });
      }
    }),

  updateSiteSetting: adminProcedure
    .input(ZAdminUpdateSiteSettingMutationSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const { id, enabled, data } = input;

        return await upsertSiteSetting({
          id,
          enabled,
          data,
          userId: ctx.user.id,
        });
      } catch (err) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'We were unable to update the site setting provided.',
        });
      }
    }),

  resealDocument: adminProcedure
    .input(ZAdminResealDocumentMutationSchema)
    .mutation(async ({ input }) => {
      const { id } = input;

      try {
        return await sealDocument({ documentId: id, isResealing: true });
      } catch (err) {
        console.log('resealDocument error', err);
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'We were unable to reseal the document provided.',
        });
      }
    }),

  deleteUser: adminProcedure.input(ZAdminDeleteUserMutationSchema).mutation(async ({ input }) => {
    const { id, email } = input;

    try {
      const user = await getUserById({ id });

      if (user.email !== email) {
        throw new Error('Email does not match');
      }

      return await deleteUser({ id });
    } catch (err) {
      console.log(err);

      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'We were unable to delete the specified account. Please try again.',
      });
    }
  }),
});
