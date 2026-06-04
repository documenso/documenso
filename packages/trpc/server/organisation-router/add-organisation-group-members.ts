// ABOUTME: Adds members to an organisation group by email address.
// Resolves emails to org member IDs, skips duplicates, reports results.
import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/organisations';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getMemberOrganisationRole } from '@documenso/lib/server-only/team/get-member-roles';
import { generateDatabaseId } from '@documenso/lib/universal/id';
import {
  buildOrganisationWhereQuery,
  isOrganisationRoleWithinUserHierarchy,
} from '@documenso/lib/utils/organisations';
import { prisma } from '@documenso/prisma';
import { OrganisationGroupType } from '@documenso/prisma/generated/types';

import { authenticatedProcedure } from '../trpc';
import {
  ZAddOrganisationGroupMembersMeta,
  ZAddOrganisationGroupMembersRequestSchema,
  ZAddOrganisationGroupMembersResponseSchema,
} from './add-organisation-group-members.types';

export const addOrganisationGroupMembersRoute = authenticatedProcedure
  .meta(ZAddOrganisationGroupMembersMeta)
  .input(ZAddOrganisationGroupMembersRequestSchema)
  .output(ZAddOrganisationGroupMembersResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { groupId, emails } = input;
    const { user } = ctx;

    const group = await prisma.organisationGroup.findFirst({
      where: {
        id: groupId,
        organisation: buildOrganisationWhereQuery({
          organisationId: undefined,
          userId: user.id,
          roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
        }),
      },
      include: {
        organisationGroupMembers: true,
      },
    });

    if (!group) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Organisation group not found',
      });
    }

    if (
      group.type === OrganisationGroupType.INTERNAL_ORGANISATION ||
      group.type === OrganisationGroupType.INTERNAL_TEAM
    ) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'Cannot modify internal groups',
      });
    }

    const currentUserOrganisationRole = await getMemberOrganisationRole({
      organisationId: group.organisationId,
      reference: {
        type: 'User',
        id: user.id,
      },
    });

    if (
      !isOrganisationRoleWithinUserHierarchy(currentUserOrganisationRole, group.organisationRole)
    ) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'You are not allowed to modify members of this organisation group',
      });
    }

    const normalizedEmails = emails.map((e) => e.toLowerCase());

    const orgMembers = await prisma.organisationMember.findMany({
      where: {
        organisationId: group.organisationId,
        user: { email: { in: normalizedEmails } },
      },
      include: { user: { select: { email: true } } },
    });

    const existingMemberIds = new Set(
      group.organisationGroupMembers.map((m) => m.organisationMemberId),
    );

    const added: string[] = [];
    const alreadyMember: string[] = [];
    const notFound: string[] = [];

    const emailToOrgMember = new Map(orgMembers.map((m) => [m.user.email.toLowerCase(), m]));

    const toCreate: { id: string; groupId: string; organisationMemberId: string }[] = [];

    for (const email of normalizedEmails) {
      const orgMember = emailToOrgMember.get(email);

      if (!orgMember) {
        notFound.push(email);
        continue;
      }

      if (existingMemberIds.has(orgMember.id)) {
        alreadyMember.push(email);
        continue;
      }

      toCreate.push({
        id: generateDatabaseId('group_member'),
        groupId: group.id,
        organisationMemberId: orgMember.id,
      });

      added.push(email);
    }

    if (toCreate.length > 0) {
      await prisma.organisationGroupMember.createMany({ data: toCreate });
    }

    return { added, alreadyMember, notFound };
  });
