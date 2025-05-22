import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { findDocuments } from '@documenso/lib/server-only/admin/get-all-documents';
import { getEntireDocument } from '@documenso/lib/server-only/admin/get-entire-document';
import { updateRecipient } from '@documenso/lib/server-only/admin/update-recipient';
import { updateUser } from '@documenso/lib/server-only/admin/update-user';
import { sealDocument } from '@documenso/lib/server-only/document/seal-document';
import { sendDeleteEmail } from '@documenso/lib/server-only/document/send-delete-email';
import { superDeleteDocument } from '@documenso/lib/server-only/document/super-delete-document';
import { upsertSiteSetting } from '@documenso/lib/server-only/site-settings/upsert-site-setting';
import { deleteUser } from '@documenso/lib/server-only/user/delete-user';
import { disableUser } from '@documenso/lib/server-only/user/disable-user';
import { enableUser } from '@documenso/lib/server-only/user/enable-user';
import { getUserById } from '@documenso/lib/server-only/user/get-user-by-id';
import { isDocumentCompleted } from '@documenso/lib/utils/document';

import { adminProcedure, router } from '../trpc';
import { createStripeCustomerRoute } from './create-stripe-customer';
import { createSubscriptionClaimRoute } from './create-subscription-claim';
import { deleteSubscriptionClaimRoute } from './delete-subscription-claim';
import { findAdminOrganisationsRoute } from './find-admin-organisations';
import { findSubscriptionClaimsRoute } from './find-subscription-claims';
import { getAdminOrganisationRoute } from './get-admin-organisation';
import {
  ZAdminDeleteDocumentMutationSchema,
  ZAdminDeleteUserMutationSchema,
  ZAdminDisableUserMutationSchema,
  ZAdminEnableUserMutationSchema,
  ZAdminFindDocumentsQuerySchema,
  ZAdminResealDocumentMutationSchema,
  ZAdminUpdateProfileMutationSchema,
  ZAdminUpdateRecipientMutationSchema,
  ZAdminUpdateSiteSettingMutationSchema,
} from './schema';
import { updateAdminOrganisationRoute } from './update-admin-organisation';
import { updateSubscriptionClaimRoute } from './update-subscription-claim';

export const adminRouter = router({
  organisation: {
    find: findAdminOrganisationsRoute,
    get: getAdminOrganisationRoute,
    update: updateAdminOrganisationRoute,
  },
  claims: {
    find: findSubscriptionClaimsRoute,
    create: createSubscriptionClaimRoute,
    update: updateSubscriptionClaimRoute,
    delete: deleteSubscriptionClaimRoute,
  },
  stripe: {
    createCustomer: createStripeCustomerRoute,
  },

  // Todo: migrate old routes
  findDocuments: adminProcedure.input(ZAdminFindDocumentsQuerySchema).query(async ({ input }) => {
    const { query, page, perPage } = input;

    return await findDocuments({ query, page, perPage });
  }),

  updateUser: adminProcedure
    .input(ZAdminUpdateProfileMutationSchema)
    .mutation(async ({ input }) => {
      const { id, name, email, roles } = input;

      return await updateUser({ id, name, email, roles });
    }),

  updateRecipient: adminProcedure
    .input(ZAdminUpdateRecipientMutationSchema)
    .mutation(async ({ input }) => {
      const { id, name, email } = input;

      return await updateRecipient({ id, name, email });
    }),

  updateSiteSetting: adminProcedure
    .input(ZAdminUpdateSiteSettingMutationSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, enabled, data } = input;

      return await upsertSiteSetting({
        id,
        enabled,
        data,
        userId: ctx.user.id,
      });
    }),

  resealDocument: adminProcedure
    .input(ZAdminResealDocumentMutationSchema)
    .mutation(async ({ input }) => {
      const { id } = input;

      const document = await getEntireDocument({ id });

      const isResealing = isDocumentCompleted(document.status);

      return await sealDocument({ documentId: id, isResealing });
    }),

  enableUser: adminProcedure.input(ZAdminEnableUserMutationSchema).mutation(async ({ input }) => {
    const { id } = input;

    const user = await getUserById({ id }).catch(() => null);

    if (!user) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'User not found',
      });
    }

    return await enableUser({ id });
  }),

  disableUser: adminProcedure.input(ZAdminDisableUserMutationSchema).mutation(async ({ input }) => {
    const { id } = input;

    const user = await getUserById({ id }).catch(() => null);

    if (!user) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'User not found',
      });
    }

    return await disableUser({ id });
  }),

  deleteUser: adminProcedure.input(ZAdminDeleteUserMutationSchema).mutation(async ({ input }) => {
    const { id } = input;

    return await deleteUser({ id });
  }),

  deleteDocument: adminProcedure
    .input(ZAdminDeleteDocumentMutationSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, reason } = input;
      await sendDeleteEmail({ documentId: id, reason });

      return await superDeleteDocument({
        id,
        requestMetadata: ctx.metadata.requestMetadata,
      });
    }),
});
