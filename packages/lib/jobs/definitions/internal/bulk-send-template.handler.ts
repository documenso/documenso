import { createElement } from 'react';

import { msg } from '@lingui/macro';
import { parse } from 'csv-parse/sync';
import { z } from 'zod';

import { mailer } from '@documenso/email/mailer';
import { BulkSendCompleteEmail } from '@documenso/email/templates/bulk-send-complete';
import { sendDocument } from '@documenso/lib/server-only/document/send-document';
import { createDocumentFromTemplate } from '@documenso/lib/server-only/template/create-document-from-template';
import { getTemplateById } from '@documenso/lib/server-only/template/get-template-by-id';
import { prisma } from '@documenso/prisma';

import { getI18nInstance } from '../../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../../constants/app';
import { FROM_ADDRESS, FROM_NAME } from '../../../constants/email';
import { AppError } from '../../../errors/app-error';
import { getEmailContext } from '../../../server-only/email/get-email-context';
import { renderEmailWithI18N } from '../../../utils/render-email-with-i18n';
import type { JobRunIO } from '../../client/_internal/job';
import type { TBulkSendTemplateJobDefinition } from './bulk-send-template';

const ZRecipientRowSchema = z.object({
  name: z.string().optional(),
  email: z.union([
    z.string().email({ message: 'Value must be a valid email or empty string' }),
    z.string().max(0, { message: 'Value must be a valid email or empty string' }),
  ]),
});

export const run = async ({
  payload,
  io,
}: {
  payload: TBulkSendTemplateJobDefinition;
  io: JobRunIO;
}) => {
  const { userId, teamId, templateId, csvContent, sendImmediately, requestMetadata } = payload;

  const template = await getTemplateById({
    id: templateId,
    userId,
    teamId,
  });

  if (!template) {
    throw new Error('Template not found');
  }

  const rows = parse(csvContent, { columns: true, skip_empty_lines: true });

  if (rows.length > 100) {
    throw new Error('Maximum 100 rows allowed per upload');
  }

  const { recipients } = template;

  // Validate CSV structure
  const csvHeaders = Object.keys(rows[0]);
  const requiredHeaders = recipients.map((_, index) => `recipient_${index + 1}_email`);

  for (const header of requiredHeaders) {
    if (!csvHeaders.includes(header)) {
      throw new Error(`Missing required column: ${header}`);
    }
  }

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
    errors: Array<string>(),
  };

  // Process each row
  for (const [rowIndex, row] of rows.entries()) {
    try {
      for (const [recipientIndex] of recipients.entries()) {
        const nameKey = `recipient_${recipientIndex + 1}_name`;
        const emailKey = `recipient_${recipientIndex + 1}_email`;

        const parsed = ZRecipientRowSchema.safeParse({
          name: row[nameKey],
          email: row[emailKey],
        });

        if (!parsed.success) {
          throw new Error(
            `Invalid recipient data provided for ${emailKey}, ${nameKey}: ${parsed.error.issues?.[0]?.message}`,
          );
        }
      }

      const document = await io.runTask(`create-document-${rowIndex}`, async () => {
        return await createDocumentFromTemplate({
          templateId: template.id,
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
            documentId: document.id,
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

    const { branding, settings } = await getEmailContext({
      source: {
        type: 'team',
        teamId,
      },
    });

    const lang = template.templateMeta?.language ?? settings.documentLanguage;

    const i18n = await getI18nInstance(lang);

    const [html, text] = await Promise.all([
      renderEmailWithI18N(completionTemplate, {
        lang,
        branding,
      }),
      renderEmailWithI18N(completionTemplate, {
        lang,
        branding,
        plainText: true,
      }),
    ]);

    await mailer.sendMail({
      to: {
        name: user.name || '',
        address: user.email,
      },
      from: {
        name: FROM_NAME,
        address: FROM_ADDRESS,
      },
      subject: i18n._(msg`Bulk Send Complete: ${template.title}`),
      html,
      text,
    });
  });
};
