import { z } from 'zod';

import OrganisationMemberRoleSchema from '@documenso/prisma/generated/zod/inputTypeSchemas/OrganisationMemberRoleSchema';

import { domainRegex } from './create-organisation-email-domain.types';

export const ZUpdateOrganisationAuthenticationPortalRequestSchema = z.object({
  organisationId: z.string(),
  data: z.object({
    defaultOrganisationRole: OrganisationMemberRoleSchema,
    enabled: z.boolean(),
    clientId: z.string(),
    clientSecret: z.string().optional(),
    wellKnownUrl: z.union([z.string().url(), z.literal('')]),
    autoProvisionUsers: z.boolean(),
    allowedDomains: z.array(z.string().regex(domainRegex)),
  }),
});

export const ZUpdateOrganisationAuthenticationPortalResponseSchema = z.void();

export type TUpdateOrganisationAuthenticationPortalRequest = z.infer<
  typeof ZUpdateOrganisationAuthenticationPortalRequestSchema
>;
