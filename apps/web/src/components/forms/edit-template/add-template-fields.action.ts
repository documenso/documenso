'use server';

import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-session';
import { setFieldsForTemplate } from '@documenso/lib/server-only/field/set-fields-for-template';
import { TAddTemplateFieldsFormSchema } from '@documenso/ui/primitives/template-flow/add-template-fields.types';

export type AddTemplateFieldsActionInput = TAddTemplateFieldsFormSchema & {
  templateId: number;
};

export const addTemplateFields = async ({ templateId, fields }: AddTemplateFieldsActionInput) => {
  'use server';

  const { user } = await getRequiredServerComponentSession();

  await setFieldsForTemplate({
    userId: user.id,
    templateId,
    fields: fields.map((field) => ({
      id: field.nativeId,
      signerEmail: field.signerEmail,
      signerId: field.signerId,
      signerToken: field.signerToken,
      type: field.type,
      pageNumber: field.pageNumber,
      pageX: field.pageX,
      pageY: field.pageY,
      pageWidth: field.pageWidth,
      pageHeight: field.pageHeight,
    })),
  });
};
