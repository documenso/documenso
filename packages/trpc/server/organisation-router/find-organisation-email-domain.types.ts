import { EmailDomainStatus } from '@prisma/client';
import { z } from 'zod';

import { ZEmailDomainManySchema } from '@documenso/lib/types/email-domain';
import { ZFindResultResponse, ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';

export const ZFindOrganisationEmailDomainsRequestSchema = ZFindSearchParamsSchema.extend({
  organisationId: z.string(),
  emailDomainId: z.string().optional(),
  statuses: z.nativeEnum(EmailDomainStatus).array().optional(),
});

export const ZFindOrganisationEmailDomainsResponseSchema = ZFindResultResponse.extend({
  data: ZEmailDomainManySchema.array(),
});

export type TFindOrganisationEmailDomainsResponse = z.infer<
  typeof ZFindOrganisationEmailDomainsResponseSchema
>;
