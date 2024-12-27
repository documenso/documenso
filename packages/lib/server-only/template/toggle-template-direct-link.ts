'use server';

import type { z } from 'zod';

import { prisma } from '@documenso/prisma';
import { TemplateDirectLinkSchema } from '@documenso/prisma/generated/zod';

import { AppError, AppErrorCode } from '../../errors/app-error';

export type ToggleTemplateDirectLinkOptions = {
  templateId: number;
  userId: number;
  enabled: boolean;
};

export const ZToggleTemplateDirectLinkResponseSchema = TemplateDirectLinkSchema;

export type TToggleTemplateDirectLinkResponse = z.infer<
  typeof ZToggleTemplateDirectLinkResponseSchema
>;

export const toggleTemplateDirectLink = async ({
  templateId,
  userId,
  enabled,
}: ToggleTemplateDirectLinkOptions): Promise<TToggleTemplateDirectLinkResponse> => {
  const template = await prisma.template.findFirst({
    where: {
      id: templateId,
      OR: [
        {
          userId,
        },
        {
          team: {
            members: {
              some: {
                userId,
              },
            },
          },
        },
      ],
    },
    include: {
      Recipient: true,
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
