import { BulkSendCompleteEmail } from '@documenso/email/templates/bulk-send-complete';
import { sendDocument } from '@documenso/lib/server-only/document/send-document';
import { createDocumentFromTemplate } from '@documenso/lib/server-only/template/create-document-from-template';
import { getTemplateById } from '@documenso/lib/server-only/template/get-template-by-id';
import { validateBulkSendCsv } from '@documenso/lib/server-only/template/validate-bulk-send-csv';
import { prisma } from '@documenso/prisma';
import { msg } from '@lingui/macro';
import { createElement } from 'react';

import { getI18nInstance } from '../../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../../constants/app';
import { AppError } from '../../../errors/app-error';
import { getEmailContext } from '../../../server-only/email/get-email-context';
import { renderEmailWithI18N } from '../../../utils/render-email-with-i18n';
import type { JobRunIO } from '../../client/_internal/job';
import type { TBulkSendTemplateJobDefinition } from './bulk-send-template';

export const run = async ({ payload, io }: { payload: TBulkSendTemplateJobDefinition; io: JobRunIO }) => {
  const { userId, teamId, templateId, csvContent, sendImmediately, requestMetadata } = payload;

  const template = await getTemplateById({
    id: {
      type: 'templateId',
      id: templateId,
    },
    userId,
    teamId,
  });

  if (!template) {
    throw new Error('Template not found');
  }

  const { recipients } = template;

  // The CSV is validated upfront when the bulk send is uploaded, this acts as
  // a final safeguard prior to processing.
  const csvValidationResult = validateBulkSendCsv({
    csvContent,
    recipientCount: recipients.length,
  });

  if (!csvValidationResult.success) {
    throw new Error(`Bulk send CSV failed validation: ${JSON.stringify(csvValidationResult.error)}`);
  }

  const rows = csvValidationResult.data;

  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
    select: {
      email: true,
      name: true,
    },
  });

  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[],
  };

  // Process each row
  for (const [rowIndex, row] of rows.entries()) {
    try {
      const envelope = await io.runTask(`create-document-${rowIndex}`, async () => {
        return await createDocumentFromTemplate({
          id: {
            type: 'templateId',
            id: template.id,
          },
          userId,
          teamId,
          recipients: recipients.map((recipient, index) => {
            return {
              id: recipient.id,
              email: row[`recipient_${index + 1}_email`] || recipient.email,
              name: row[`recipient_${index + 1}_name`] || recipient.name,
              role: recipient.role,
              signingOrder: recipient.signingOrder,
            };
          }),
          requestMetadata: {
            source: 'app',
            auth: 'session',
            requestMetadata: requestMetadata || {},
          },
        });
      });

      if (sendImmediately) {
        await io.runTask(`send-document-${rowIndex}`, async () => {
          await sendDocument({
            id: {
              type: 'envelopeId',
              id: envelope.id,
            },
            userId,
            teamId,
            requestMetadata: {
              source: 'app',
              auth: 'session',
              requestMetadata: requestMetadata || {},
            },
          }).catch((err) => {
            console.error(err);

            throw new AppError('DOCUMENT_SEND_FAILED');
          });
        });
      }

      results.success += 1;
    } catch (error) {
      results.failed += 1;

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      results.errors.push(`Row ${rowIndex + 1}: Was unable to be processed - ${errorMessage}`);
    }
  }

  await io.runTask('send-completion-email', async () => {
    const completionTemplate = createElement(BulkSendCompleteEmail, {
      userName: user.name || user.email,
      templateName: template.title,
      totalProcessed: rows.length,
      successCount: results.success,
      failedCount: results.failed,
      errors: results.errors,
      assetBaseUrl: NEXT_PUBLIC_WEBAPP_URL(),
    });

    const { branding, emailLanguage, senderEmail, emailTransport } = await getEmailContext({
      emailType: 'INTERNAL',
      source: {
        type: 'team',
        teamId,
      },
    });

    const i18n = await getI18nInstance(emailLanguage);

    const [html, text] = await Promise.all([
      renderEmailWithI18N(completionTemplate, {
        lang: emailLanguage,
        branding,
      }),
      renderEmailWithI18N(completionTemplate, {
        lang: emailLanguage,
        branding,
        plainText: true,
      }),
    ]);

    await emailTransport.sendMail({
      to: {
        name: user.name || '',
        address: user.email,
      },
      from: senderEmail,
      subject: i18n._(msg`Bulk Send Complete: ${template.title}`),
      html,
      text,
    });
  });
};
