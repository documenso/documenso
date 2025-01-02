import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';

export interface GetTemplateByDirectLinkTokenOptions {
  token: string;
}

export const getTemplateByDirectLinkToken = async ({
  token,
}: GetTemplateByDirectLinkTokenOptions) => {
  const template = await prisma.template.findFirst({
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

  const directLink = template?.directLink;

  // Doing this to enforce type safety for directLink.
  if (!directLink) {
    throw new AppError(AppErrorCode.NOT_FOUND);
  }

  return {
    ...template,
    directLink,
    fields: template.recipients.map((recipient) => recipient.fields).flat(),
  };
};
