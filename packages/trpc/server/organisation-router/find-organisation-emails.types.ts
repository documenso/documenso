import { z } from 'zod';

import { ZOrganisationEmailManySchema } from '@documenso/lib/types/organisation-email';
import { ZFindResultResponse, ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';

export const ZFindOrganisationEmailsRequestSchema = ZFindSearchParamsSchema.extend({
  organisationId: z.string(),
  emailDomainId: z.string().optional(),
  status: z
    .enum(['ACTIVE', 'INACTIVE'])
    .optional()
    .describe('Whether the email is currently active. Leave empty to return all emails.'),
});

export const ZFindOrganisationEmailsResponseSchema = ZFindResultResponse.extend({
  data: ZOrganisationEmailManySchema.array(),
});

export type TFindOrganisationEmailsResponse = z.infer<typeof ZFindOrganisationEmailsResponseSchema>;
