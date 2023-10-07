'use server';

import { z } from 'zod';

import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-session';
import { prisma } from '@documenso/prisma';
import { DocumentDataType, FieldType } from '@documenso/prisma/client';

const ZCreateTemplateActionInput = z.object({
  templateData: z.object({
    data: z.string(),
    type: z.nativeEnum(DocumentDataType),
  }),
  documentName: z.string(),
  fields: z.array(
    z.object({
      page: z.number(),
      type: z.nativeEnum(FieldType),
      positionX: z.number(),
      positionY: z.number(),
      width: z.number(),
      height: z.number(),
    }),
  ),
  templateDetails: z.object({
    title: z.string(),
    description: z.string(),
  }),
});

export type TCreateTemplateActionInput = z.infer<typeof ZCreateTemplateActionInput>;

export const createTemplate = async (value: TCreateTemplateActionInput) => {
  'use server';

  const { documentName, fields, templateData, templateDetails } =
    ZCreateTemplateActionInput.parse(value);
  const { user } = await getRequiredServerComponentSession();

  const documentData = await prisma.documentData.create({
    data: {
      data: templateData.data,
      type: templateData.type,
      initialData: templateData.data,
    },
  });

  const template = await prisma.template.create({
    data: {
      title: templateDetails.title,
      description: templateDetails.description,
      userId: user.id,
      documentName: documentName,
      templateDataId: documentData.id,
      TemplateField: {
        create: fields.map((field) => ({
          page: field.page,
          type: field.type,
          positionX: field.positionX,
          positionY: field.positionY,
          width: field.width,
          height: field.height,
          customText: '',
        })),
      },
    },
  });

  console.log(template);
};
