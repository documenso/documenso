import type { FieldType } from '@prisma/client';
import { match } from 'ts-pattern';

import { prisma } from '@documenso/prisma';

import {
  ZCheckboxFieldMeta,
  ZDropdownFieldMeta,
  ZNumberFieldMeta,
  ZRadioFieldMeta,
  ZTextFieldMeta,
} from '../../types/field-meta';
import type { TFieldMetaSchema as FieldMeta } from '../../types/field-meta';
import type { RequestMetadata } from '../../universal/extract-request-metadata';
import { createDocumentAuditLogData } from '../../utils/document-audit-logs';
import { getDocumentWhereInput } from '../document/get-document-by-id';

export type CreateFieldOptions = {
  documentId: number;
  userId: number;
  teamId: number;
  recipientId: number;
  type: FieldType;
  pageNumber: number;
  pageX: number;
  pageY: number;
  pageWidth: number;
  pageHeight: number;
  fieldMeta?: FieldMeta;
  requestMetadata?: RequestMetadata;
};

export const createField = async ({
  documentId,
  userId,
  teamId,
  recipientId,
  type,
  pageNumber,
  pageX,
  pageY,
  pageWidth,
  pageHeight,
  fieldMeta,
  requestMetadata,
}: CreateFieldOptions) => {
  const { documentWhereInput, team } = await getDocumentWhereInput({
    documentId,
    userId,
    teamId,
  });

  const document = await prisma.document.findFirst({
    where: documentWhereInput,
    select: {
      id: true,
    },
  });

  if (!document) {
    throw new Error('Document not found');
  }

  const advancedField = ['NUMBER', 'RADIO', 'CHECKBOX', 'DROPDOWN', 'TEXT'].includes(type);

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
      data: {},
    }))
    .with('FREE_SIGNATURE', () => ({
      success: false,
      error: 'FREE_SIGNATURE is not supported',
      data: {},
    }))
    .exhaustive();

  if (!result.success) {
    throw new Error('Field meta parsing failed');
  }

  const field = await prisma.field.create({
    data: {
      documentId,
      recipientId,
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

  await prisma.documentAuditLog.create({
    data: createDocumentAuditLogData({
      type: 'FIELD_CREATED',
      documentId,
      user: {
        id: team.id,
        email: team.name,
        name: '',
      },
      data: {
        fieldId: field.secondaryId,
        fieldRecipientEmail: field.recipient?.email ?? '',
        fieldRecipientId: recipientId,
        fieldType: field.type,
      },
      requestMetadata,
    }),
  });

  return field;
};
