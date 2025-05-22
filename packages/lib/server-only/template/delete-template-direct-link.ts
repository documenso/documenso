import { generateAvaliableRecipientPlaceholder } from '@documenso/lib/utils/templates';
import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { buildTeamWhereQuery } from '../../utils/teams';

export type DeleteTemplateDirectLinkOptions = {
  templateId: number;
  userId: number;
  teamId: number;
};

export const deleteTemplateDirectLink = async ({
  templateId,
  userId,
  teamId,
}: DeleteTemplateDirectLinkOptions): Promise<void> => {
  const template = await prisma.template.findFirst({
    where: {
      id: templateId,
      team: buildTeamWhereQuery(teamId, userId),
    },
    include: {
      directLink: true,
      recipients: true,
    },
  });

  if (!template) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Template not found',
    });
  }

  const { directLink } = template;

  if (!directLink) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.recipient.update({
      where: {
        templateId: template.id,
        id: directLink.directTemplateRecipientId,
      },
      data: {
        ...generateAvaliableRecipientPlaceholder(template.recipients),
      },
    });

    await tx.templateDirectLink.delete({
      where: {
        templateId,
      },
    });
  });
};
