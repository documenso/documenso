import { router } from '../trpc';
import { createAdminOrganisationRoute } from './create-admin-organisation';
import { createStripeCustomerRoute } from './create-stripe-customer';
import { createSubscriptionClaimRoute } from './create-subscription-claim';
import { deleteDocumentRoute } from './delete-document';
import { deleteSubscriptionClaimRoute } from './delete-subscription-claim';
import { deleteUserRoute } from './delete-user';
import { disableUserRoute } from './disable-user';
import { enableUserRoute } from './enable-user';
import { findAdminOrganisationsRoute } from './find-admin-organisations';
import { findDocumentsRoute } from './find-documents';
import { findSubscriptionClaimsRoute } from './find-subscription-claims';
import { getAdminOrganisationRoute } from './get-admin-organisation';
import { getUserRoute } from './get-user';
import { resealDocumentRoute } from './reseal-document';
import { resetTwoFactorRoute } from './reset-two-factor-authentication';
import { updateAdminOrganisationRoute } from './update-admin-organisation';
import { updateRecipientRoute } from './update-recipient';
import { updateSiteSettingRoute } from './update-site-setting';
import { updateSubscriptionClaimRoute } from './update-subscription-claim';
import { updateUserRoute } from './update-user';

export const adminRouter = router({
  organisation: {
    find: findAdminOrganisationsRoute,
    get: getAdminOrganisationRoute,
    create: createAdminOrganisationRoute,
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
  user: {
    get: getUserRoute,
    update: updateUserRoute,
    delete: deleteUserRoute,
    enable: enableUserRoute,
    disable: disableUserRoute,
    resetTwoFactor: resetTwoFactorRoute,
  },
  document: {
    find: findDocumentsRoute,
    delete: deleteDocumentRoute,
    reseal: resealDocumentRoute,
  },
  recipient: {
    update: updateRecipientRoute,
  },
  updateSiteSetting: updateSiteSettingRoute,
});
