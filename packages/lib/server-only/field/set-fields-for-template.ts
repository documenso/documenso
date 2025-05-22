import { FieldType } from '@prisma/client';

import { validateCheckboxField } from '@documenso/lib/advanced-fields-validation/validate-checkbox';
import { validateDropdownField } from '@documenso/lib/advanced-fields-validation/validate-dropdown';
import { validateNumberField } from '@documenso/lib/advanced-fields-validation/validate-number';
import { validateRadioField } from '@documenso/lib/advanced-fields-validation/validate-radio';
import { validateTextField } from '@documenso/lib/advanced-fields-validation/validate-text';
import {
  type TFieldMetaSchema as FieldMeta,
  ZCheckboxFieldMeta,
  ZDropdownFieldMeta,
  ZFieldMetaSchema,
  ZNumberFieldMeta,
  ZRadioFieldMeta,
  ZTextFieldMeta,
} from '@documenso/lib/types/field-meta';
import { prisma } from '@documenso/prisma';

import { buildTeamWhereQuery } from '../../utils/teams';

export type SetFieldsForTemplateOptions = {
  userId: number;
  teamId: number;
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
    fieldMeta?: FieldMeta;
  }[];
};

export const setFieldsForTemplate = async ({
  userId,
  teamId,
  templateId,
  fields,
}: SetFieldsForTemplateOptions) => {
  const template = await prisma.template.findFirst({
    where: {
      id: templateId,
      team: buildTeamWhereQuery(teamId, userId),
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
      recipient: true,
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
    linkedFields.map((field) => {
      const parsedFieldMeta = field.fieldMeta ? ZFieldMetaSchema.parse(field.fieldMeta) : undefined;

      if (field.type === FieldType.TEXT && field.fieldMeta) {
        const textFieldParsedMeta = ZTextFieldMeta.parse(field.fieldMeta);
        const errors = validateTextField(textFieldParsedMeta.text || '', textFieldParsedMeta);
        if (errors.length > 0) {
          throw new Error(errors.join(', '));
        }
      }

      if (field.type === FieldType.NUMBER && field.fieldMeta) {
        const numberFieldParsedMeta = ZNumberFieldMeta.parse(field.fieldMeta);
        const errors = validateNumberField(
          String(numberFieldParsedMeta.value),
          numberFieldParsedMeta,
        );
        if (errors.length > 0) {
          throw new Error(errors.join(', '));
        }
      }

      if (field.type === FieldType.CHECKBOX) {
        if (!field.fieldMeta) {
          throw new Error('Checkbox field is missing required metadata');
        }
        const checkboxFieldParsedMeta = ZCheckboxFieldMeta.parse(field.fieldMeta);
        const errors = validateCheckboxField(
          checkboxFieldParsedMeta?.values?.map((item) => item.value) ?? [],
          checkboxFieldParsedMeta,
        );
        if (errors.length > 0) {
          throw new Error(errors.join(', '));
        }
      }

      if (field.type === FieldType.RADIO) {
        if (!field.fieldMeta) {
          throw new Error('Radio field is missing required metadata');
        }
        const radioFieldParsedMeta = ZRadioFieldMeta.parse(field.fieldMeta);
        const checkedRadioFieldValue = radioFieldParsedMeta.values?.find(
          (option) => option.checked,
        )?.value;
        const errors = validateRadioField(checkedRadioFieldValue, radioFieldParsedMeta);
        if (errors.length > 0) {
          throw new Error(errors.join('. '));
        }
      }

      if (field.type === FieldType.DROPDOWN) {
        if (!field.fieldMeta) {
          throw new Error('Dropdown field is missing required metadata');
        }
        const dropdownFieldParsedMeta = ZDropdownFieldMeta.parse(field.fieldMeta);
        const errors = validateDropdownField(undefined, dropdownFieldParsedMeta);
        if (errors.length > 0) {
          throw new Error(errors.join('. '));
        }
      }

      // Proceed with upsert operation
      return prisma.field.upsert({
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
          fieldMeta: parsedFieldMeta,
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
          fieldMeta: parsedFieldMeta,
          template: {
            connect: {
              id: templateId,
            },
          },
          recipient: {
            connect: {
              templateId_email: {
                templateId,
                email: field.signerEmail.toLowerCase(),
              },
            },
          },
        },
      });
    }),
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

  return {
    fields: [...filteredFields, ...persistedFields],
  };
};
