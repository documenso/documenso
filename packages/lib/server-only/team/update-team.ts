import { AdminRuleEngine } from '@documenso/ee/server-only/admin-rules/admin-rule-engine';
import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/teams';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

import type { ApiRequestMetadata } from '../../universal/extract-request-metadata';
import { buildTeamWhereQuery } from '../../utils/teams';

export type UpdateTeamOptions = {
  userId: number;
  teamId: number;
  data: {
    name?: string;
    url?: string;
  };
  requestMetadata?: ApiRequestMetadata;
};

export const updateTeam = async ({ userId, teamId, data, requestMetadata }: UpdateTeamOptions): Promise<void> => {
  try {
    // Prisma ignores an undefined `url` filter, so without this guard a name-only update would
    // match any other team and always be rejected.
    if (data.url) {
      const foundTeamWithUrl = await prisma.team.findFirst({
        where: {
          url: data.url,
          id: {
            not: teamId,
          },
        },
      });

      const foundOrganisationWithUrl = await prisma.organisation.findFirst({
        where: {
          url: data.url,
        },
      });

      if (foundTeamWithUrl || foundOrganisationWithUrl) {
        throw new AppError(AppErrorCode.ALREADY_EXISTS, {
          message: 'Team URL already exists.',
        });
      }
    }

    if (data.name) {
      await assertAdminRulesAllowRename({
        userId,
        teamId,
        name: data.name,
        url: data.url,
        requestMetadata,
      });
    }

    await prisma.team.update({
      where: buildTeamWhereQuery({
        teamId,
        userId,
        roles: TEAM_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_TEAM'],
      }),
      data: {
        url: data.url,
        name: data.name,
      },
    });
  } catch (err) {
    console.error(err);

    if (!(err instanceof Prisma.PrismaClientKnownRequestError)) {
      throw err;
    }

    const target = z.array(z.string()).safeParse(err.meta?.target);

    if (err.code === 'P2002' && target.success && target.data.includes('url')) {
      throw new AppError(AppErrorCode.ALREADY_EXISTS, {
        message: 'Team URL already exists.',
      });
    }

    throw err;
  }
};

type AssertAdminRulesAllowRenameOptions = {
  userId: number;
  teamId: number;
  name: string;
  url?: string;
  requestMetadata?: ApiRequestMetadata;
};

const assertAdminRulesAllowRename = async ({
  userId,
  teamId,
  name,
  url,
  requestMetadata,
}: AssertAdminRulesAllowRenameOptions) => {
  // Same permission filter as the update, so rules never run for someone who can't rename the team.
  // When nothing is found, the update rejects the request.
  const team = await prisma.team.findFirst({
    where: buildTeamWhereQuery({
      teamId,
      userId,
      roles: TEAM_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_TEAM'],
    }),
    select: {
      name: true,
      url: true,
      organisation: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!team || team.name === name) {
    return;
  }

  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      twoFactorEnabled: true,
    },
  });

  const adminRuleEngine = new AdminRuleEngine({
    requestMetadata: requestMetadata?.requestMetadata,
    requestSource: requestMetadata?.source,
  });

  await adminRuleEngine.runAndAssert({
    trigger: 'TEAM_NAME_CHANGED',
    user,
    organisation: team.organisation,
    team,
    newName: name,
    newUrl: url ?? team.url,
  });
};
