import { z } from 'zod';

import { OrganisationAuthenticationPortalSchema } from '@documenso/prisma/generated/zod/modelSchema/OrganisationAuthenticationPortalSchema';

export const ZGetOrganisationAuthenticationPortalRequestSchema = z.object({
  organisationId: z.string(),
});

export const ZGetOrganisationAuthenticationPortalResponseSchema =
  OrganisationAuthenticationPortalSchema.pick({
    defaultOrganisationRole: true,
    enabled: true,
    clientId: true,
    wellKnownUrl: true,
    autoProvisionUsers: true,
    allowedDomains: true,
  }).extend({
    /**
     * Whether we have the client secret in the database.
     *
     * Do not expose the actual client secret.
     */
    clientSecretProvided: z.boolean(),
  });

export type TGetOrganisationAuthenticationPortalResponse = z.infer<
  typeof ZGetOrganisationAuthenticationPortalResponseSchema
>;
