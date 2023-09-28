'use server';

import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-session';
import { setFieldsForDocument } from '@documenso/lib/server-only/field/set-fields-for-document';
import { TAddFieldsFormSchema } from '@documenso/ui/primitives/document-flow/add-fields.types';

export type AddFieldsActionInput = TAddFieldsFormSchema & {
  documentId: number;
};

export const addFields = async ({ documentId, fields }: AddFieldsActionInput) => {
  'use server';

  const { user } = await getRequiredServerComponentSession();

  await setFieldsForDocument({
    userId: user.id,
    documentId,
    fields: fields.map((field) => ({
      id: field.nativeId,
      signerEmail: field.signerEmail,
      type: field.type,
      pageNumber: field.pageNumber,
      pageX: field.pageX,
      pageY: field.pageY,
      pageWidth: field.pageWidth,
      pageHeight: field.pageHeight,
    })),
  });
};
