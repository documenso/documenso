import { DocumentDataType, EnvelopeType, SigningStatus } from '@prisma/client';
import { tsr } from '@ts-rest/serverless/fetch';
import { match } from 'ts-pattern';

import { getServerLimits } from '@documenso/ee/server-only/limits/server';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { DATE_FORMATS, DEFAULT_DOCUMENT_DATE_FORMAT } from '@documenso/lib/constants/date-formats';
import '@documenso/lib/constants/time-zones';
import { DEFAULT_DOCUMENT_TIME_ZONE, TIME_ZONES } from '@documenso/lib/constants/time-zones';
import { AppError } from '@documenso/lib/errors/app-error';
import { createDocumentData } from '@documenso/lib/server-only/document-data/create-document-data';
import { updateDocumentMeta } from '@documenso/lib/server-only/document-meta/upsert-document-meta';
import { deleteDocument } from '@documenso/lib/server-only/document/delete-document';
import { findDocuments } from '@documenso/lib/server-only/document/find-documents';
import { resendDocument } from '@documenso/lib/server-only/document/resend-document';
import { sendDocument } from '@documenso/lib/server-only/document/send-document';
import { createEnvelope } from '@documenso/lib/server-only/envelope/create-envelope';
import {
  getEnvelopeById,
  getEnvelopeWhereInput,
} from '@documenso/lib/server-only/envelope/get-envelope-by-id';
import { deleteDocumentField } from '@documenso/lib/server-only/field/delete-document-field';
import { updateEnvelopeFields } from '@documenso/lib/server-only/field/update-envelope-fields';
import { insertFormValuesInPdf } from '@documenso/lib/server-only/pdf/insert-form-values-in-pdf';
import { deleteEnvelopeRecipient } from '@documenso/lib/server-only/recipient/delete-envelope-recipient';
import { getRecipientsForDocument } from '@documenso/lib/server-only/recipient/get-recipients-for-document';
import { setDocumentRecipients } from '@documenso/lib/server-only/recipient/set-document-recipients';
import { updateEnvelopeRecipients } from '@documenso/lib/server-only/recipient/update-envelope-recipients';
import { createDocumentFromTemplate } from '@documenso/lib/server-only/template/create-document-from-template';
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
import {
  mapSecondaryIdToDocumentId,
  mapSecondaryIdToTemplateId,
} from '@documenso/lib/utils/envelope';
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
      teamId: team.id,
    });

    return {
      status: 200,
      body: {
        documents: documents.map((document) => ({
          id: mapSecondaryIdToDocumentId(document.secondaryId),
          externalId: document.externalId,
          userId: document.userId,
          teamId: document.teamId,
          title: document.title,
          status: document.status,
          createdAt: document.createdAt,
          updatedAt: document.updatedAt,
          completedAt: document.completedAt,
        })),
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
      const { envelopeWhereInput } = await getEnvelopeWhereInput({
        id: {
          type: 'documentId',
          id: Number(documentId),
        },
        type: EnvelopeType.DOCUMENT,
        userId: user.id,
        teamId: team.id,
      });

      const envelope = await prisma.envelope.findFirstOrThrow({
        where: envelopeWhereInput,
        include: {
          recipients: {
            orderBy: {
              id: 'asc',
            },
          },
          fields: {
            include: {
              signature: true,
              recipient: {
                select: {
                  name: true,
                  email: true,
                  signingStatus: true,
                },
              },
            },
            orderBy: {
              id: 'asc',
            },
          },
        },
      });

      const { fields, recipients } = envelope;

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

      const legacyDocumentId = mapSecondaryIdToDocumentId(envelope.secondaryId);

      return {
        status: 200,
        body: {
          id: legacyDocumentId,
          externalId: envelope.externalId,
          userId: envelope.userId,
          teamId: envelope.teamId,
          title: envelope.title,
          status: envelope.status,
          createdAt: envelope.createdAt,
          updatedAt: envelope.updatedAt,
          completedAt: envelope.completedAt,
          recipients: recipients.map((recipient) => ({
            id: recipient.id,
            documentId: legacyDocumentId,
            email: recipient.email,
            name: recipient.name,
            role: recipient.role,
            signingOrder: recipient.signingOrder,
            token: recipient.token,
            signedAt: recipient.signedAt,
            readStatus: recipient.readStatus,
            signingStatus: recipient.signingStatus,
            sendStatus: recipient.sendStatus,
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
      const envelope = await getEnvelopeById({
        id: {
          type: 'documentId',
          id: Number(documentId),
        },
        type: EnvelopeType.DOCUMENT,
        userId: user.id,
        teamId: team.id,
      }).catch(() => null);

      const firstDocumentData = envelope?.envelopeItems[0]?.documentData;

      if (!envelope || !firstDocumentData) {
        return {
          status: 404,
          body: {
            message: 'Document not found',
          },
        };
      }

      // This error is done AFTER the get envelope so we can test access controls without S3.
      if (process.env.NEXT_PUBLIC_UPLOAD_TRANSPORT !== 's3') {
        return {
          status: 500,
          body: {
            message: 'Document downloads are only available when S3 storage is configured.',
          },
        };
      }

      if (DocumentDataType.S3_PATH !== firstDocumentData.type) {
        return {
          status: 400,
          body: {
            message: 'Invalid document data type',
          },
        };
      }

      if (!downloadOriginalDocument && !isDocumentCompleted(envelope.status)) {
        return {
          status: 400,
          body: {
            message: 'Document is not completed yet.',
          },
        };
      }

      if (envelope.envelopeItems.length !== 1) {
        return {
          status: 400,
          body: {
            message: 'API V1 does not support items',
          },
        };
      }

      const { url } = await getPresignGetUrl(
        downloadOriginalDocument ? firstDocumentData.initialData : firstDocumentData.data,
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
      const legacyDocumentId = Number(documentId);

      const envelope = await getEnvelopeById({
        id: {
          type: 'documentId',
          id: legacyDocumentId,
        },
        type: EnvelopeType.DOCUMENT,
        userId: user.id,
        teamId: team.id,
      });

      if (!envelope) {
        return {
          status: 404,
          body: {
            message: 'Document not found',
          },
        };
      }

      const deletedDocument = await deleteDocument({
        id: {
          type: 'documentId',
          id: legacyDocumentId,
        },
        userId: user.id,
        teamId: team.id,
        requestMetadata: metadata,
      });

      return {
        status: 200,
        body: {
          id: legacyDocumentId,
          externalId: deletedDocument.externalId,
          userId: deletedDocument.userId,
          teamId: deletedDocument.teamId,
          title: deletedDocument.title,
          status: deletedDocument.status,
          createdAt: deletedDocument.createdAt,
          updatedAt: deletedDocument.updatedAt,
          completedAt: deletedDocument.completedAt,
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

      const envelope = await createEnvelope({
        userId: user.id,
        teamId: team.id,
        internalVersion: 1,
        data: {
          title: body.title,
          type: EnvelopeType.DOCUMENT,
          externalId: body.externalId || undefined,
          formValues: body.formValues,
          folderId: body.folderId,
          envelopeItems: [
            {
              documentDataId: documentData.id,
            },
          ],
          globalAccessAuth: body.authOptions?.globalAccessAuth,
          globalActionAuth: body.authOptions?.globalActionAuth,
        },
        attachments: body.attachments,
        meta: {
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
        },
        requestMetadata: metadata,
      });

      const legacyDocumentId = mapSecondaryIdToDocumentId(envelope.secondaryId);

      const { recipients } = await setDocumentRecipients({
        userId: user.id,
        teamId: team.id,
        id: {
          type: 'documentId',
          id: legacyDocumentId,
        },
        recipients: body.recipients,
        requestMetadata: metadata,
      });

      return {
        status: 200,
        body: {
          uploadUrl: url,
          documentId: legacyDocumentId,
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

  createTemplate: authenticatedMiddleware(async (args, user, team, { metadata }) => {
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
      attachments,
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

      const createdTemplate = await createEnvelope({
        userId: user.id,
        teamId: team.id,
        internalVersion: 1,
        data: {
          type: EnvelopeType.TEMPLATE,
          envelopeItems: [
            {
              documentDataId: templateDocumentData.id,
            },
          ],
          templateType: type,
          title,
          folderId,
          externalId: externalId ?? undefined,
          visibility,
          globalAccessAuth,
          globalActionAuth,
          publicTitle,
          publicDescription,
        },
        meta,
        attachments,
        requestMetadata: metadata,
      });

      const fullTemplate = await getTemplateById({
        id: {
          type: 'envelopeId',
          id: createdTemplate.id,
        },
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
        id: {
          type: 'templateId',
          id: Number(templateId),
        },
        userId: user.id,
        teamId: team.id,
      });

      const legacyTemplateId = mapSecondaryIdToTemplateId(deletedTemplate.secondaryId);

      return {
        status: 200,
        body: {
          id: legacyTemplateId,
          externalId: deletedTemplate.externalId,
          type: deletedTemplate.templateType,
          title: deletedTemplate.title,
          userId: deletedTemplate.userId,
          teamId: deletedTemplate.teamId,
          createdAt: deletedTemplate.createdAt,
          updatedAt: deletedTemplate.updatedAt,
        },
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
        id: {
          type: 'templateId',
          id: Number(templateId),
        },
        userId: user.id,
        teamId: team.id,
      });

      return {
        status: 200,
        body: {
          ...template,
          templateMeta: template.templateMeta
            ? {
                ...template.templateMeta,
                templateId: template.id,
              }
            : null,
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
        teamId: team.id,
      });

      return {
        status: 200,
        body: {
          templates: templates.map((template) => ({
            id: mapSecondaryIdToTemplateId(template.secondaryId),
            externalId: template.externalId,
            type: template.templateType,
            title: template.title,
            userId: template.userId,
            teamId: template.teamId,
            createdAt: template.createdAt,
            updatedAt: template.updatedAt,
            directLink: template.directLink,
            Field: template.fields.map((field) => ({
              ...field,
              templateId: mapSecondaryIdToTemplateId(template.secondaryId),
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

      const { remaining } = await getServerLimits({ userId: user.id, teamId: team.id });

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

      const template = await getEnvelopeById({
        id: {
          type: 'templateId',
          id: templateId,
        },
        type: EnvelopeType.TEMPLATE,
        userId: user.id,
        teamId: team.id,
      });

      if (template.envelopeItems.length !== 1) {
        throw new Error('API V1 does not support templates with multiple documents');
      }

      // V1 API request schema uses indices for recipients
      // So we remap the recipients to attach the IDs
      const mappedRecipients = body.recipients.map((recipient, index) => {
        const existingRecipient = template.recipients.at(index);

        if (!existingRecipient) {
          throw new Error('Recipient not found.');
        }

        return {
          id: existingRecipient.id,
          name: recipient.name,
          email: recipient.email,
          signingOrder: recipient.signingOrder,
          role: recipient.role, // You probably shouldn't be able to change the role.
        };
      });

      const createdEnvelope = await createDocumentFromTemplate({
        id: {
          type: 'templateId',
          id: templateId,
        },
        externalId: body.externalId || null,
        userId: user.id,
        teamId: team.id,
        recipients: mappedRecipients,
        override: {
          ...body.meta,
          title: body.title,
        },
        attachments: body.attachments,
        requestMetadata: metadata,
      });

      const envelopeItems = await prisma.envelopeItem.findMany({
        where: {
          envelopeId: createdEnvelope.id,
        },
        include: {
          documentData: true,
        },
      });

      const firstEnvelopeItemData = envelopeItems[0].documentData;

      if (!firstEnvelopeItemData) {
        throw new Error('Document data not found.');
      }

      if (body.formValues) {
        const pdf = await getFileServerSide(firstEnvelopeItemData);

        const prefilled = await insertFormValuesInPdf({
          pdf: Buffer.from(pdf),
          formValues: body.formValues,
        });

        const newDocumentData = await putPdfFileServerSide({
          name: fileName,
          type: 'application/pdf',
          arrayBuffer: async () => Promise.resolve(prefilled),
        });

        await prisma.envelopeItem.update({
          where: {
            id: firstEnvelopeItemData.id,
          },
          data: {
            title: body.title || fileName,
            documentDataId: newDocumentData.id,
          },
        });
      }

      if (body.authOptions || body.formValues) {
        await prisma.envelope.update({
          where: {
            id: createdEnvelope.id,
          },
          data: {
            formValues: body.formValues,
            authOptions: body.authOptions,
          },
        });
      }

      return {
        status: 200,
        body: {
          documentId: mapSecondaryIdToDocumentId(createdEnvelope.secondaryId),
          recipients: createdEnvelope.recipients.map((recipient) => ({
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

      const { remaining } = await getServerLimits({ userId: user.id, teamId: team.id });

      if (remaining.documents <= 0) {
        return {
          status: 400,
          body: {
            message: 'You have reached the maximum number of documents allowed for this month',
          },
        };
      }

      const templateId = Number(params.templateId);

      let envelope: Awaited<ReturnType<typeof createDocumentFromTemplate>> | null = null;

      try {
        envelope = await createDocumentFromTemplate({
          id: {
            type: 'templateId',
            id: templateId,
          },
          externalId: body.externalId || null,
          userId: user.id,
          teamId: team.id,
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

      if (envelope.envelopeItems.length !== 1) {
        throw new Error('API V1 does not support envelopes');
      }

      const firstEnvelopeDocumentData = await prisma.envelopeItem.findFirstOrThrow({
        where: {
          envelopeId: envelope.id,
        },
        include: {
          documentData: true,
        },
      });

      if (body.formValues) {
        const fileName = envelope.title.endsWith('.pdf') ? envelope.title : `${envelope.title}.pdf`;

        const pdf = await getFileServerSide(firstEnvelopeDocumentData.documentData);

        const prefilled = await insertFormValuesInPdf({
          pdf: Buffer.from(pdf),
          formValues: body.formValues,
        });

        const newDocumentData = await putPdfFileServerSide({
          name: fileName,
          type: 'application/pdf',
          arrayBuffer: async () => Promise.resolve(prefilled),
        });

        await prisma.envelope.update({
          where: {
            id: envelope.id,
          },
          data: {
            formValues: body.formValues,
            envelopeItems: {
              update: {
                where: {
                  id: firstEnvelopeDocumentData.id,
                },
                data: {
                  documentDataId: newDocumentData.id,
                },
              },
            },
          },
        });
      }

      if (body.authOptions) {
        await prisma.envelope.update({
          where: {
            id: envelope.id,
          },
          data: {
            authOptions: body.authOptions,
          },
        });
      }

      const legacyDocumentId = mapSecondaryIdToDocumentId(envelope.secondaryId);

      return {
        status: 200,
        body: {
          documentId: legacyDocumentId,
          recipients: envelope.recipients.map((recipient) => ({
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
      const legacyDocumentId = Number(documentId);

      const envelope = await getEnvelopeById({
        id: {
          type: 'documentId',
          id: legacyDocumentId,
        },
        type: EnvelopeType.DOCUMENT,
        userId: user.id,
        teamId: team.id,
      });

      if (!envelope) {
        return {
          status: 404,
          body: {
            message: 'Document not found',
          },
        };
      }

      if (isDocumentCompleted(envelope.status)) {
        return {
          status: 400,
          body: {
            message: 'Document is already complete',
          },
        };
      }

      const emailSettings = extractDerivedDocumentEmailSettings(envelope.documentMeta);

      // Update document email settings if sendCompletionEmails is provided
      if (typeof sendCompletionEmails === 'boolean') {
        await updateDocumentMeta({
          id: {
            type: 'envelopeId',
            id: envelope.id,
          },
          userId: user.id,
          teamId: team.id,
          emailSettings: {
            ...emailSettings,
            documentCompleted: sendCompletionEmails,
            ownerDocumentCompleted: sendCompletionEmails,
          },
          requestMetadata: metadata,
        });
      }

      const { recipients, ...sentDocument } = await sendDocument({
        id: {
          type: 'envelopeId',
          id: envelope.id,
        },
        userId: user.id,
        teamId: team.id,
        sendEmail,
        requestMetadata: metadata,
      });

      return {
        status: 200,
        body: {
          message: 'Document sent for signing successfully',
          id: mapSecondaryIdToDocumentId(sentDocument.secondaryId),
          externalId: sentDocument.externalId,
          userId: sentDocument.userId,
          teamId: sentDocument.teamId,
          title: sentDocument.title,
          status: sentDocument.status,
          createdAt: sentDocument.createdAt,
          updatedAt: sentDocument.updatedAt,
          completedAt: sentDocument.completedAt,
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
        id: {
          type: 'documentId',
          id: Number(documentId),
        },
        recipients,
        teamId: team.id,
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

    const legacyDocumentId = Number(documentId);

    const envelope = await getEnvelopeById({
      id: {
        type: 'documentId',
        id: legacyDocumentId,
      },
      type: EnvelopeType.DOCUMENT,
      userId: user.id,
      teamId: team.id,
    });

    if (!envelope) {
      return {
        status: 404,
        body: {
          message: 'Document not found',
        },
      };
    }

    if (isDocumentCompleted(envelope.status)) {
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
      teamId: team.id,
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
        id: {
          type: 'documentId',
          id: Number(documentId),
        },
        userId: user.id,
        teamId: team.id,
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

    const legacyDocumentId = Number(documentId);

    const envelope = await getEnvelopeById({
      id: {
        type: 'documentId',
        id: legacyDocumentId,
      },
      type: EnvelopeType.DOCUMENT,
      userId: user.id,
      teamId: team.id,
    });

    if (!envelope) {
      return {
        status: 404,
        body: {
          message: 'Document not found',
        },
      };
    }

    if (isDocumentCompleted(envelope.status)) {
      return {
        status: 400,
        body: {
          message: 'Document is already completed',
        },
      };
    }

    const updatedRecipient = await updateEnvelopeRecipients({
      userId: user.id,
      teamId: team.id,
      id: {
        type: 'envelopeId',
        id: envelope.id,
      },
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

    const deletedRecipient = await deleteEnvelopeRecipient({
      userId: user.id,
      teamId: team.id,
      recipientId: Number(recipientId),
      requestMetadata: {
        requestMetadata: metadata.requestMetadata,
        source: 'apiV1',
        auth: 'api',
        auditUser: {
          id: team.id,
          email: team.name,
          name: team.name,
        },
      },
    });

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

    const { envelopeWhereInput } = await getEnvelopeWhereInput({
      id: {
        type: 'documentId',
        id: Number(documentId),
      },
      type: EnvelopeType.DOCUMENT,
      teamId: team.id,
      userId: user.id,
    });

    const envelope = await prisma.envelope.findFirst({
      where: envelopeWhereInput,
      select: {
        id: true,
        secondaryId: true,
        status: true,
        envelopeItems: {
          select: { id: true },
        },
      },
    });

    if (!envelope) {
      return {
        status: 404,
        body: { message: 'Document not found' },
      };
    }

    const firstEnvelopeItemId = envelope.envelopeItems[0].id;

    if (!firstEnvelopeItemId) {
      throw new Error('Missing envelope item ID');
    }

    if (envelope.envelopeItems.length !== 1) {
      throw new Error('API V1 does not support multiple documents');
    }

    if (isDocumentCompleted(envelope.status)) {
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

            const recipient = await prisma.recipient.findFirst({
              where: {
                id: Number(recipientId),
                envelopeId: envelope.id,
              },
            });

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
                envelopeId: envelope.id,
                envelopeItemId: firstEnvelopeItemId,
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
                envelopeId: envelope.id,
                user: {
                  id: team.id ?? user.id,
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
              documentId: mapSecondaryIdToDocumentId(envelope.secondaryId),
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

    const envelope = await getEnvelopeById({
      id: {
        type: 'documentId',
        id: Number(documentId),
      },
      type: EnvelopeType.DOCUMENT,
      userId: user.id,
      teamId: team.id,
    });

    if (!envelope) {
      return {
        status: 404,
        body: {
          message: 'Document not found',
        },
      };
    }

    const legacyDocumentId = mapSecondaryIdToDocumentId(envelope.secondaryId);

    const firstEnvelopeItemId = envelope.envelopeItems[0].id;

    if (!firstEnvelopeItemId) {
      throw new Error('Missing document data');
    }

    if (envelope.envelopeItems.length > 1) {
      throw new Error('API V1 does not support multiple documents');
    }

    if (isDocumentCompleted(envelope.status)) {
      return {
        status: 400,
        body: {
          message: 'Document is already completed',
        },
      };
    }

    const recipient = await prisma.recipient.findFirst({
      where: {
        id: Number(recipientId),
        envelopeId: envelope.id,
      },
    });

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

    const { fields } = await updateEnvelopeFields({
      userId: user.id,
      teamId: team.id,
      id: {
        type: 'documentId',
        id: legacyDocumentId,
      },
      fields: [
        {
          id: Number(fieldId),
          type,
          pageNumber,
          pageX,
          pageY,
          width: pageWidth,
          height: pageHeight,
          fieldMeta: fieldMeta ? ZFieldMetaSchema.parse(fieldMeta) : undefined,
        },
      ],
      requestMetadata: {
        requestMetadata: metadata.requestMetadata,
        source: 'apiV1',
        auth: 'api',
        auditUser: {
          id: team.id,
          email: team.name,
          name: team.name,
        },
      },
    });

    const updatedField = fields[0];

    return {
      status: 200,
      body: {
        id: updatedField.id,
        documentId: legacyDocumentId,
        recipientId: updatedField.recipientId ?? -1,
        type: updatedField.type,
        pageNumber: updatedField.page,
        pageX: Number(updatedField.positionX),
        pageY: Number(updatedField.positionY),
        pageWidth: Number(updatedField.width),
        pageHeight: Number(updatedField.height),
        customText: updatedField.customText,
        inserted: updatedField.inserted,
      },
    };
  }),

  deleteField: authenticatedMiddleware(async (args, user, team, { logger, metadata }) => {
    // Note: documentId isn't actually used anywhere, so we just return it.
    const { id: unverifiedDocumentId, fieldId } = args.params;

    logger.info({
      input: {
        id: unverifiedDocumentId,
        fieldId,
      },
    });

    const deletedField = await deleteDocumentField({
      fieldId: Number(fieldId),
      userId: user.id,
      teamId: team.id,
      requestMetadata: {
        requestMetadata: metadata.requestMetadata,
        source: 'apiV1',
        auth: 'api',
        auditUser: {
          id: team.id,
          email: team.name,
          name: team.name,
        },
      },
    });

    const remappedField = {
      id: deletedField.id,
      documentId: Number(unverifiedDocumentId),
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
      body: remappedField,
    };
  }),
});
