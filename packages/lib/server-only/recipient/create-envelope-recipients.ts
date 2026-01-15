import { EnvelopeType, RecipientRole } from '@prisma/client';
import { SendStatus, SigningStatus } from '@prisma/client';

import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { TRecipientAccessAuthTypes } from '@documenso/lib/types/document-auth';
import { type TRecipientActionAuthTypes } from '@documenso/lib/types/document-auth';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { nanoid } from '@documenso/lib/universal/id';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { createRecipientAuthOptions } from '@documenso/lib/utils/document-auth';
import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import type { EnvelopeIdOptions } from '../../utils/envelope';
import { mapRecipientToLegacyRecipient } from '../../utils/recipients';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';

export interface CreateEnvelopeRecipientsOptions {
  userId: number;
  teamId: number;
  id: EnvelopeIdOptions;
  recipients: {
    email: string;
    name: string;
    role: RecipientRole;
    signingOrder?: number | null;
    accessAuth?: TRecipientAccessAuthTypes[];
    actionAuth?: TRecipientActionAuthTypes[];
  }[];
  requestMetadata?: ApiRequestMetadata;
}

export const createEnvelopeRecipients = async ({
  userId,
  teamId,
  id,
  recipients: recipientsToCreate,
  requestMetadata,
}: CreateEnvelopeRecipientsOptions) => {
  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id,
    type: null,
    userId,
    teamId,
  });

  const envelope = await prisma.envelope.findFirst({
    where: envelopeWhereInput,
    include: {
      recipients: true,
      team: {
        select: {
          organisation: {
            select: {
              organisationClaim: true,
            },
          },
        },
      },
    },
  });

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Envelope not found',
    });
  }

  if (envelope.completedAt) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Envelope already complete',
    });
  }

  const recipientsHaveActionAuth = recipientsToCreate.some(
    (recipient) => recipient.actionAuth && recipient.actionAuth.length > 0,
  );

  // Check if user has permission to set the global action auth.
  if (recipientsHaveActionAuth && !envelope.team.organisation.organisationClaim.flags.cfr21) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'You do not have permission to set the action auth',
    });
  }

  const normalizedRecipients = recipientsToCreate.map((recipient) => ({
    ...recipient,
    email: recipient.email.toLowerCase(),
  }));

  const createdRecipients = await prisma.$transaction(async (tx) => {
    return await Promise.all(
      normalizedRecipients.map(async (recipient) => {
        const authOptions = createRecipientAuthOptions({
          accessAuth: recipient.accessAuth ?? [],
          actionAuth: recipient.actionAuth ?? [],
        });

        const createdRecipient = await tx.recipient.create({
          data: {
            envelopeId: envelope.id,
            name: recipient.name,
            email: recipient.email,
            role: recipient.role,
            signingOrder: recipient.signingOrder,
            token: nanoid(),
            sendStatus: recipient.role === RecipientRole.CC ? SendStatus.SENT : SendStatus.NOT_SENT,
            signingStatus:
              recipient.role === RecipientRole.CC ? SigningStatus.SIGNED : SigningStatus.NOT_SIGNED,
            authOptions,
          },
        });

        // Handle recipient created audit log.
        if (envelope.type === EnvelopeType.DOCUMENT) {
          await tx.documentAuditLog.create({
            data: createDocumentAuditLogData({
              type: DOCUMENT_AUDIT_LOG_TYPE.RECIPIENT_CREATED,
              envelopeId: envelope.id,
              metadata: requestMetadata,
              data: {
                recipientEmail: createdRecipient.email,
                recipientName: createdRecipient.name,
                recipientId: createdRecipient.id,
                recipientRole: createdRecipient.role,
                accessAuth: recipient.accessAuth ?? [],
                actionAuth: recipient.actionAuth ?? [],
              },
            }),
          });
        }

        return createdRecipient;
      }),
    );
  });

  return {
    recipients: createdRecipients.map((recipient) =>
      mapRecipientToLegacyRecipient(recipient, envelope),
    ),
  };
};
