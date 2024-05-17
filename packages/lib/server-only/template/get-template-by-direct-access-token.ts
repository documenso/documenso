import { prisma } from '@documenso/prisma';

export interface GetTemplateByDirectAccessTokenOptions {
  token: string;
}

export const getTemplateByDirectAccessToken = async ({
  token,
}: GetTemplateByDirectAccessTokenOptions) => {
  const template = await prisma.template.findFirstOrThrow({
    where: {
      access: {
        token,
        enabled: true,
      },
    },
    include: {
      access: true,
      Recipient: {
        include: {
          Field: true,
        },
      },
      templateDocumentData: true,
      templateMeta: true,
    },
  });

  return {
    ...template,
    Field: template.Recipient.map((recipient) => recipient.Field).flat(),
  };
};
