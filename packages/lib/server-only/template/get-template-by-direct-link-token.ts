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
      recipients: {
        include: {
          fields: true,
        },
      },
      templateDocumentData: true,
      templateMeta: true,
    },
  });

  return {
    ...template,
    fields: template.recipients.map((recipient) => recipient.fields).flat(),
  };
};
