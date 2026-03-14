import { z } from 'zod';

import { ZFindResultResponse, ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';
import EmailDomainStatusSchema from '@documenso/prisma/generated/zod/inputTypeSchemas/EmailDomainStatusSchema';
import EmailDomainSchema from '@documenso/prisma/generated/zod/modelSchema/EmailDomainSchema';
import OrganisationSchema from '@documenso/prisma/generated/zod/modelSchema/OrganisationSchema';

export const ZFindEmailDomainsRequestSchema = ZFindSearchParamsSchema.extend({
  status: EmailDomainStatusSchema.optional(),
});

export const ZFindEmailDomainsResponseSchema = ZFindResultResponse.extend({
  data: EmailDomainSchema.pick({
    id: true,
    domain: true,
    status: true,
    selector: true,
    createdAt: true,
    updatedAt: true,
    lastVerifiedAt: true,
  })
    .extend({
      organisation: OrganisationSchema.pick({
        id: true,
        name: true,
        url: true,
      }),
      _count: z.object({
        emails: z.number(),
      }),
    })
    .array(),
});

export type TFindEmailDomainsRequest = z.infer<typeof ZFindEmailDomainsRequestSchema>;
export type TFindEmailDomainsResponse = z.infer<typeof ZFindEmailDomainsResponseSchema>;
