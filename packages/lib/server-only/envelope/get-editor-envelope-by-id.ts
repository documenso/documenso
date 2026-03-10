import type { EnvelopeType } from '@prisma/client';

import { getEnvelopeWhereInput } from '@documenso/lib/server-only/envelope/get-envelope-by-id';
import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import type { EnvelopeIdOptions } from '../../utils/envelope';

export type GetEditorEnvelopeByIdOptions = {
  id: EnvelopeIdOptions;

  /**
   * The validated team ID.
   */
  userId: number;

  /**
   * The unvalidated team ID.
   */
  teamId: number;

  /**
   * The type of envelope to get.
   *
   * Set to null to bypass check.
   */
  type: EnvelopeType | null;
};

export const getEditorEnvelopeById = async ({
  id,
  userId,
  teamId,
  type,
}: GetEditorEnvelopeByIdOptions) => {
  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id,
    userId,
    teamId,
    type,
  });

  const envelope = await prisma.envelope.findFirst({
    where: envelopeWhereInput,
    include: {
      envelopeItems: {
        include: {
          documentData: true,
        },
        orderBy: {
          order: 'asc',
        },
      },
      folder: true,
      documentMeta: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      recipients: {
        orderBy: {
          id: 'asc',
        },
      },
      fields: true,
      team: {
        select: {
          id: true,
          url: true,
          organisationId: true,
        },
      },
      directLink: {
        select: {
          directTemplateRecipientId: true,
          enabled: true,
          id: true,
          token: true,
        },
      },
      envelopeAttachments: {
        select: {
          id: true,
          type: true,
          label: true,
          data: true,
        },
      },
    },
  });

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Envelope could not be found',
    });
  }

  return {
    ...envelope,
    attachments: envelope.envelopeAttachments,
    user: {
      id: envelope.user.id,
      name: envelope.user.name || '',
      email: envelope.user.email,
    },
  };
};
