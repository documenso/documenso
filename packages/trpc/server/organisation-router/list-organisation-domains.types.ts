import { z } from 'zod';

export const ZListOrganisationDomainsRequestSchema = z.object({
  organisationId: z.string().describe('The organisation to list domains for'),
  page: z.number().min(1).default(1).optional(),
  perPage: z.number().min(1).max(100).default(20).optional(),
});

export const ZListOrganisationDomainsResponseSchema = z.object({
  domains: z.array(
    z.object({
      id: z.string(),
      domain: z.string(),
      createdAt: z.date(),
      updatedAt: z.date(),
    }),
  ),
  totalCount: z.number(),
  currentPage: z.number(),
  perPage: z.number(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
});

export type TListOrganisationDomainsRequestSchema = z.infer<
  typeof ZListOrganisationDomainsRequestSchema
>;

export type TListOrganisationDomainsResponseSchema = z.infer<
  typeof ZListOrganisationDomainsResponseSchema
>;
