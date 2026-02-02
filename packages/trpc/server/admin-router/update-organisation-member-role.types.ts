import { OrganisationMemberRole } from '@prisma/client';
import { z } from 'zod';

/**
 * Admin-only role selection that includes OWNER as a special case.
 * OWNER is not a database role but triggers ownership transfer.
 */
export const ZAdminRoleSelection = z.enum([
  'OWNER',
  OrganisationMemberRole.ADMIN,
  OrganisationMemberRole.MANAGER,
  OrganisationMemberRole.MEMBER,
]);

export type TAdminRoleSelection = z.infer<typeof ZAdminRoleSelection>;

export const ZUpdateOrganisationMemberRoleRequestSchema = z.object({
  organisationId: z.string().min(1),
  userId: z.number().min(1),
  role: ZAdminRoleSelection,
});

export const ZUpdateOrganisationMemberRoleResponseSchema = z.void();

export type TUpdateOrganisationMemberRoleRequest = z.infer<
  typeof ZUpdateOrganisationMemberRoleRequestSchema
>;
export type TUpdateOrganisationMemberRoleResponse = z.infer<
  typeof ZUpdateOrganisationMemberRoleResponseSchema
>;
