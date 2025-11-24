import { createElement } from 'react';

import { msg } from '@lingui/core/macro';
import {
  DocumentStatus,
  EnvelopeType,
  OrganisationType,
  RecipientRole,
  SigningStatus,
} from '@prisma/client';

import { mailer } from '@documenso/email/mailer';
import { DocumentInviteEmailTemplate } from '@documenso/email/templates/document-invite';
import {
  RECIPIENT_ROLES_DESCRIPTION,
  RECIPIENT_ROLE_TO_EMAIL_TYPE,
} from '@documenso/lib/constants/recipient-roles';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { renderCustomEmailTemplate } from '@documenso/lib/utils/render-custom-email-template';
import { prisma } from '@documenso/prisma';

import { getI18nInstance } from '../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';
import { extractDerivedDocumentEmailSettings } from '../../types/document-email';
import { isDocumentCompleted } from '../../utils/document';
import type { EnvelopeIdOptions } from '../../utils/envelope';
import { renderEmailWithI18N } from '../../utils/render-email-with-i18n';
import { getEmailContext } from '../email/get-email-context';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';

export type ResendDocumentOptions = {
  id: EnvelopeIdOptions;
  userId: number;
  recipients: number[];
  teamId: number;
  requestMetadata: ApiRequestMetadata;
};

export const resendDocument = async ({
  id,
  userId,
  recipients,
  teamId,
  requestMetadata,
}: ResendDocumentOptions) => {
  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });

  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id,
    type: EnvelopeType.DOCUMENT,
    userId,
    teamId,
  });

  const envelope = await prisma.envelope.findUnique({
    where: envelopeWhereInput,
    include: {
      recipients: true,
      documentMeta: true,
      team: {
        select: {
          teamEmail: true,
          name: true,
        },
      },
    },
  });

  if (!envelope) {
    throw new Error('Document not found');
  }

  if (envelope.recipients.length === 0) {
    throw new Error('Document has no recipients');
  }

  if (envelope.status === DocumentStatus.DRAFT) {
    throw new Error('Can not send draft document');
  }

  if (isDocumentCompleted(envelope.status)) {
    throw new Error('Can not send completed document');
  }

  const recipientsToRemind = envelope.recipients.filter(
    (recipient) =>
      recipients.includes(recipient.id) && recipient.signingStatus === SigningStatus.NOT_SIGNED,
  );

  const isRecipientSigningRequestEmailEnabled = extractDerivedDocumentEmailSettings(
    envelope.documentMeta,
  ).recipientSigningRequest;

  if (!isRecipientSigningRequestEmailEnabled) {
    return envelope;
  }

  const { branding, emailLanguage, organisationType, senderEmail, replyToEmail } =
    await getEmailContext({
      emailType: 'RECIPIENT',
      source: {
        type: 'team',
        teamId: envelope.teamId,
      },
      meta: envelope.documentMeta,
    });

  await Promise.all(
    recipientsToRemind.map(async (recipient) => {
      if (recipient.role === RecipientRole.CC) {
        return;
      }

      const i18n = await getI18nInstance(emailLanguage);

      const recipientEmailType = RECIPIENT_ROLE_TO_EMAIL_TYPE[recipient.role];

      const { email, name } = recipient;
      const selfSigner = email === user.email;

      const recipientActionVerb = i18n
        ._(RECIPIENT_ROLES_DESCRIPTION[recipient.role].actionVerb)
        .toLowerCase();

      let emailMessage = envelope.documentMeta.message || '';
      let emailSubject = i18n._(msg`Reminder: Please ${recipientActionVerb} this document`);

      if (selfSigner) {
        emailMessage = i18n._(
          msg`You have initiated the document ${`"${envelope.title}"`} that requires you to ${recipientActionVerb} it.`,
        );
        emailSubject = i18n._(msg`Reminder: Please ${recipientActionVerb} your document`);
      }

      if (organisationType === OrganisationType.ORGANISATION) {
        emailSubject = i18n._(
          msg`Reminder: ${envelope.team.name} invited you to ${recipientActionVerb} a document`,
        );
        emailMessage =
          envelope.documentMeta.message ||
          i18n._(
            msg`${user.name || user.email} on behalf of "${envelope.team.name}" has invited you to ${recipientActionVerb} the document "${envelope.title}".`,
          );
      }

      const customEmailTemplate = {
        'signer.name': name,
        'signer.email': email,
        'document.name': envelope.title,
      };

      const assetBaseUrl = NEXT_PUBLIC_WEBAPP_URL() || 'http://localhost:3000';
      const signDocumentLink = `${NEXT_PUBLIC_WEBAPP_URL()}/sign/${recipient.token}`;

      const template = createElement(DocumentInviteEmailTemplate, {
        documentName: envelope.title,
        inviterName: user.name || undefined,
        inviterEmail:
          organisationType === OrganisationType.ORGANISATION
            ? envelope.team?.teamEmail?.email || user.email
            : user.email,
        assetBaseUrl,
        signDocumentLink,
        customBody: renderCustomEmailTemplate(emailMessage, customEmailTemplate),
        role: recipient.role,
        selfSigner,
        organisationType,
        teamName: envelope.team?.name,
      });

      const [html, text] = await Promise.all([
        renderEmailWithI18N(template, {
          lang: emailLanguage,
          branding,
        }),
        renderEmailWithI18N(template, {
          lang: emailLanguage,
          branding,
          plainText: true,
        }),
      ]);

      await prisma.$transaction(
        async (tx) => {
          await mailer.sendMail({
            to: {
              address: email,
              name,
            },
            from: senderEmail,
            replyTo: replyToEmail,
            subject: envelope.documentMeta.subject
              ? renderCustomEmailTemplate(
                  i18n._(msg`Reminder: ${envelope.documentMeta.subject}`),
                  customEmailTemplate,
                )
              : emailSubject,
            html,
            text,
          });

          await tx.documentAuditLog.create({
            data: createDocumentAuditLogData({
              type: DOCUMENT_AUDIT_LOG_TYPE.EMAIL_SENT,
              envelopeId: envelope.id,
              metadata: requestMetadata,
              data: {
                emailType: recipientEmailType,
                recipientEmail: recipient.email,
                recipientName: recipient.name,
                recipientRole: recipient.role,
                recipientId: recipient.id,
                isResending: true,
              },
            }),
          });
        },
        { timeout: 30_000 },
      );
    }),
  );

  return envelope;
};
