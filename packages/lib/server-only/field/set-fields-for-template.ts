import { prisma } from '@documenso/prisma';
import type { FieldType } from '@documenso/prisma/client';

export type SetFieldsForTemplateOptions = {
  userId: number;
  templateId: number;
  fields: {
    id?: number | null;
    type: FieldType;
    signerEmail: string;
    pageNumber: number;
    pageX: number;
    pageY: number;
    pageWidth: number;
    pageHeight: number;
  }[];
};

export const setFieldsForTemplate = async ({
  userId,
  templateId,
  fields,
}: SetFieldsForTemplateOptions) => {
  const template = await prisma.template.findFirst({
    where: {
      id: templateId,
      OR: [
        {
          userId,
        },
        {
          team: {
            members: {
              some: {
                userId,
              },
            },
          },
        },
      ],
    },
  });

  if (!template) {
    throw new Error('Template not found');
  }

  const existingFields = await prisma.field.findMany({
    where: {
      templateId,
    },
    include: {
      Recipient: true,
    },
  });

  const removedFields = existingFields.filter(
    (existingField) => !fields.find((field) => field.id === existingField.id),
  );

  const linkedFields = fields.map((field) => {
    const existing = existingFields.find((existingField) => existingField.id === field.id);

    return {
      ...field,
      _persisted: existing,
    };
  });

  const persistedFields = await prisma.$transaction(
    // Disabling as wrapping promises here causes type issues
    // eslint-disable-next-line @typescript-eslint/promise-function-async
    linkedFields.map((field) =>
      prisma.field.upsert({
        where: {
          id: field._persisted?.id ?? -1,
          templateId,
        },
        update: {
          page: field.pageNumber,
          positionX: field.pageX,
          positionY: field.pageY,
          width: field.pageWidth,
          height: field.pageHeight,
        },
        create: {
          type: field.type,
          page: field.pageNumber,
          positionX: field.pageX,
          positionY: field.pageY,
          width: field.pageWidth,
          height: field.pageHeight,
          customText: '',
          inserted: false,
          Template: {
            connect: {
              id: templateId,
            },
          },
          Recipient: {
            connect: {
              templateId_email: {
                templateId,
                email: field.signerEmail.toLowerCase(),
              },
            },
          },
        },
      }),
    ),
  );

  if (removedFields.length > 0) {
    await prisma.field.deleteMany({
      where: {
        id: {
          in: removedFields.map((field) => field.id),
        },
      },
    });
  }

  // Filter out fields that have been removed or have been updated.
  const filteredFields = existingFields.filter((field) => {
    const isRemoved = removedFields.find((removedField) => removedField.id === field.id);
    const isUpdated = persistedFields.find((persistedField) => persistedField.id === field.id);

    return !isRemoved && !isUpdated;
  });

  return [...filteredFields, ...persistedFields];
};
