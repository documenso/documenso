import { router } from '../trpc';
import { createOrganisationEmailRoute } from './create-organisation-email';
import { createOrganisationEmailDomainRoute } from './create-organisation-email-domain';
import { createSubscriptionRoute } from './create-subscription';
import { declineLinkOrganisationAccountRoute } from './decline-link-organisation-account';
import { deleteOrganisationEmailRoute } from './delete-organisation-email';
import { deleteOrganisationEmailDomainRoute } from './delete-organisation-email-domain';
import { findOrganisationEmailDomainsRoute } from './find-organisation-email-domain';
import { findOrganisationEmailsRoute } from './find-organisation-emails';
import { getInvoicesRoute } from './get-invoices';
import { getOrganisationAuthenticationPortalRoute } from './get-organisation-authentication-portal';
import { getOrganisationEmailDomainRoute } from './get-organisation-email-domain';
import { getPlansRoute } from './get-plans';
import { getSubscriptionRoute } from './get-subscription';
import { linkOrganisationAccountRoute } from './link-organisation-account';
import { manageSubscriptionRoute } from './manage-subscription';
import { updateOrganisationAuthenticationPortalRoute } from './update-organisation-authentication-portal';
import { updateOrganisationEmailRoute } from './update-organisation-email';
import { verifyOrganisationEmailDomainRoute } from './verify-organisation-email-domain';

export const enterpriseRouter = router({
  organisation: {
    email: {
      find: findOrganisationEmailsRoute,
      create: createOrganisationEmailRoute,
      update: updateOrganisationEmailRoute,
      delete: deleteOrganisationEmailRoute,
    },
    emailDomain: {
      get: getOrganisationEmailDomainRoute,
      find: findOrganisationEmailDomainsRoute,
      create: createOrganisationEmailDomainRoute,
      delete: deleteOrganisationEmailDomainRoute,
      verify: verifyOrganisationEmailDomainRoute,
    },
    authenticationPortal: {
      get: getOrganisationAuthenticationPortalRoute,
      update: updateOrganisationAuthenticationPortalRoute,
      linkAccount: linkOrganisationAccountRoute,
      declineLinkAccount: declineLinkOrganisationAccountRoute,
    },
  },
  billing: {
    plans: {
      get: getPlansRoute,
    },
    subscription: {
      get: getSubscriptionRoute,
      create: createSubscriptionRoute,
      manage: manageSubscriptionRoute,
    },
    invoices: {
      get: getInvoicesRoute,
    },
  },
});
