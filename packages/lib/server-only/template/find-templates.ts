import { match } from 'ts-pattern';
import type { z } from 'zod';

import { prisma } from '@documenso/prisma';
import {
  DocumentVisibility,
  type Prisma,
  TeamMemberRole,
  type Template,
} from '@documenso/prisma/client';
import {
  DocumentDataSchema,
  FieldSchema,
  RecipientSchema,
  TeamSchema,
  TemplateDirectLinkSchema,
  TemplateMetaSchema,
  TemplateSchema,
} from '@documenso/prisma/generated/zod';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { type FindResultResponse, ZFindResultResponse } from '../../types/search-params';

export type FindTemplatesOptions = {
  userId: number;
  teamId?: number;
  type?: Template['type'];
  page?: number;
  perPage?: number;
};

export const ZFindTemplatesResponseSchema = ZFindResultResponse.extend({
  data: TemplateSchema.extend({
    templateDocumentData: DocumentDataSchema,
    team: TeamSchema.pick({
      id: true,
      url: true,
    }).nullable(),
    Field: FieldSchema.array(),
    Recipient: RecipientSchema.array(),
    templateMeta: TemplateMetaSchema.pick({
      signingOrder: true,
      distributionMethod: true,
    }).nullable(),
    directLink: TemplateDirectLinkSchema.pick({
      token: true,
      enabled: true,
    }).nullable(),
  }).array(), // Todo: openapi.
});

export type TFindTemplatesResponse = z.infer<typeof ZFindTemplatesResponseSchema>;
export type FindTemplateRow = TFindTemplatesResponse['data'][number];

export const findTemplates = async ({
  userId,
  teamId,
  type,
  page = 1,
  perPage = 10,
}: FindTemplatesOptions): Promise<TFindTemplatesResponse> => {
  const whereFilter: Prisma.TemplateWhereInput[] = [];

  if (teamId === undefined) {
    whereFilter.push({ userId, teamId: null });
  }

  if (teamId !== undefined) {
    const teamMember = await prisma.teamMember.findFirst({
      where: {
        userId,
        teamId,
      },
    });

    if (!teamMember) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'You are not a member of this team.',
      });
    }

    whereFilter.push(
      { teamId },
      {
        OR: [
          match(teamMember.role)
            .with(TeamMemberRole.ADMIN, () => ({
              visibility: {
                in: [
                  DocumentVisibility.EVERYONE,
                  DocumentVisibility.MANAGER_AND_ABOVE,
                  DocumentVisibility.ADMIN,
                ],
              },
            }))
            .with(TeamMemberRole.MANAGER, () => ({
              visibility: {
                in: [DocumentVisibility.EVERYONE, DocumentVisibility.MANAGER_AND_ABOVE],
              },
            }))
            .otherwise(() => ({ visibility: DocumentVisibility.EVERYONE })),
          { userId, teamId },
        ],
      },
    );
  }

  const [data, count] = await Promise.all([
    prisma.template.findMany({
      where: {
        type,
        AND: whereFilter,
      },
      include: {
        templateDocumentData: true,
        team: {
          select: {
            id: true,
            url: true,
          },
        },
        Field: true,
        Recipient: true,
        templateMeta: true,
        directLink: {
          select: {
            token: true,
            enabled: true,
          },
        },
      },
      skip: Math.max(page - 1, 0) * perPage,
      orderBy: {
        createdAt: 'desc',
      },
    }),
    prisma.template.count({
      where: {
        AND: whereFilter,
      },
    }),
  ]);

  return {
    data,
    count,
    currentPage: Math.max(page, 1),
    perPage,
    totalPages: Math.ceil(count / perPage),
  } satisfies FindResultResponse<typeof data>;
};
