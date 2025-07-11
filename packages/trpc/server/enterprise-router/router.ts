import { router } from '../trpc';
import { createOrganisationEmailRoute } from './create-organisation-email';
import { createOrganisationEmailDomainRoute } from './create-organisation-email-domain';
import { createSubscriptionRoute } from './create-subscription';
import { deleteOrganisationEmailRoute } from './delete-organisation-email';
import { deleteOrganisationEmailDomainRoute } from './delete-organisation-email-domain';
import { findOrganisationEmailDomainsRoute } from './find-organisation-email-domain';
import { findOrganisationEmailsRoute } from './find-organisation-emails';
import { getInvoicesRoute } from './get-invoices';
import { getOrganisationEmailDomainRoute } from './get-organisation-email-domain';
import { getPlansRoute } from './get-plans';
import { getSubscriptionRoute } from './get-subscription';
import { manageSubscriptionRoute } from './manage-subscription';
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
