import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';
import { EnvelopeType } from '@prisma/client';

import { TEAM_DOCUMENT_VISIBILITY_MAP } from '../../constants/teams';
import { TagType } from '../../types/tag-type';
import { mapEnvelopeTagsToTags } from '../../utils/tags';
import { buildTeamWhereQuery } from '../../utils/teams';
import { getTeamById } from '../team/get-team';

export type SetEnvelopeTagsOptions = {
  userId: number;
  teamId: number;
  envelopeId: string;
  tagIds: string[];
};

export const setEnvelopeTags = async ({ userId, teamId, envelopeId, tagIds }: SetEnvelopeTagsOptions) => {
  const team = await getTeamById({ userId, teamId });

  // Verify the envelope exists and the user has access.
  const envelope = await prisma.envelope.findFirst({
    where: {
      id: envelopeId,
      OR: [
        { userId },
        {
          teamId: team.id,
          visibility: { in: TEAM_DOCUMENT_VISIBILITY_MAP[team.currentTeamRole] },
        },
      ],
    },
  });

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Envelope not found',
    });
  }

  // Determine the expected tag type based on the envelope type.
  const expectedTagType = envelope.type === EnvelopeType.DOCUMENT ? TagType.DOCUMENT : TagType.TEMPLATE;

  // Verify all tagIds belong to the same team and match the envelope type.
  if (tagIds.length > 0) {
    const tags = await prisma.tag.findMany({
      where: {
        id: { in: tagIds },
        team: buildTeamWhereQuery({ teamId, userId }),
        type: expectedTagType,
      },
    });

    if (tags.length !== tagIds.length) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: 'One or more tags are invalid or do not match the envelope type',
      });
    }
  }

  await prisma.$transaction(async (tx) => {
    // Delete EnvelopeTag rows not in the new set.
    await tx.envelopeTag.deleteMany({
      where: {
        envelopeId,
        tagId: { notIn: tagIds },
      },
    });

    // Fetch current assignments to find which ones need to be created.
    const existing = await tx.envelopeTag.findMany({
      where: { envelopeId },
      select: { tagId: true },
    });

    const existingTagIds = new Set(existing.map((et) => et.tagId));
    const toCreate = tagIds.filter((tagId) => !existingTagIds.has(tagId));

    if (toCreate.length > 0) {
      await tx.envelopeTag.createMany({
        data: toCreate.map((tagId) => ({
          envelopeId,
          tagId,
          assignedBy: userId,
        })),
      });
    }
  });

  const tags = await prisma.envelopeTag.findMany({
    where: { envelopeId },
    include: {
      tag: true,
    },
  });

  return mapEnvelopeTagsToTags(tags);
};
