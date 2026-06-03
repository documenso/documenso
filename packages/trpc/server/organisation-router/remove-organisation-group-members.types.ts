// ABOUTME: Types for the remove-organisation-group-members endpoint.
// Accepts group ID and an array of email addresses to remove.
import { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc';

export const ZRemoveOrganisationGroupMembersMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/organisation/group/{groupId}/members/remove',
    summary: 'Remove members from organisation group',
    description: 'Remove members from an organisation group by email address',
    tags: ['Organisation'],
  },
};

export const ZRemoveOrganisationGroupMembersRequestSchema = z.object({
  groupId: z.string().describe('The organisation group ID'),
  emails: z.array(z.string().email()).describe('Email addresses of users to remove from the group'),
});

export const ZRemoveOrganisationGroupMembersResponseSchema = z.object({
  removed: z.array(z.string()).describe('Emails that were removed'),
  notMember: z.array(z.string()).describe('Emails that were not in the group'),
  notFound: z.array(z.string()).describe('Emails with no matching organisation member'),
});

export type TRemoveOrganisationGroupMembersResponse = z.infer<
  typeof ZRemoveOrganisationGroupMembersResponseSchema
>;
