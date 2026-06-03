// ABOUTME: Types for the add-organisation-group-members endpoint.
// Accepts group ID and an array of email addresses to add as members.
import { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc';

export const ZAddOrganisationGroupMembersMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/organisation/group/{groupId}/members/add',
    summary: 'Add members to organisation group',
    description: 'Add members to an organisation group by email address',
    tags: ['Organisation'],
  },
};

export const ZAddOrganisationGroupMembersRequestSchema = z.object({
  groupId: z.string().describe('The organisation group ID'),
  emails: z.array(z.string().email()).describe('Email addresses of users to add to the group'),
});

export const ZAddOrganisationGroupMembersResponseSchema = z.object({
  added: z.array(z.string()).describe('Emails that were added'),
  alreadyMember: z.array(z.string()).describe('Emails that were already in the group'),
  notFound: z.array(z.string()).describe('Emails with no matching organisation member'),
});

export type TAddOrganisationGroupMembersResponse = z.infer<
  typeof ZAddOrganisationGroupMembersResponseSchema
>;
