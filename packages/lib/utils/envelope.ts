import type { Envelope, Recipient } from '@prisma/client';
import {
  DocumentStatus,
  EnvelopeType,
  RecipientRole,
  SendStatus,
  SigningStatus,
} from '@prisma/client';
import { match } from 'ts-pattern';
import { z } from 'zod';

import { AppError, AppErrorCode } from '../errors/app-error';

const envelopeDocumentPrefixId = 'document';
const envelopeTemplatePrefixId = 'template';

const ZDocumentIdSchema = z.string().regex(/^document_\d+$/);
const ZTemplateIdSchema = z.string().regex(/^template_\d+$/);
const ZEnvelopeIdSchema = z.string().regex(/^envelope_.{2,}$/);

export type EnvelopeIdOptions =
  | {
      type: 'envelopeId';
      id: string;
    }
  | {
      type: 'documentId';
      id: number;
    }
  | {
      type: 'templateId';
      id: number;
    };

/**
 * Parses an unknown document or template ID.
 *
 * This is UNSAFE because does not validate access, it just builds the query for ID and TYPE.
 */
export const unsafeBuildEnvelopeIdQuery = (
  options: EnvelopeIdOptions,
  expectedEnvelopeType: EnvelopeType | null,
) => {
  return match(options)
    .with({ type: 'envelopeId' }, (value) => {
      const parsed = ZEnvelopeIdSchema.safeParse(value.id);

      if (!parsed.success) {
        throw new AppError(AppErrorCode.INVALID_BODY, {
          message: 'Invalid envelope ID',
        });
      }

      if (expectedEnvelopeType) {
        return {
          id: value.id,
          type: expectedEnvelopeType,
        };
      }

      return {
        id: value.id,
      };
    })
    .with({ type: 'documentId' }, (value) => {
      if (expectedEnvelopeType && expectedEnvelopeType !== EnvelopeType.DOCUMENT) {
        throw new AppError(AppErrorCode.INVALID_BODY, {
          message: 'Invalid document ID',
        });
      }

      return {
        type: EnvelopeType.DOCUMENT,
        secondaryId: mapDocumentIdToSecondaryId(value.id),
      };
    })
    .with({ type: 'templateId' }, (value) => {
      if (expectedEnvelopeType && expectedEnvelopeType !== EnvelopeType.TEMPLATE) {
        throw new AppError(AppErrorCode.INVALID_BODY, {
          message: 'Invalid template ID',
        });
      }

      return {
        type: EnvelopeType.TEMPLATE,
        secondaryId: mapTemplateIdToSecondaryId(value.id),
      };
    })
    .exhaustive();
};

/**
 * Maps a legacy document ID number to an envelope secondary ID.
 *
 * @returns The formatted envelope secondary ID (document_123)
 */
export const mapDocumentIdToSecondaryId = (documentId: number) => {
  return `${envelopeDocumentPrefixId}_${documentId}`;
};

/**
 * Maps a legacy template ID number to an envelope secondary ID.
 *
 * @returns The formatted envelope secondary ID (template_123)
 */
export const mapTemplateIdToSecondaryId = (templateId: number) => {
  return `${envelopeTemplatePrefixId}_${templateId}`;
};

/**
 * Maps an envelope secondary ID to a legacy document ID number.
 *
 * Throws an error if the secondary ID is not a document ID.
 *
 * @param secondaryId The envelope secondary ID (document_123)
 * @returns The legacy document ID number (123)
 */
export const mapSecondaryIdToDocumentId = (secondaryId: string) => {
  const parsed = ZDocumentIdSchema.safeParse(secondaryId);

  if (!parsed.success) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: 'Invalid document ID',
    });
  }

  return parseInt(parsed.data.split('_')[1]);
};

/**
 * Maps an envelope secondary ID to a legacy template ID number.
 *
 * Throws an error if the secondary ID is not a template ID.
 *
 * @param secondaryId The envelope secondary ID (template_123)
 * @returns The legacy template ID number (123)
 */
export const mapSecondaryIdToTemplateId = (secondaryId: string) => {
  const parsed = ZTemplateIdSchema.safeParse(secondaryId);

  if (!parsed.success) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: 'Invalid template ID',
    });
  }

  return parseInt(parsed.data.split('_')[1]);
};

export const canEnvelopeItemsBeModified = (
  envelope: Pick<Envelope, 'completedAt' | 'deletedAt' | 'type' | 'status'>,
  recipients: Recipient[],
) => {
  if (envelope.completedAt || envelope.deletedAt || envelope.status !== DocumentStatus.DRAFT) {
    return false;
  }

  if (envelope.type === EnvelopeType.TEMPLATE) {
    return true;
  }

  if (
    recipients.some(
      (recipient) =>
        recipient.role !== RecipientRole.CC &&
        (recipient.signingStatus === SigningStatus.SIGNED ||
          recipient.sendStatus === SendStatus.SENT),
    )
  ) {
    return false;
  }

  return true;
};
