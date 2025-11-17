import { EnvelopeType } from '@prisma/client';

import { getServerLimits } from '@documenso/ee/server-only/limits/server';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { sendDocument } from '@documenso/lib/server-only/document/send-document';
import { getEnvelopeById } from '@documenso/lib/server-only/envelope/get-envelope-by-id';
import { createDocumentFromTemplate } from '@documenso/lib/server-only/template/create-document-from-template';
import { putNormalizedPdfFileServerSide } from '@documenso/lib/universal/upload/put-file.server';
import { formatSigningLink } from '@documenso/lib/utils/recipients';

import { authenticatedProcedure } from '../trpc';
import {
  ZUseEnvelopeRequestSchema,
  ZUseEnvelopeResponseSchema,
  useEnvelopeMeta,
} from './use-envelope.types';

export const useEnvelopeRoute = authenticatedProcedure
  .meta(useEnvelopeMeta)
  .input(ZUseEnvelopeRequestSchema)
  .output(ZUseEnvelopeResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { user, teamId } = ctx;

    const { payload, files = [] } = input;

    const {
      envelopeId,
      externalId,
      recipients = [],
      distributeDocument,
      customDocumentData = [],
      folderId,
      prefillFields,
      override,
      attachments,
    } = payload;

    ctx.logger.info({
      input: {
        envelopeId,
        folderId,
      },
    });

    const limits = await getServerLimits({ userId: user.id, teamId });

    if (limits.remaining.documents === 0) {
      throw new AppError(AppErrorCode.LIMIT_EXCEEDED, {
        message: 'You have reached your document limit.',
      });
    }

    // Verify the template exists and get envelope items
    const envelope = await getEnvelopeById({
      id: {
        type: 'envelopeId',
        id: envelopeId,
      },
      type: EnvelopeType.TEMPLATE,
      userId: user.id,
      teamId,
    });

    if (files.length > envelope.envelopeItems.length) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: `You cannot upload more than ${envelope.envelopeItems.length} envelope items per envelope`,
      });
    }

    const filesToUpload = files.filter(
      (file, index) =>
        payload.customDocumentData &&
        payload.customDocumentData.some(
          (mapping) => mapping.identifier === file.name || mapping.identifier === index,
        ),
    );

    // Process uploaded files and create document data for them
    const uploadedFiles = await Promise.all(
      filesToUpload.map(async (file) => {
        const { id: documentDataId } = await putNormalizedPdfFileServerSide(file);

        return {
          name: file.name,
          documentDataId,
        };
      }),
    );

    // Map custom document data using identifiers
    const customDocumentDataMapped = customDocumentData?.map((mapping) => {
      let documentDataId: string | undefined;

      // Find the uploaded file by identifier
      if (typeof mapping.identifier === 'string') {
        documentDataId = uploadedFiles.find(
          (file) => file.name === mapping.identifier,
        )?.documentDataId;
      }

      if (typeof mapping.identifier === 'number') {
        documentDataId = uploadedFiles.at(mapping.identifier)?.documentDataId;
      }

      if (mapping.identifier === undefined) {
        documentDataId = uploadedFiles.at(0)?.documentDataId;
      }

      if (!documentDataId) {
        throw new AppError(AppErrorCode.NOT_FOUND, {
          message: `File with identifier "${mapping.identifier}" not found in uploaded files`,
        });
      }

      // Verify that the envelopeItemId exists in the template
      const envelopeItem = envelope.envelopeItems.find(
        (item) => item.id === mapping.envelopeItemId,
      );

      if (!envelopeItem) {
        throw new AppError(AppErrorCode.NOT_FOUND, {
          message: `Envelope item with ID "${mapping.envelopeItemId}" not found in template`,
        });
      }

      return {
        documentDataId,
        envelopeItemId: mapping.envelopeItemId,
      };
    });

    // Create document from template
    const createdEnvelope = await createDocumentFromTemplate({
      id: {
        type: 'envelopeId',
        id: envelopeId,
      },
      externalId,
      teamId,
      userId: user.id,
      recipients,
      customDocumentData: customDocumentDataMapped,
      requestMetadata: ctx.metadata,
      folderId,
      prefillFields,
      override,
      attachments,
    });

    // Distribute document if requested
    if (distributeDocument) {
      await sendDocument({
        id: {
          type: 'envelopeId',
          id: createdEnvelope.id,
        },
        userId: user.id,
        teamId,
        requestMetadata: ctx.metadata,
      }).catch((err) => {
        console.error(err);

        throw new AppError('DOCUMENT_SEND_FAILED');
      });
    }

    return {
      id: createdEnvelope.id,
      recipients: createdEnvelope.recipients.map((recipient) => ({
        id: recipient.id,
        name: recipient.name,
        email: recipient.email,
        token: recipient.token,
        role: recipient.role,
        signingOrder: recipient.signingOrder,
        signingUrl: formatSigningLink(recipient.token),
      })),
    };
  });
