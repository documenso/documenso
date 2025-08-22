import { EnvelopeType } from '@prisma/client';
import { match } from 'ts-pattern';
import { z } from 'zod';

import { AppError, AppErrorCode } from '../errors/app-error';

const envelopeDocumentPrefixId = 'document';
const envelopeTemplatePrefixId = 'template';
const envelopePrefixId = 'envelope';

const ZDocumentIdSchema = z.string().regex(/^document_\d+$/);
const ZTemplateIdSchema = z.string().regex(/^template_\d+$/);
const ZEnvelopeIdSchema = z.string().regex(/^envelope_\d+$/);

export type EnvelopeIdOptions =
  | {
      type: 'envelopeId';
      id: string;
    }
  | {
      type: 'documentId';
      id: string | number;
    }
  | {
      type: 'templateId';
      id: string | number;
    };

/**
 * Parses an unknown document or template ID.
 *
 * @param id
 * @param type
 * @returns
 */
export const buildEnvelopeIdQuery = (options: EnvelopeIdOptions) => {
  return match(options)
    .with({ type: 'envelopeId' }, (value) => {
      const parsed = ZEnvelopeIdSchema.safeParse(value.id);

      if (!parsed.success) {
        throw new AppError(AppErrorCode.INVALID_BODY, {
          message: 'Invalid envelope ID',
        });
      }

      return {
        id: value.id,
      };
    })
    .with({ type: 'documentId' }, (value) => ({
      type: EnvelopeType.DOCUMENT,
      secondaryId: parseDocumentIdToEnvelopeSecondaryId(value.id),
    }))
    .with({ type: 'templateId' }, (value) => ({
      type: EnvelopeType.TEMPLATE,
      secondaryId: parseTemplateIdToEnvelopeSecondaryId(value.id),
    }))
    .exhaustive();
};

export const parseDocumentIdToEnvelopeSecondaryId = (documentId: string | number) => {
  if (typeof documentId === 'number') {
    return `${envelopeDocumentPrefixId}_${documentId}`;
  }

  const parsed = ZDocumentIdSchema.safeParse(documentId);

  if (!parsed.success) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: 'Invalid document ID',
    });
  }

  return parsed.data;
};

export const parseTemplateIdToEnvelopeSecondaryId = (templateId: string | number) => {
  if (typeof templateId === 'number') {
    return `${envelopeTemplatePrefixId}_${templateId}`;
  }

  const parsed = ZTemplateIdSchema.safeParse(templateId);

  if (!parsed.success) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: 'Invalid template ID',
    });
  }

  return parsed.data;
};
