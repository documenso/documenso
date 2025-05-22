import sharp from 'sharp';

import { prisma } from '@documenso/prisma';

import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '../../constants/organisations';
import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '../../constants/teams';
import { AppError } from '../../errors/app-error';
import type { ApiRequestMetadata } from '../../universal/extract-request-metadata';
import { buildOrganisationWhereQuery } from '../../utils/organisations';
import { buildTeamWhereQuery } from '../../utils/teams';

export type SetAvatarImageOptions = {
  userId: number;
  target:
    | {
        type: 'user';
      }
    | {
        type: 'team';
        teamId: number;
      }
    | {
        type: 'organisation';
        organisationId: string;
      };
  bytes?: string | null;
  requestMetadata: ApiRequestMetadata;
};

/**
 * Pretty nasty but will do for now.
 */
export const setAvatarImage = async ({
  userId,
  target,
  bytes,
  requestMetadata,
}: SetAvatarImageOptions) => {
  let oldAvatarImageId: string | null = null;

  if (target.type === 'team') {
    const team = await prisma.team.findFirst({
      where: buildTeamWhereQuery(
        target.teamId,
        userId,
        TEAM_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_TEAM'],
      ),
    });

    if (!team) {
      throw new AppError('TEAM_NOT_FOUND', {
        statusCode: 404,
      });
    }

    oldAvatarImageId = team.avatarImageId;
  } else if (target.type === 'organisation') {
    const organisation = await prisma.organisation.findFirst({
      where: buildOrganisationWhereQuery(
        target.organisationId,
        userId,
        ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
      ),
    });

    if (!organisation) {
      throw new AppError('ORGANISATION_NOT_FOUND', {
        statusCode: 404,
      });
    }

    oldAvatarImageId = organisation.avatarImageId;
  } else {
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      include: {
        avatarImage: true,
      },
    });

    if (!user) {
      throw new AppError('USER_NOT_FOUND', {
        statusCode: 404,
      });
    }

    oldAvatarImageId = user.avatarImageId;
  }

  if (oldAvatarImageId) {
    await prisma.avatarImage.delete({
      where: {
        id: oldAvatarImageId,
      },
    });
  }

  let newAvatarImageId: string | null = null;

  if (bytes) {
    const optimisedBytes = await sharp(Buffer.from(bytes, 'base64'))
      .resize(512, 512)
      .toFormat('jpeg', { quality: 75 })
      .toBuffer();

    const avatarImage = await prisma.avatarImage.create({
      data: {
        bytes: optimisedBytes.toString('base64'),
      },
    });

    newAvatarImageId = avatarImage.id;
  }

  // TODO: Audit Logs

  if (target.type === 'team') {
    await prisma.team.update({
      where: {
        id: target.teamId,
      },
      data: {
        avatarImageId: newAvatarImageId,
      },
    });
  } else if (target.type === 'organisation') {
    await prisma.organisation.update({
      where: {
        id: target.organisationId,
      },
      data: {
        avatarImageId: newAvatarImageId,
      },
    });
  } else {
    await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        avatarImageId: newAvatarImageId,
      },
    });
  }

  return newAvatarImageId;
};
