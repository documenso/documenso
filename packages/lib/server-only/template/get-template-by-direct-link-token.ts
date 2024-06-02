import { prisma } from '@documenso/prisma';

export interface GetTemplateByDirectLinkTokenOptions {
  token: string;
}

export const getTemplateByDirectLinkToken = async ({
  token,
}: GetTemplateByDirectLinkTokenOptions) => {
  const template = await prisma.template.findFirstOrThrow({
    where: {
      directLink: {
        token,
        enabled: true,
      },
    },
    include: {
      directLink: true,
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
