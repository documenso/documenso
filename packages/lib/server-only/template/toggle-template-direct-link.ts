import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { buildTeamWhereQuery } from '../../utils/teams';

export type ToggleTemplateDirectLinkOptions = {
  templateId: number;
  userId: number;
  teamId: number;
  enabled: boolean;
};

export const toggleTemplateDirectLink = async ({
  templateId,
  userId,
  teamId,
  enabled,
}: ToggleTemplateDirectLinkOptions) => {
  const template = await prisma.template.findFirst({
    where: {
      id: templateId,
      team: buildTeamWhereQuery(teamId, userId),
    },
    include: {
      recipients: true,
      directLink: true,
    },
  });

  if (!template) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Template not found',
    });
  }

  const { directLink } = template;

  if (!directLink) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Direct template link not found',
    });
  }

  return await prisma.templateDirectLink.update({
    where: {
      id: directLink.id,
    },
    data: {
      templateId: template.id,
      enabled,
    },
  });
};
