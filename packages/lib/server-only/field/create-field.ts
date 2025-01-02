import type { FieldType, Team } from '@prisma/client';
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

export type CreateFieldOptions = {
  documentId: number;
  userId: number;
  teamId?: number;
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
  const document = await prisma.document.findFirst({
    select: {
      id: true,
    },
    where: {
      id: documentId,
      ...(teamId
        ? {
            team: {
              id: teamId,
              members: {
                some: {
                  userId,
                },
              },
            },
          }
        : {
            userId,
            teamId: null,
          }),
    },
  });

  if (!document) {
    throw new Error('Document not found');
  }

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

  let team: Team | null = null;

  if (teamId) {
    team = await prisma.team.findFirst({
      where: {
        id: teamId,
        members: {
          some: {
            userId,
          },
        },
      },
    });
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
      requestMetadata,
    }),
  });

  return field;
};
