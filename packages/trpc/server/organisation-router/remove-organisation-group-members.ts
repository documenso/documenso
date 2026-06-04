// ABOUTME: Removes members from an organisation group by email address.
// Resolves emails to org member IDs, removes matching memberships, reports results.
import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/organisations';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getMemberOrganisationRole } from '@documenso/lib/server-only/team/get-member-roles';
import {
  buildOrganisationWhereQuery,
  isOrganisationRoleWithinUserHierarchy,
} from '@documenso/lib/utils/organisations';
import { prisma } from '@documenso/prisma';
import { OrganisationGroupType } from '@documenso/prisma/generated/types';

import { authenticatedProcedure } from '../trpc';
import {
  ZRemoveOrganisationGroupMembersMeta,
  ZRemoveOrganisationGroupMembersRequestSchema,
  ZRemoveOrganisationGroupMembersResponseSchema,
} from './remove-organisation-group-members.types';

export const removeOrganisationGroupMembersRoute = authenticatedProcedure
  .meta(ZRemoveOrganisationGroupMembersMeta)
  .input(ZRemoveOrganisationGroupMembersRequestSchema)
  .output(ZRemoveOrganisationGroupMembersResponseSchema)
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
        organisationGroupMembers: {
          include: {
            organisationMember: {
              include: { user: { select: { email: true } } },
            },
          },
        },
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

    const memberByEmail = new Map(
      group.organisationGroupMembers.map((m) => [m.organisationMember.user.email.toLowerCase(), m]),
    );

    const removed: string[] = [];
    const notMember: string[] = [];
    const notFound: string[] = [];

    const idsToDelete: string[] = [];

    const orgMembers = await prisma.organisationMember.findMany({
      where: {
        organisationId: group.organisationId,
        user: { email: { in: normalizedEmails } },
      },
      include: { user: { select: { email: true } } },
    });

    const knownEmails = new Set(orgMembers.map((m) => m.user.email.toLowerCase()));

    for (const email of normalizedEmails) {
      if (!knownEmails.has(email)) {
        notFound.push(email);
        continue;
      }

      const membership = memberByEmail.get(email);

      if (!membership) {
        notMember.push(email);
        continue;
      }

      idsToDelete.push(membership.id);
      removed.push(email);
    }

    if (idsToDelete.length > 0) {
      await prisma.organisationGroupMember.deleteMany({
        where: { id: { in: idsToDelete } },
      });
    }

    return { removed, notMember, notFound };
  });
