import { createElement } from 'react';

import { msg } from '@lingui/core/macro';
import type { Recipient } from '@prisma/client';
import { EnvelopeType, RecipientRole } from '@prisma/client';
import { SendStatus, SigningStatus } from '@prisma/client';
import { isDeepEqual } from 'remeda';

import { mailer } from '@documenso/email/mailer';
import RecipientRemovedFromDocumentTemplate from '@documenso/email/templates/recipient-removed-from-document';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { TRecipientAccessAuthTypes } from '@documenso/lib/types/document-auth';
import {
  type TRecipientActionAuthTypes,
  ZRecipientAuthOptionsSchema,
} from '@documenso/lib/types/document-auth';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { nanoid } from '@documenso/lib/universal/id';
import {
  createDocumentAuditLogData,
  diffRecipientChanges,
} from '@documenso/lib/utils/document-audit-logs';
import { createRecipientAuthOptions } from '@documenso/lib/utils/document-auth';
import { prisma } from '@documenso/prisma';

import { getI18nInstance } from '../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { extractDerivedDocumentEmailSettings } from '../../types/document-email';
import { type EnvelopeIdOptions, mapSecondaryIdToDocumentId } from '../../utils/envelope';
import { canRecipientBeModified } from '../../utils/recipients';
import { renderEmailWithI18N } from '../../utils/render-email-with-i18n';
import { getEmailContext } from '../email/get-email-context';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';

export interface SetDocumentRecipientsOptions {
  userId: number;
  teamId: number;
  id: EnvelopeIdOptions;
  recipients: RecipientData[];
  requestMetadata: ApiRequestMetadata;
}

export const setDocumentRecipients = async ({
  userId,
  teamId,
  id,
  recipients,
  requestMetadata,
}: SetDocumentRecipientsOptions) => {
  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id,
    type: EnvelopeType.DOCUMENT,
    userId,
    teamId,
  });

  const envelope = await prisma.envelope.findFirst({
    where: envelopeWhereInput,
    include: {
      fields: true,
      documentMeta: true,
      team: {
        select: {
          organisation: {
            select: {
              organisationClaim: true,
            },
          },
        },
      },
      recipients: true,
    },
  });

  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  if (!envelope) {
    throw new Error('Document not found');
  }

  if (envelope.completedAt) {
    throw new Error('Document already complete');
  }

  const { branding, emailLanguage, senderEmail, replyToEmail } = await getEmailContext({
    emailType: 'RECIPIENT',
    source: {
      type: 'team',
      teamId,
    },
    meta: envelope.documentMeta,
  });

  const recipientsHaveActionAuth = recipients.some(
    (recipient) => recipient.actionAuth && recipient.actionAuth.length > 0,
  );

  // Check if user has permission to set the global action auth.
  if (recipientsHaveActionAuth && !envelope.team.organisation.organisationClaim.flags.cfr21) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'You do not have permission to set the action auth',
    });
  }

  const normalizedRecipients = recipients.map((recipient) => ({
    ...recipient,
    email: recipient.email.toLowerCase(),
  }));

  const existingRecipients = envelope.recipients;

  const removedRecipients = existingRecipients.filter(
    (existingRecipient) =>
      !normalizedRecipients.find((recipient) => recipient.id === existingRecipient.id),
  );

  const linkedRecipients = normalizedRecipients.map((recipient) => {
    const existing = existingRecipients.find(
      (existingRecipient) => existingRecipient.id === recipient.id,
    );

    const canPersistedRecipientBeModified =
      existing && canRecipientBeModified(existing, envelope.fields);

    if (
      existing &&
      hasRecipientBeenChanged(existing, recipient) &&
      !canRecipientBeModified(existing, envelope.fields)
    ) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Cannot modify a recipient who has already interacted with the document',
      });
    }

    return {
      ...recipient,
      _persisted: existing,
      canPersistedRecipientBeModified,
    };
  });

  const persistedRecipients = await prisma.$transaction(async (tx) => {
    return await Promise.all(
      linkedRecipients.map(async (recipient) => {
        let authOptions = ZRecipientAuthOptionsSchema.parse(recipient._persisted?.authOptions);

        if (recipient.actionAuth !== undefined || recipient.accessAuth !== undefined) {
          authOptions = createRecipientAuthOptions({
            accessAuth: recipient.accessAuth || authOptions.accessAuth,
            actionAuth: recipient.actionAuth || authOptions.actionAuth,
          });
        }

        if (recipient._persisted && !recipient.canPersistedRecipientBeModified) {
          return {
            ...recipient._persisted,
            clientId: recipient.clientId,
          };
        }

        const upsertedRecipient = await tx.recipient.upsert({
          where: {
            id: recipient._persisted?.id ?? -1,
            envelopeId: envelope.id,
          },
          update: {
            name: recipient.name,
            email: recipient.email,
            role: recipient.role,
            signingOrder: recipient.signingOrder,
            envelopeId: envelope.id,
            sendStatus: recipient.role === RecipientRole.CC ? SendStatus.SENT : SendStatus.NOT_SENT,
            signingStatus:
              recipient.role === RecipientRole.CC ? SigningStatus.SIGNED : SigningStatus.NOT_SIGNED,
            authOptions,
          },
          create: {
            name: recipient.name,
            email: recipient.email,
            role: recipient.role,
            signingOrder: recipient.signingOrder,
            token: nanoid(),
            envelopeId: envelope.id,
            sendStatus: recipient.role === RecipientRole.CC ? SendStatus.SENT : SendStatus.NOT_SENT,
            signingStatus:
              recipient.role === RecipientRole.CC ? SigningStatus.SIGNED : SigningStatus.NOT_SIGNED,
            authOptions,
          },
        });

        const recipientId = upsertedRecipient.id;

        // Clear all fields if the recipient role is changed to a type that cannot have fields.
        if (
          recipient._persisted &&
          recipient._persisted.role !== recipient.role &&
          (recipient.role === RecipientRole.CC || recipient.role === RecipientRole.VIEWER)
        ) {
          await tx.field.deleteMany({
            where: {
              recipientId,
            },
          });
        }

        const baseAuditLog = {
          recipientEmail: upsertedRecipient.email,
          recipientName: upsertedRecipient.name,
          recipientId,
          recipientRole: upsertedRecipient.role,
        };

        const changes = recipient._persisted
          ? diffRecipientChanges(recipient._persisted, upsertedRecipient)
          : [];

        // Handle recipient updated audit log.
        if (recipient._persisted && changes.length > 0) {
          await tx.documentAuditLog.create({
            data: createDocumentAuditLogData({
              type: DOCUMENT_AUDIT_LOG_TYPE.RECIPIENT_UPDATED,
              envelopeId: envelope.id,
              metadata: requestMetadata,
              data: {
                changes,
                ...baseAuditLog,
              },
            }),
          });
        }

        // Handle recipient created audit log.
        if (!recipient._persisted) {
          await tx.documentAuditLog.create({
            data: createDocumentAuditLogData({
              type: DOCUMENT_AUDIT_LOG_TYPE.RECIPIENT_CREATED,
              envelopeId: envelope.id,
              metadata: requestMetadata,
              data: {
                ...baseAuditLog,
                accessAuth: recipient.accessAuth || [],
                actionAuth: recipient.actionAuth || [],
              },
            }),
          });
        }

        return {
          ...upsertedRecipient,
          clientId: recipient.clientId,
        };
      }),
    );
  });

  if (removedRecipients.length > 0) {
    await prisma.$transaction(async (tx) => {
      await tx.recipient.deleteMany({
        where: {
          id: {
            in: removedRecipients.map((recipient) => recipient.id),
          },
        },
      });

      await tx.documentAuditLog.createMany({
        data: removedRecipients.map((recipient) =>
          createDocumentAuditLogData({
            type: DOCUMENT_AUDIT_LOG_TYPE.RECIPIENT_DELETED,
            envelopeId: envelope.id,
            metadata: requestMetadata,
            data: {
              recipientEmail: recipient.email,
              recipientName: recipient.name,
              recipientId: recipient.id,
              recipientRole: recipient.role,
            },
          }),
        ),
      });
    });

    const isRecipientRemovedEmailEnabled = extractDerivedDocumentEmailSettings(
      envelope.documentMeta,
    ).recipientRemoved;

    // Send emails to deleted recipients.
    await Promise.all(
      removedRecipients.map(async (recipient) => {
        if (recipient.sendStatus !== SendStatus.SENT || !isRecipientRemovedEmailEnabled) {
          return;
        }

        const assetBaseUrl = NEXT_PUBLIC_WEBAPP_URL() || 'http://localhost:3000';

        const template = createElement(RecipientRemovedFromDocumentTemplate, {
          documentName: envelope.title,
          inviterName: user.name || undefined,
          assetBaseUrl,
        });

        const [html, text] = await Promise.all([
          renderEmailWithI18N(template, { lang: emailLanguage, branding }),
          renderEmailWithI18N(template, { lang: emailLanguage, branding, plainText: true }),
        ]);

        const i18n = await getI18nInstance(emailLanguage);

        await mailer.sendMail({
          to: {
            address: recipient.email,
            name: recipient.name,
          },
          from: senderEmail,
          replyTo: replyToEmail,
          subject: i18n._(msg`You have been removed from a document`),
          html,
          text,
        });
      }),
    );
  }

  // Filter out recipients that have been removed or have been updated.
  const filteredRecipients: RecipientDataWithClientId[] = existingRecipients.filter((recipient) => {
    const isRemoved = removedRecipients.find(
      (removedRecipient) => removedRecipient.id === recipient.id,
    );
    const isUpdated = persistedRecipients.find(
      (persistedRecipient) => persistedRecipient.id === recipient.id,
    );

    return !isRemoved && !isUpdated;
  });

  return {
    recipients: [...filteredRecipients, ...persistedRecipients].map((recipient) => ({
      ...recipient,
      documentId: mapSecondaryIdToDocumentId(envelope.secondaryId),
      templateId: null,
    })),
  };
};

/**
 * If you change this you MUST update the `hasRecipientBeenChanged` function.
 */
type RecipientData = {
  id?: number | null;
  clientId?: string | null;
  email: string;
  name: string;
  role: RecipientRole;
  signingOrder?: number | null;
  accessAuth?: TRecipientAccessAuthTypes[];
  actionAuth?: TRecipientActionAuthTypes[];
};

type RecipientDataWithClientId = Recipient & {
  clientId?: string | null;
};

const hasRecipientBeenChanged = (recipient: Recipient, newRecipientData: RecipientData) => {
  const authOptions = ZRecipientAuthOptionsSchema.parse(recipient.authOptions);

  const newRecipientAccessAuth = newRecipientData.accessAuth || [];
  const newRecipientActionAuth = newRecipientData.actionAuth || [];

  return (
    recipient.email !== newRecipientData.email ||
    recipient.name !== newRecipientData.name ||
    recipient.role !== newRecipientData.role ||
    recipient.signingOrder !== newRecipientData.signingOrder ||
    !isDeepEqual(authOptions.accessAuth, newRecipientAccessAuth) ||
    !isDeepEqual(authOptions.actionAuth, newRecipientActionAuth)
  );
};
