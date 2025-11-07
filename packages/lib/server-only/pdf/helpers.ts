import { FieldType } from '@prisma/client';
import { type Envelope, EnvelopeType, RecipientRole } from '@prisma/client';
import type { Recipient } from '@prisma/client';
import { match } from 'ts-pattern';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { createDocumentRecipients } from '@documenso/lib/server-only/recipient/create-document-recipients';
import { createTemplateRecipients } from '@documenso/lib/server-only/recipient/create-template-recipients';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { mapSecondaryIdToTemplateId } from '@documenso/lib/utils/envelope';
import type { EnvelopeIdOptions } from '@documenso/lib/utils/envelope';
import { prisma } from '@documenso/prisma';

type RecipientPlaceholderInfo = {
  email: string;
  name: string;
  recipientIndex: number;
};

/*
  Parse field type string to FieldType enum.
  Normalizes the input (uppercase, trim) and validates it's a valid field type.
  This ensures we handle case variations and whitespace, and provides clear error messages.
*/
export const parseFieldTypeFromPlaceholder = (fieldTypeString: string): FieldType => {
  const normalizedType = fieldTypeString.toUpperCase().trim();

  return match(normalizedType)
    .with('SIGNATURE', () => FieldType.SIGNATURE)
    .with('FREE_SIGNATURE', () => FieldType.FREE_SIGNATURE)
    .with('INITIALS', () => FieldType.INITIALS)
    .with('NAME', () => FieldType.NAME)
    .with('EMAIL', () => FieldType.EMAIL)
    .with('DATE', () => FieldType.DATE)
    .with('TEXT', () => FieldType.TEXT)
    .with('NUMBER', () => FieldType.NUMBER)
    .with('RADIO', () => FieldType.RADIO)
    .with('CHECKBOX', () => FieldType.CHECKBOX)
    .with('DROPDOWN', () => FieldType.DROPDOWN)
    .otherwise(() => {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: `Invalid field type: ${fieldTypeString}`,
      });
    });
};

/*
  Transform raw field metadata from placeholder format to schema format.
  Users should provide properly capitalized property names (e.g., readOnly, fontSize, textAlign).
  Converts string values to proper types (booleans, numbers).
*/
export const parseFieldMetaFromPlaceholder = (
  rawFieldMeta: Record<string, string>,
  fieldType: FieldType,
): Record<string, unknown> | undefined => {
  if (fieldType === FieldType.SIGNATURE || fieldType === FieldType.FREE_SIGNATURE) {
    return;
  }

  if (Object.keys(rawFieldMeta).length === 0) {
    return;
  }

  const fieldTypeString = String(fieldType).toLowerCase();

  const parsedFieldMeta: Record<string, boolean | number | string> = {
    type: fieldTypeString,
  };

  /*
    rawFieldMeta is an object with string keys and string values.
    It contains string values because the PDF parser returns the values as strings.

    E.g. { 'required': 'true', 'fontSize': '12', 'maxValue': '100', 'minValue': '0', 'characterLimit': '100' }
  */
  const rawFieldMetaEntries = Object.entries(rawFieldMeta);

  for (const [property, value] of rawFieldMetaEntries) {
    if (property === 'readOnly' || property === 'required') {
      parsedFieldMeta[property] = value === 'true';
    } else if (
      property === 'fontSize' ||
      property === 'maxValue' ||
      property === 'minValue' ||
      property === 'characterLimit'
    ) {
      const numValue = Number(value);

      if (!Number.isNaN(numValue)) {
        parsedFieldMeta[property] = numValue;
      }
    } else {
      parsedFieldMeta[property] = value;
    }
  }

  return parsedFieldMeta;
};

export const extractRecipientPlaceholder = (placeholder: string): RecipientPlaceholderInfo => {
  const indexMatch = placeholder.match(/^r(\d+)$/i);

  if (!indexMatch) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: `Invalid recipient placeholder format: ${placeholder}. Expected format: r1, r2, r3, etc.`,
    });
  }

  const recipientIndex = Number(indexMatch[1]);

  return {
    email: `recipient.${recipientIndex}@documenso.com`,
    name: `Recipient ${recipientIndex}`,
    recipientIndex,
  };
};

/*
  Finds a recipient based on a placeholder reference.
  If recipients array is provided, uses index-based matching (r1 -> recipients[0], etc.).
  Otherwise, uses email-based matching from createdRecipients.
*/
export const findRecipientByPlaceholder = (
  recipientPlaceholder: string,
  placeholder: string,
  recipients: Pick<Recipient, 'id' | 'email'>[] | undefined,
  createdRecipients: Pick<Recipient, 'id' | 'email'>[],
): Pick<Recipient, 'id' | 'email'> => {
  if (recipients && recipients.length > 0) {
    /*
      Map placeholder by index: r1 -> recipients[0], r2 -> recipients[1], etc.
      recipientIndex is 1-based, so we subtract 1 to get the array index.
    */
    const { recipientIndex } = extractRecipientPlaceholder(recipientPlaceholder);
    const recipientArrayIndex = recipientIndex - 1;

    if (recipientArrayIndex < 0 || recipientArrayIndex >= recipients.length) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: `Recipient placeholder ${recipientPlaceholder} (index ${recipientIndex}) is out of range. Provided ${recipients.length} recipient(s).`,
      });
    }

    return recipients[recipientArrayIndex];
  }

  /*
    Use email-based matching for placeholder recipients.
  */
  const { email } = extractRecipientPlaceholder(recipientPlaceholder);
  const recipient = createdRecipients.find((r) => r.email === email);

  if (!recipient) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: `Could not find recipient ID for placeholder: ${placeholder}`,
    });
  }

  return recipient;
};

/*
  Determines the recipients to use for field creation.
  If recipients are provided, uses them directly.
  Otherwise, creates recipients from placeholders.
*/
export const determineRecipientsForPlaceholders = async (
  recipients: Pick<Recipient, 'id' | 'email'>[] | undefined,
  recipientPlaceholders: Map<number, string>,
  envelope: Pick<Envelope, 'id' | 'type' | 'secondaryId'>,
  userId: number,
  teamId: number,
  requestMetadata: ApiRequestMetadata,
): Promise<Pick<Recipient, 'id' | 'email'>[]> => {
  if (recipients && recipients.length > 0) {
    return recipients;
  }

  return createRecipientsFromPlaceholders(
    recipientPlaceholders,
    envelope,
    userId,
    teamId,
    requestMetadata,
  );
};

export const createRecipientsFromPlaceholders = async (
  recipientPlaceholders: Map<number, string>,
  envelope: Pick<Envelope, 'id' | 'type' | 'secondaryId'>,
  userId: number,
  teamId: number,
  requestMetadata: ApiRequestMetadata,
): Promise<Pick<Recipient, 'id' | 'email'>[]> => {
  const recipientsToCreate = Array.from(
    recipientPlaceholders.entries(),
    ([recipientIndex, name]) => {
      return {
        email: `recipient.${recipientIndex}@documenso.com`,
        name,
        role: RecipientRole.SIGNER,
        signingOrder: recipientIndex,
      };
    },
  );

  const existingRecipients = await prisma.recipient.findMany({
    where: {
      envelopeId: envelope.id,
    },
    select: {
      id: true,
      email: true,
    },
  });

  const existingEmails = new Set(existingRecipients.map((r) => r.email));
  const recipientsToCreateFiltered = recipientsToCreate.filter(
    (recipient) => !existingEmails.has(recipient.email),
  );

  if (recipientsToCreateFiltered.length === 0) {
    return existingRecipients;
  }

  const newRecipients = await match(envelope.type)
    .with(EnvelopeType.DOCUMENT, async () => {
      const envelopeId: EnvelopeIdOptions = {
        type: 'envelopeId',
        id: envelope.id,
      };

      const { recipients } = await createDocumentRecipients({
        userId,
        teamId,
        id: envelopeId,
        recipients: recipientsToCreateFiltered,
        requestMetadata,
      });

      return recipients;
    })
    .with(EnvelopeType.TEMPLATE, async () => {
      const templateId = mapSecondaryIdToTemplateId(envelope.secondaryId ?? '');

      const { recipients } = await createTemplateRecipients({
        userId,
        teamId,
        templateId,
        recipients: recipientsToCreateFiltered,
      });

      return recipients;
    })
    .otherwise(() => {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: `Invalid envelope type: ${envelope.type}`,
      });
    });

  return [...existingRecipients, ...newRecipients];
};
