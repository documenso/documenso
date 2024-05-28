import { TRPCError } from '@trpc/server';

import { findDocuments } from '@documenso/lib/server-only/admin/get-all-documents';
import { getEntireDocument } from '@documenso/lib/server-only/admin/get-entire-document';
import { updateRecipient } from '@documenso/lib/server-only/admin/update-recipient';
import { updateUser } from '@documenso/lib/server-only/admin/update-user';
import { sealDocument } from '@documenso/lib/server-only/document/seal-document';
import { sendDeleteEmail } from '@documenso/lib/server-only/document/send-delete-email';
import { superDeleteDocument } from '@documenso/lib/server-only/document/super-delete-document';
import { upsertSiteSetting } from '@documenso/lib/server-only/site-settings/upsert-site-setting';
import { deleteUser } from '@documenso/lib/server-only/user/delete-user';
import { getUserById } from '@documenso/lib/server-only/user/get-user-by-id';
import { extractNextApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { DocumentStatus } from '@documenso/prisma/client';

import { adminProcedure, router } from '../trpc';
import {
  ZAdminDeleteDocumentMutationSchema,
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
      console.error(err);

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
        console.error(err);

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
        console.error(err);

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
        console.error(err);

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
        const document = await getEntireDocument({ id });

        const isResealing = document.status === DocumentStatus.COMPLETED;

        return await sealDocument({ documentId: id, isResealing });
      } catch (err) {
        console.error('resealDocument error', err);

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
      console.error(err);

      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'We were unable to delete the specified account. Please try again.',
      });
    }
  }),

  deleteDocument: adminProcedure
    .input(ZAdminDeleteDocumentMutationSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, reason } = input;
      try {
        await sendDeleteEmail({ documentId: id, reason });

        return await superDeleteDocument({
          id,
          requestMetadata: extractNextApiRequestMetadata(ctx.req),
        });
      } catch (err) {
        console.error(err);

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'We were unable to delete the specified document. Please try again.',
        });
      }
    }),
});
