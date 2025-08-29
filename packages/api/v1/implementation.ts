import type { Prisma } from '@prisma/client';
import { DocumentDataType, SigningStatus } from '@prisma/client';
import { tsr } from '@ts-rest/serverless/fetch';
import { match } from 'ts-pattern';

import { getServerLimits } from '@documenso/ee/server-only/limits/server';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { DATE_FORMATS, DEFAULT_DOCUMENT_DATE_FORMAT } from '@documenso/lib/constants/date-formats';
import '@documenso/lib/constants/time-zones';
import { DEFAULT_DOCUMENT_TIME_ZONE, TIME_ZONES } from '@documenso/lib/constants/time-zones';
import { AppError } from '@documenso/lib/errors/app-error';
import { createDocumentData } from '@documenso/lib/server-only/document-data/create-document-data';
import { upsertDocumentMeta } from '@documenso/lib/server-only/document-meta/upsert-document-meta';
import { createDocument } from '@documenso/lib/server-only/document/create-document';
import { deleteDocument } from '@documenso/lib/server-only/document/delete-document';
import { findDocuments } from '@documenso/lib/server-only/document/find-documents';
import { getDocumentById } from '@documenso/lib/server-only/document/get-document-by-id';
import { resendDocument } from '@documenso/lib/server-only/document/resend-document';
import { sendDocument } from '@documenso/lib/server-only/document/send-document';
import { updateDocument as updateDocumentSettings } from '@documenso/lib/server-only/document/update-document';
import { deleteField } from '@documenso/lib/server-only/field/delete-field';
import { getFieldById } from '@documenso/lib/server-only/field/get-field-by-id';
import { getFieldsForDocument } from '@documenso/lib/server-only/field/get-fields-for-document';
import { updateField } from '@documenso/lib/server-only/field/update-field';
import { insertFormValuesInPdf } from '@documenso/lib/server-only/pdf/insert-form-values-in-pdf';
import { deleteRecipient } from '@documenso/lib/server-only/recipient/delete-recipient';
import { getRecipientByIdV1Api } from '@documenso/lib/server-only/recipient/get-recipient-by-id-v1-api';
import { getRecipientsForDocument } from '@documenso/lib/server-only/recipient/get-recipients-for-document';
import { setDocumentRecipients } from '@documenso/lib/server-only/recipient/set-document-recipients';
import { updateDocumentRecipients } from '@documenso/lib/server-only/recipient/update-document-recipients';
import { createDocumentFromTemplate } from '@documenso/lib/server-only/template/create-document-from-template';
import { createDocumentFromTemplateLegacy } from '@documenso/lib/server-only/template/create-document-from-template-legacy';
import { createTemplate } from '@documenso/lib/server-only/template/create-template';
import { deleteTemplate } from '@documenso/lib/server-only/template/delete-template';
import { findTemplates } from '@documenso/lib/server-only/template/find-templates';
import { getTemplateById } from '@documenso/lib/server-only/template/get-template-by-id';
import { ZRecipientAuthOptionsSchema } from '@documenso/lib/types/document-auth';
import { extractDerivedDocumentEmailSettings } from '@documenso/lib/types/document-email';
import {
  ZCheckboxFieldMeta,
  ZDropdownFieldMeta,
  ZFieldMetaSchema,
  ZNumberFieldMeta,
  ZRadioFieldMeta,
  ZTextFieldMeta,
} from '@documenso/lib/types/field-meta';
import { getFileServerSide } from '@documenso/lib/universal/upload/get-file.server';
import { putPdfFileServerSide } from '@documenso/lib/universal/upload/put-file.server';
import {
  getPresignGetUrl,
  getPresignPostUrl,
} from '@documenso/lib/universal/upload/server-actions';
import { isDocumentCompleted } from '@documenso/lib/utils/document';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { buildTeamWhereQuery } from '@documenso/lib/utils/teams';
import { prisma } from '@documenso/prisma';

import { ApiContractV1 } from './contract';
import { authenticatedMiddleware } from './middleware/authenticated';

export const ApiContractV1Implementation = tsr.router(ApiContractV1, {
  getDocuments: authenticatedMiddleware(async (args, user, team) => {
    const page = Number(args.query.page) || 1;
    const perPage = Number(args.query.perPage) || 10;

    const { data: documents, totalPages } = await findDocuments({
      page,
      perPage,
      userId: user.id,
      teamId: team?.id,
    });

    return {
      status: 200,
      body: {
        documents,
        totalPages,
      },
    };
  }),

  getDocument: authenticatedMiddleware(async (args, user, team, { logger }) => {
    const { id: documentId } = args.params;

    logger.info({
      input: {
        id: documentId,
      },
    });

    try {
      const document = await getDocumentById({
        documentId: Number(documentId),
        userId: user.id,
        teamId: team?.id,
      });

      const recipients = await getRecipientsForDocument({
        documentId: Number(documentId),
        userId: user.id,
        teamId: team?.id,
      });

      const fields = await getFieldsForDocument({
        documentId: Number(documentId),
        userId: user.id,
        teamId: team?.id,
      });

      const parsedMetaFields = fields.map((field) => {
        let parsedMetaOrNull = null;

        if (field.fieldMeta) {
          const result = ZFieldMetaSchema.safeParse(field.fieldMeta);

          if (!result.success) {
            throw new Error('Field meta parsing failed for field ' + field.id);
          }

          parsedMetaOrNull = result.data;
        }

        return {
          ...field,
          fieldMeta: parsedMetaOrNull,
        };
      });

      return {
        status: 200,
        body: {
          ...document,
          recipients: recipients.map((recipient) => ({
            ...recipient,
            signingUrl: `${NEXT_PUBLIC_WEBAPP_URL()}/sign/${recipient.token}`,
          })),
          fields: parsedMetaFields,
        },
      };
    } catch (err) {
      return {
        status: 404,
        body: {
          message: 'Document not found',
        },
      };
    }
  }),

  downloadSignedDocument: authenticatedMiddleware(async (args, user, team, { logger }) => {
    const { id: documentId } = args.params;
    const { downloadOriginalDocument } = args.query;

    logger.info({
      input: {
        id: documentId,
      },
    });

    try {
      if (process.env.NEXT_PUBLIC_UPLOAD_TRANSPORT !== 's3') {
        return {
          status: 500,
          body: {
            message: 'Please make sure the storage transport is set to S3.',
          },
        };
      }

      const document = await getDocumentById({
        documentId: Number(documentId),
        userId: user.id,
        teamId: team?.id,
      });

      if (!document || !document.documentDataId) {
        return {
          status: 404,
          body: {
            message: 'Document not found',
          },
        };
      }

      if (DocumentDataType.S3_PATH !== document.documentData.type) {
        return {
          status: 400,
          body: {
            message: 'Invalid document data type',
          },
        };
      }

      if (!downloadOriginalDocument && !isDocumentCompleted(document.status)) {
        return {
          status: 400,
          body: {
            message: 'Document is not completed yet.',
          },
        };
      }

      const { url } = await getPresignGetUrl(
        downloadOriginalDocument ? document.documentData.initialData : document.documentData.data,
      );

      return {
        status: 200,
        body: { downloadUrl: url },
      };
    } catch (err) {
      return {
        status: 500,
        body: {
          message: 'Error downloading the document. Please try again.',
        },
      };
    }
  }),

  deleteDocument: authenticatedMiddleware(async (args, user, team, { logger, metadata }) => {
    const { id: documentId } = args.params;

    logger.info({
      input: {
        id: documentId,
      },
    });

    try {
      const document = await getDocumentById({
        documentId: Number(documentId),
        userId: user.id,
        teamId: team?.id,
      });

      if (!document) {
        return {
          status: 404,
          body: {
            message: 'Document not found',
          },
        };
      }

      const deletedDocument = await deleteDocument({
        id: document.id,
        userId: user.id,
        teamId: team?.id,
        requestMetadata: metadata,
      });

      return {
        status: 200,
        body: deletedDocument,
      };
    } catch (err) {
      return {
        status: 404,
        body: {
          message: 'Document not found',
        },
      };
    }
  }),

  createDocument: authenticatedMiddleware(async (args, user, team, { metadata }) => {
    const { body } = args;

    try {
      if (process.env.NEXT_PUBLIC_UPLOAD_TRANSPORT !== 's3') {
        return {
          status: 500,
          body: {
            message: 'Create document is not available without S3 transport.',
          },
        };
      }

      const { remaining } = await getServerLimits({ userId: user.id, teamId: team.id });

      if (remaining.documents <= 0) {
        return {
          status: 400,
          body: {
            message: 'You have reached the maximum number of documents allowed for this month',
          },
        };
      }

      const dateFormat = body.meta.dateFormat
        ? DATE_FORMATS.find((format) => format.value === body.meta.dateFormat)
        : DATE_FORMATS.find((format) => format.value === DEFAULT_DOCUMENT_DATE_FORMAT);

      if (body.meta.dateFormat && !dateFormat) {
        return {
          status: 400,
          body: {
            message: 'Invalid date format. Please provide a valid date format',
          },
        };
      }

      const timezone = body.meta.timezone
        ? TIME_ZONES.find((tz) => tz === body.meta.timezone)
        : DEFAULT_DOCUMENT_TIME_ZONE;

      const isTimeZoneValid = body.meta.timezone ? TIME_ZONES.includes(String(timezone)) : true;

      if (!isTimeZoneValid) {
        return {
          status: 400,
          body: {
            message: 'Invalid timezone. Please provide a valid timezone',
          },
        };
      }

      const fileName = body.title.endsWith('.pdf') ? body.title : `${body.title}.pdf`;

      const { url, key } = await getPresignPostUrl(fileName, 'application/pdf');

      const documentData = await createDocumentData({
        data: key,
        type: DocumentDataType.S3_PATH,
      });

      const document = await createDocument({
        title: body.title,
        externalId: body.externalId || null,
        userId: user.id,
        teamId: team?.id,
        formValues: body.formValues,
        folderId: body.folderId,
        documentDataId: documentData.id,
        requestMetadata: metadata,
      });

      await upsertDocumentMeta({
        documentId: document.id,
        userId: user.id,
        teamId: team?.id,
        subject: body.meta.subject,
        message: body.meta.message,
        timezone,
        dateFormat: dateFormat?.value,
        redirectUrl: body.meta.redirectUrl,
        signingOrder: body.meta.signingOrder,
        allowDictateNextSigner: body.meta.allowDictateNextSigner,
        language: body.meta.language,
        typedSignatureEnabled: body.meta.typedSignatureEnabled,
        uploadSignatureEnabled: body.meta.uploadSignatureEnabled,
        drawSignatureEnabled: body.meta.drawSignatureEnabled,
        distributionMethod: body.meta.distributionMethod,
        emailSettings: body.meta.emailSettings,
        requestMetadata: metadata,
      });

      if (body.authOptions) {
        await updateDocumentSettings({
          documentId: document.id,
          userId: user.id,
          teamId: team?.id,
          data: {
            ...body.authOptions,
          },
          requestMetadata: metadata,
        });
      }

      const { recipients } = await setDocumentRecipients({
        userId: user.id,
        teamId: team?.id,
        documentId: document.id,
        recipients: body.recipients,
        requestMetadata: metadata,
      });

      return {
        status: 200,
        body: {
          uploadUrl: url,
          documentId: document.id,
          recipients: recipients.map((recipient) => ({
            recipientId: recipient.id,
            name: recipient.name,
            email: recipient.email,
            token: recipient.token,
            role: recipient.role,
            signingOrder: recipient.signingOrder,

            signingUrl: `${NEXT_PUBLIC_WEBAPP_URL()}/sign/${recipient.token}`,
          })),
        },
      };
    } catch (err) {
      return {
        status: 404,
        body: {
          message: 'An error has occured while uploading the file',
        },
      };
    }
  }),

  createTemplate: authenticatedMiddleware(async (args, user, team) => {
    const { body } = args;
    const {
      title,
      folderId,
      externalId,
      visibility,
      globalAccessAuth,
      globalActionAuth,
      publicTitle,
      publicDescription,
      type,
      meta,
    } = body;

    try {
      if (process.env.NEXT_PUBLIC_UPLOAD_TRANSPORT !== 's3') {
        return {
          status: 500,
          body: {
            message: 'Create template is not available without S3 transport.',
          },
        };
      }

      const dateFormat = meta?.dateFormat
        ? DATE_FORMATS.find((format) => format.value === meta?.dateFormat)
        : DATE_FORMATS.find((format) => format.value === DEFAULT_DOCUMENT_DATE_FORMAT);

      if (meta?.dateFormat && !dateFormat) {
        return {
          status: 400,
          body: {
            message: 'Invalid date format. Please provide a valid date format',
          },
        };
      }

      const timezone = meta?.timezone
        ? TIME_ZONES.find((tz) => tz === meta?.timezone)
        : DEFAULT_DOCUMENT_TIME_ZONE;

      const isTimeZoneValid = meta?.timezone ? TIME_ZONES.includes(String(timezone)) : true;

      if (!isTimeZoneValid) {
        return {
          status: 400,
          body: {
            message: 'Invalid timezone. Please provide a valid timezone',
          },
        };
      }

      const fileName = title?.endsWith('.pdf') ? title : `${title}.pdf`;

      const { url, key } = await getPresignPostUrl(fileName, 'application/pdf');

      const templateDocumentData = await createDocumentData({
        data: key,
        type: DocumentDataType.S3_PATH,
      });

      const createdTemplate = await createTemplate({
        userId: user.id,
        teamId: team.id,
        templateDocumentDataId: templateDocumentData.id,
        data: {
          title,
          folderId,
          externalId,
          visibility,
          globalAccessAuth,
          globalActionAuth,
          publicTitle,
          publicDescription,
          type,
        },
        meta,
      });

      const fullTemplate = await getTemplateById({
        id: createdTemplate.id,
        userId: user.id,
        teamId: team.id,
      });

      return {
        status: 200,
        body: {
          uploadUrl: url,
          template: fullTemplate,
        },
      };
    } catch (err) {
      return {
        status: 404,
        body: {
          message: 'An error has occured while creating the template',
        },
      };
    }
  }),

  deleteTemplate: authenticatedMiddleware(async (args, user, team, { logger }) => {
    const { id: templateId } = args.params;

    logger.info({
      input: {
        id: templateId,
      },
    });

    try {
      const deletedTemplate = await deleteTemplate({
        id: Number(templateId),
        userId: user.id,
        teamId: team?.id,
      });

      return {
        status: 200,
        body: deletedTemplate,
      };
    } catch (err) {
      return {
        status: 404,
        body: {
          message: 'Template not found',
        },
      };
    }
  }),

  getTemplate: authenticatedMiddleware(async (args, user, team, { logger }) => {
    const { id: templateId } = args.params;

    logger.info({
      input: {
        id: templateId,
      },
    });

    try {
      const template = await getTemplateById({
        id: Number(templateId),
        userId: user.id,
        teamId: team?.id,
      });

      return {
        status: 200,
        body: {
          ...template,
          Field: template.fields.map((field) => ({
            ...field,
            fieldMeta: field.fieldMeta ? ZFieldMetaSchema.parse(field.fieldMeta) : null,
          })),
          Recipient: template.recipients,
        },
      };
    } catch (err) {
      return AppError.toRestAPIError(err);
    }
  }),

  getTemplates: authenticatedMiddleware(async (args, user, team) => {
    const page = Number(args.query.page) || 1;
    const perPage = Number(args.query.perPage) || 10;

    try {
      const { data: templates, totalPages } = await findTemplates({
        page,
        perPage,
        userId: user.id,
        teamId: team?.id,
      });

      return {
        status: 200,
        body: {
          templates: templates.map((template) => ({
            ...template,
            Field: template.fields.map((field) => ({
              ...field,
              fieldMeta: field.fieldMeta ? ZFieldMetaSchema.parse(field.fieldMeta) : null,
            })),
            Recipient: template.recipients,
          })),
          totalPages,
        },
      };
    } catch (err) {
      return AppError.toRestAPIError(err);
    }
  }),

  createDocumentFromTemplate: authenticatedMiddleware(
    async (args, user, team, { logger, metadata }) => {
      const { body, params } = args;

      logger.info({
        input: {
          templateId: params.templateId,
        },
      });

      const { remaining } = await getServerLimits({ userId: user.id, teamId: team?.id });

      if (remaining.documents <= 0) {
        return {
          status: 400,
          body: {
            message: 'You have reached the maximum number of documents allowed for this month',
          },
        };
      }

      const templateId = Number(params.templateId);

      const fileName = body.title.endsWith('.pdf') ? body.title : `${body.title}.pdf`;

      const document = await createDocumentFromTemplateLegacy({
        templateId,
        userId: user.id,
        teamId: team?.id,
        recipients: body.recipients,
      });

      let documentDataId = document.documentDataId;

      if (body.formValues) {
        const pdf = await getFileServerSide(document.documentData);

        const prefilled = await insertFormValuesInPdf({
          pdf: Buffer.from(pdf),
          formValues: body.formValues,
        });

        const newDocumentData = await putPdfFileServerSide({
          name: fileName,
          type: 'application/pdf',
          arrayBuffer: async () => Promise.resolve(prefilled),
        });

        documentDataId = newDocumentData.id;
      }

      await updateDocument({
        documentId: document.id,
        userId: user.id,
        teamId: team?.id,
        data: {
          title: fileName,
          externalId: body.externalId || null,
          formValues: body.formValues,
          documentData: {
            connect: {
              id: documentDataId,
            },
          },
        },
      });

      if (body.meta) {
        await upsertDocumentMeta({
          documentId: document.id,
          userId: user.id,
          teamId: team?.id,
          ...body.meta,
          requestMetadata: metadata,
        });
      }

      if (body.authOptions) {
        await updateDocumentSettings({
          documentId: document.id,
          userId: user.id,
          teamId: team?.id,
          data: body.authOptions,
          requestMetadata: metadata,
        });
      }

      return {
        status: 200,
        body: {
          documentId: document.id,
          recipients: document.recipients.map((recipient) => ({
            recipientId: recipient.id,
            name: recipient.name,
            email: recipient.email,
            token: recipient.token,
            role: recipient.role,
            signingOrder: recipient.signingOrder,

            signingUrl: `${NEXT_PUBLIC_WEBAPP_URL()}/sign/${recipient.token}`,
          })),
        },
      };
    },
  ),

  generateDocumentFromTemplate: authenticatedMiddleware(
    async (args, user, team, { logger, metadata }) => {
      const { body, params } = args;

      logger.info({
        input: {
          templateId: params.templateId,
        },
      });

      const { remaining } = await getServerLimits({ userId: user.id, teamId: team?.id });

      if (remaining.documents <= 0) {
        return {
          status: 400,
          body: {
            message: 'You have reached the maximum number of documents allowed for this month',
          },
        };
      }

      const templateId = Number(params.templateId);

      let document: Awaited<ReturnType<typeof createDocumentFromTemplate>> | null = null;

      try {
        document = await createDocumentFromTemplate({
          templateId,
          externalId: body.externalId || null,
          userId: user.id,
          teamId: team?.id,
          recipients: body.recipients,
          prefillFields: body.prefillFields,
          folderId: body.folderId,
          override: {
            title: body.title,
            ...body.meta,
          },
          requestMetadata: metadata,
        });
      } catch (err) {
        return AppError.toRestAPIError(err);
      }

      if (body.formValues) {
        const fileName = document.title.endsWith('.pdf') ? document.title : `${document.title}.pdf`;

        const pdf = await getFileServerSide(document.documentData);

        const prefilled = await insertFormValuesInPdf({
          pdf: Buffer.from(pdf),
          formValues: body.formValues,
        });

        const newDocumentData = await putPdfFileServerSide({
          name: fileName,
          type: 'application/pdf',
          arrayBuffer: async () => Promise.resolve(prefilled),
        });

        await updateDocument({
          documentId: document.id,
          userId: user.id,
          teamId: team?.id,
          data: {
            formValues: body.formValues,
            documentData: {
              connect: {
                id: newDocumentData.id,
              },
            },
          },
        });
      }

      if (body.authOptions) {
        await updateDocumentSettings({
          documentId: document.id,
          userId: user.id,
          teamId: team?.id,
          data: body.authOptions,
          requestMetadata: metadata,
        });
      }

      return {
        status: 200,
        body: {
          documentId: document.id,
          recipients: document.recipients.map((recipient) => ({
            recipientId: recipient.id,
            name: recipient.name,
            email: recipient.email,
            token: recipient.token,
            role: recipient.role,
            signingOrder: recipient.signingOrder,
            signingUrl: `${NEXT_PUBLIC_WEBAPP_URL()}/sign/${recipient.token}`,
          })),
        },
      };
    },
  ),

  sendDocument: authenticatedMiddleware(async (args, user, team, { logger, metadata }) => {
    const { id: documentId } = args.params;
    const { sendEmail, sendCompletionEmails } = args.body;

    logger.info({
      input: {
        id: documentId,
      },
    });

    try {
      const document = await getDocumentById({
        documentId: Number(documentId),
        userId: user.id,
        teamId: team?.id,
      });

      if (!document) {
        return {
          status: 404,
          body: {
            message: 'Document not found',
          },
        };
      }

      if (isDocumentCompleted(document.status)) {
        return {
          status: 400,
          body: {
            message: 'Document is already complete',
          },
        };
      }

      const emailSettings = extractDerivedDocumentEmailSettings(document.documentMeta);

      // Update document email settings if sendCompletionEmails is provided
      if (typeof sendCompletionEmails === 'boolean') {
        await upsertDocumentMeta({
          documentId: document.id,
          userId: user.id,
          teamId: team?.id,
          emailSettings: {
            ...emailSettings,
            documentCompleted: sendCompletionEmails,
            ownerDocumentCompleted: sendCompletionEmails,
          },
          requestMetadata: metadata,
        });
      }

      const { recipients, ...sentDocument } = await sendDocument({
        documentId: document.id,
        userId: user.id,
        teamId: team?.id,
        sendEmail,
        requestMetadata: metadata,
      });

      return {
        status: 200,
        body: {
          message: 'Document sent for signing successfully',
          ...sentDocument,
          recipients: recipients.map((recipient) => ({
            ...recipient,
            signingUrl: `${NEXT_PUBLIC_WEBAPP_URL()}/sign/${recipient.token}`,
          })),
        },
      };
    } catch (err) {
      return {
        status: 500,
        body: {
          message: 'An error has occured while sending the document for signing',
        },
      };
    }
  }),

  resendDocument: authenticatedMiddleware(async (args, user, team, { logger, metadata }) => {
    const { id: documentId } = args.params;
    const { recipients } = args.body;

    logger.info({
      input: {
        id: documentId,
      },
    });

    try {
      await resendDocument({
        userId: user.id,
        documentId: Number(documentId),
        recipients,
        teamId: team?.id,
        requestMetadata: metadata,
      });

      return {
        status: 200,
        body: {
          message: 'Document resend successfully initiated',
        },
      };
    } catch (err) {
      return {
        status: 500,
        body: {
          message: 'An error has occured while resending the document',
        },
      };
    }
  }),

  createRecipient: authenticatedMiddleware(async (args, user, team, { logger, metadata }) => {
    const { id: documentId } = args.params;
    const { name, email, role, authOptions, signingOrder } = args.body;

    logger.info({
      input: {
        id: documentId,
      },
    });

    const document = await getDocumentById({
      documentId: Number(documentId),
      userId: user.id,
      teamId: team?.id,
    });

    if (!document) {
      return {
        status: 404,
        body: {
          message: 'Document not found',
        },
      };
    }

    if (isDocumentCompleted(document.status)) {
      return {
        status: 400,
        body: {
          message: 'Document is already completed',
        },
      };
    }

    const recipients = await getRecipientsForDocument({
      documentId: Number(documentId),
      userId: user.id,
      teamId: team?.id,
    });

    const recipientAlreadyExists = recipients.some((recipient) => recipient.email === email);

    if (recipientAlreadyExists) {
      return {
        status: 400,
        body: {
          message: 'Recipient already exists',
        },
      };
    }

    try {
      const { recipients: newRecipients } = await setDocumentRecipients({
        documentId: Number(documentId),
        userId: user.id,
        teamId: team?.id,
        recipients: [
          ...recipients.map((recipient) => ({
            email: recipient.email,
            name: recipient.name,
            role: recipient.role,
            signingOrder: recipient.signingOrder,
            actionAuth: ZRecipientAuthOptionsSchema.parse(recipient.authOptions)?.actionAuth ?? [],
          })),
          {
            email,
            name,
            role,
            signingOrder,
            actionAuth: authOptions?.actionAuth ?? [],
          },
        ],
        requestMetadata: metadata,
      });

      const newRecipient = newRecipients.find((recipient) => recipient.email === email);

      if (!newRecipient) {
        throw new Error('Recipient not found');
      }

      return {
        status: 200,
        body: {
          ...newRecipient,
          documentId: Number(documentId),
          signingUrl: `${NEXT_PUBLIC_WEBAPP_URL()}/sign/${newRecipient.token}`,
        },
      };
    } catch (err) {
      return {
        status: 500,
        body: {
          message: 'An error has occured while creating the recipient',
        },
      };
    }
  }),

  updateRecipient: authenticatedMiddleware(async (args, user, team, { logger, metadata }) => {
    const { id: documentId, recipientId } = args.params;
    const { name, email, role, authOptions, signingOrder } = args.body;

    logger.info({
      input: {
        id: documentId,
        recipientId,
      },
    });

    const document = await getDocumentById({
      documentId: Number(documentId),
      userId: user.id,
      teamId: team?.id,
    });

    if (!document) {
      return {
        status: 404,
        body: {
          message: 'Document not found',
        },
      };
    }

    if (isDocumentCompleted(document.status)) {
      return {
        status: 400,
        body: {
          message: 'Document is already completed',
        },
      };
    }

    const updatedRecipient = await updateDocumentRecipients({
      userId: user.id,
      teamId: team.id,
      documentId: Number(documentId),
      recipients: [
        {
          id: Number(recipientId),
          email,
          name,
          role,
          signingOrder,
          actionAuth: authOptions?.actionAuth ?? [],
        },
      ],
      requestMetadata: metadata,
    })
      .then(({ recipients }) => recipients[0])
      .catch(null);

    if (!updatedRecipient) {
      return {
        status: 404,
        body: {
          message: 'Recipient not found',
        },
      };
    }

    return {
      status: 200,
      body: {
        ...updatedRecipient,
        documentId: Number(documentId),
        signingUrl: `${NEXT_PUBLIC_WEBAPP_URL()}/sign/${updatedRecipient.token}`,
      },
    };
  }),

  deleteRecipient: authenticatedMiddleware(async (args, user, team, { logger, metadata }) => {
    const { id: documentId, recipientId } = args.params;

    logger.info({
      input: {
        id: documentId,
        recipientId,
      },
    });

    const document = await getDocumentById({
      documentId: Number(documentId),
      userId: user.id,
      teamId: team?.id,
    });

    if (!document) {
      return {
        status: 404,
        body: {
          message: 'Document not found',
        },
      };
    }

    if (isDocumentCompleted(document.status)) {
      return {
        status: 400,
        body: {
          message: 'Document is already completed',
        },
      };
    }

    const deletedRecipient = await deleteRecipient({
      documentId: Number(documentId),
      recipientId: Number(recipientId),
      userId: user.id,
      teamId: team?.id,
      requestMetadata: metadata.requestMetadata,
    }).catch(() => null);

    if (!deletedRecipient) {
      return {
        status: 400,
        body: {
          message: 'Unable to delete recipient',
        },
      };
    }

    return {
      status: 200,
      body: {
        ...deletedRecipient,
        documentId: Number(documentId),
        signingUrl: '',
      },
    };
  }),

  createField: authenticatedMiddleware(async (args, user, team, { logger, metadata }) => {
    const { id: documentId } = args.params;

    logger.info({
      input: {
        id: documentId,
      },
    });

    const fields = Array.isArray(args.body) ? args.body : [args.body];

    const document = await prisma.document.findFirst({
      select: { id: true, status: true },
      where: {
        id: Number(documentId),
        team: buildTeamWhereQuery({ teamId: team.id, userId: user.id }),
      },
    });

    if (!document) {
      return {
        status: 404,
        body: { message: 'Document not found' },
      };
    }

    if (isDocumentCompleted(document.status)) {
      return {
        status: 400,
        body: { message: 'Document is already completed' },
      };
    }

    try {
      const createdFields = await prisma.$transaction(async (tx) => {
        return Promise.all(
          fields.map(async (fieldData) => {
            const {
              recipientId,
              type,
              pageNumber,
              pageWidth,
              pageHeight,
              pageX,
              pageY,
              fieldMeta,
            } = fieldData;

            if (pageNumber <= 0) {
              throw new Error('Invalid page number');
            }

            const recipient = await getRecipientByIdV1Api({
              id: Number(recipientId),
              documentId: Number(documentId),
            }).catch(() => null);

            if (!recipient) {
              throw new Error('Recipient not found');
            }

            if (recipient.signingStatus === SigningStatus.SIGNED) {
              throw new Error('Recipient has already signed the document');
            }

            const advancedField = ['NUMBER', 'RADIO', 'CHECKBOX', 'DROPDOWN', 'TEXT'].includes(
              type,
            );

            if (advancedField && !fieldMeta) {
              throw new Error(
                'Field meta is required for this type of field. Please provide the appropriate field meta object.',
              );
            }

            if (fieldMeta && fieldMeta.type.toLowerCase() !== String(type).toLowerCase()) {
              throw new Error('Field meta type does not match the field type');
            }

            const result = match(type)
              .with('RADIO', () => ZRadioFieldMeta.safeParse(fieldMeta))
              .with('CHECKBOX', () => ZCheckboxFieldMeta.safeParse(fieldMeta))
              .with('DROPDOWN', () => ZDropdownFieldMeta.safeParse(fieldMeta))
              .with('NUMBER', () => ZNumberFieldMeta.safeParse(fieldMeta))
              .with('TEXT', () => ZTextFieldMeta.safeParse(fieldMeta))
              .with('SIGNATURE', 'INITIALS', 'DATE', 'EMAIL', 'NAME', () => ({
                success: true,
                data: undefined,
              }))
              .with('FREE_SIGNATURE', () => ({
                success: false,
                error: 'FREE_SIGNATURE is not supported',
                data: undefined,
              }))
              .exhaustive();

            if (!result.success) {
              throw new Error('Field meta parsing failed');
            }

            const field = await tx.field.create({
              data: {
                documentId: Number(documentId),
                recipientId: Number(recipientId),
                type,
                page: pageNumber,
                positionX: pageX,
                positionY: pageY,
                width: pageWidth,
                height: pageHeight,
                customText: '',
                inserted: false,
                fieldMeta: result.data,
              },
              include: {
                recipient: true,
              },
            });

            await tx.documentAuditLog.create({
              data: createDocumentAuditLogData({
                type: 'FIELD_CREATED',
                documentId: Number(documentId),
                user: {
                  id: team?.id ?? user.id,
                  email: team?.name ?? user.email,
                  name: team ? '' : user.name,
                },
                data: {
                  fieldId: field.secondaryId,
                  fieldRecipientEmail: field.recipient?.email ?? '',
                  fieldRecipientId: recipientId,
                  fieldType: field.type,
                },
                requestMetadata: metadata.requestMetadata,
              }),
            });

            return {
              id: field.id,
              documentId: Number(field.documentId),
              recipientId: field.recipientId ?? -1,
              type: field.type,
              pageNumber: field.page,
              pageX: Number(field.positionX),
              pageY: Number(field.positionY),
              pageWidth: Number(field.width),
              pageHeight: Number(field.height),
              customText: field.customText,
              fieldMeta: field.fieldMeta ? ZFieldMetaSchema.parse(field.fieldMeta) : undefined,
              inserted: field.inserted,
            };
          }),
        );
      });

      return {
        status: 200,
        body: {
          fields: createdFields,
          documentId: Number(documentId),
        },
      };
    } catch (err) {
      return AppError.toRestAPIError(err);
    }
  }),

  updateField: authenticatedMiddleware(async (args, user, team, { logger, metadata }) => {
    const { id: documentId, fieldId } = args.params;
    const { recipientId, type, pageNumber, pageWidth, pageHeight, pageX, pageY, fieldMeta } =
      args.body;

    logger.info({
      input: {
        id: documentId,
        fieldId,
      },
    });

    const document = await getDocumentById({
      documentId: Number(documentId),
      userId: user.id,
      teamId: team?.id,
    });

    if (!document) {
      return {
        status: 404,
        body: {
          message: 'Document not found',
        },
      };
    }

    if (isDocumentCompleted(document.status)) {
      return {
        status: 400,
        body: {
          message: 'Document is already completed',
        },
      };
    }

    const recipient = await getRecipientByIdV1Api({
      id: Number(recipientId),
      documentId: Number(documentId),
    }).catch(() => null);

    if (!recipient) {
      return {
        status: 404,
        body: {
          message: 'Recipient not found',
        },
      };
    }

    if (recipient.signingStatus === SigningStatus.SIGNED) {
      return {
        status: 400,
        body: {
          message: 'Recipient has already signed the document',
        },
      };
    }

    const updatedField = await updateField({
      fieldId: Number(fieldId),
      userId: user.id,
      teamId: team?.id,
      documentId: Number(documentId),
      recipientId: recipientId ? Number(recipientId) : undefined,
      type,
      pageNumber,
      pageX,
      pageY,
      pageWidth,
      pageHeight,
      requestMetadata: metadata.requestMetadata,
      fieldMeta: fieldMeta ? ZFieldMetaSchema.parse(fieldMeta) : undefined,
    });

    const remappedField = {
      id: updatedField.id,
      documentId: updatedField.documentId,
      recipientId: updatedField.recipientId ?? -1,
      type: updatedField.type,
      pageNumber: updatedField.page,
      pageX: Number(updatedField.positionX),
      pageY: Number(updatedField.positionY),
      pageWidth: Number(updatedField.width),
      pageHeight: Number(updatedField.height),
      customText: updatedField.customText,
      inserted: updatedField.inserted,
    };

    return {
      status: 200,
      body: {
        ...remappedField,
        documentId: Number(documentId),
      },
    };
  }),

  deleteField: authenticatedMiddleware(async (args, user, team, { logger, metadata }) => {
    const { id: documentId, fieldId } = args.params;

    logger.info({
      input: {
        id: documentId,
        fieldId,
      },
    });

    const document = await getDocumentById({
      documentId: Number(documentId),
      userId: user.id,
      teamId: team.id,
    });

    if (!document) {
      return {
        status: 404,
        body: {
          message: 'Document not found',
        },
      };
    }

    if (isDocumentCompleted(document.status)) {
      return {
        status: 400,
        body: {
          message: 'Document is already completed',
        },
      };
    }

    const field = await getFieldById({
      userId: user.id,
      teamId: team?.id,
      fieldId: Number(fieldId),
    }).catch(() => null);

    if (!field) {
      return {
        status: 404,
        body: {
          message: 'Field not found',
        },
      };
    }

    const recipient = await getRecipientByIdV1Api({
      id: Number(field.recipientId),
      documentId: Number(documentId),
    }).catch(() => null);

    if (recipient?.signingStatus === SigningStatus.SIGNED) {
      return {
        status: 400,
        body: {
          message: 'Recipient has already signed the document',
        },
      };
    }

    const deletedField = await deleteField({
      documentId: Number(documentId),
      fieldId: Number(fieldId),
      userId: user.id,
      teamId: team?.id,
      requestMetadata: metadata.requestMetadata,
    }).catch(() => null);

    if (!deletedField) {
      return {
        status: 400,
        body: {
          message: 'Unable to delete field',
        },
      };
    }

    const remappedField = {
      id: deletedField.id,
      documentId: deletedField.documentId,
      recipientId: deletedField.recipientId ?? -1,
      type: deletedField.type,
      pageNumber: deletedField.page,
      pageX: Number(deletedField.positionX),
      pageY: Number(deletedField.positionY),
      pageWidth: Number(deletedField.width),
      pageHeight: Number(deletedField.height),
      customText: deletedField.customText,
      inserted: deletedField.inserted,
    };

    return {
      status: 200,
      body: {
        ...remappedField,
        documentId: Number(documentId),
      },
    };
  }),
});

const updateDocument = async ({
  documentId,
  userId,
  teamId,
  data,
}: {
  documentId: number;
  data: Prisma.DocumentUpdateInput;
  userId: number;
  teamId: number;
}) => {
  return await prisma.document.update({
    where: {
      id: documentId,
      team: buildTeamWhereQuery({ teamId, userId }),
    },
    data: {
      ...data,
    },
  });
};
