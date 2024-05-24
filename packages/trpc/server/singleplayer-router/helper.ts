import { DateTime } from 'luxon';
import { match } from 'ts-pattern';

import { FieldType, Prisma } from '@documenso/prisma/client';

import type { TCreateSinglePlayerDocumentMutationSchema } from './schema';

/**
 * Map the fields provided by the user to fields compatible with Prisma.
 *
 * Signature fields are handled separately.
 *
 * @param field The field passed in by the user.
 * @param signer The details of the person who is signing this document.
 * @returns A field compatible with Prisma.
 */
export const mapField = (
  field: TCreateSinglePlayerDocumentMutationSchema['fields'][number],
  signer: TCreateSinglePlayerDocumentMutationSchema['signer'],
) => {
  const customText = match(field.type)
    .with(FieldType.DATE, () => DateTime.now().toFormat('yyyy-MM-dd hh:mm a'))
    .with(FieldType.EMAIL, () => signer.email)
    .with(FieldType.NAME, () => signer.name)
    .with(FieldType.TEXT, () => signer.customText)
    .otherwise(() => '');

  return {
    type: field.type,
    page: field.page,
    positionX: new Prisma.Decimal(field.positionX),
    positionY: new Prisma.Decimal(field.positionY),
    width: new Prisma.Decimal(field.width),
    height: new Prisma.Decimal(field.height),
    customText,
    inserted: true,
  };
};
